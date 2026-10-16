from fastapi import FastAPI, Depends, BackgroundTasks, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from contextlib import asynccontextmanager
from typing import List, Dict, Optional
import os
import shutil
import json
import re

from database import engine, Base, get_db, SessionLocal
from models import Task, Article
from schemas import TaskCreate, TaskResponse, ArticleResponse, ArticleDetailResponse
from services.generator import generate_article_task
from services.ima_service import export_article_to_ima, get_knowledge_bases
from services.document_renderer import render_saved_document, inline_snapshot_images, extract_article_body, render_document, THEMES
from services.task_runtime import task_admission, recover_interrupted_tasks
from pydantic import BaseModel

class ExportImaRequest(BaseModel):
    knowledge_base_id: Optional[str] = None


# Initialize database tables on startup
Base.metadata.create_all(bind=engine)

# Ensure snapshots directory exists and mount static files
os.makedirs("snapshots", exist_ok=True)

# Safely check and add markdown_content column if it doesn't exist
try:
    from sqlalchemy import text
    with engine.begin() as conn:
        cursor = conn.execute(text("PRAGMA table_info(articles)"))
        columns = [row[1] for row in cursor.fetchall()]
        if "markdown_content" not in columns:
            conn.execute(text("ALTER TABLE articles ADD COLUMN markdown_content TEXT"))
        if "anki_csv" not in columns:
            conn.execute(text("ALTER TABLE articles ADD COLUMN anki_csv TEXT"))
        if "mermaid_code" not in columns:
            conn.execute(text("ALTER TABLE articles ADD COLUMN mermaid_code TEXT"))
            
        cursor = conn.execute(text("PRAGMA table_info(tasks)"))
        task_columns = [row[1] for row in cursor.fetchall()]
        if "api_base_url" not in task_columns:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN api_base_url VARCHAR(500)"))
        if "generation_mode" not in task_columns:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN generation_mode VARCHAR(20) NOT NULL DEFAULT 'deep'"))
        if "include_visuals" not in task_columns:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN include_visuals INTEGER NOT NULL DEFAULT 1"))
except Exception as e:
    import logging
    logging.getLogger("uvicorn").error(f"Database migration check failed: {e}")

@asynccontextmanager
async def lifespan(application):
    if os.environ.get('V2A_RECOVER_INTERRUPTED', 'false').lower() == 'true':
        with SessionLocal() as db:
            recover_interrupted_tasks(db)
    yield


app = FastAPI(title="Video to Article BYOK Web API", lifespan=lifespan)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:5174", "http://127.0.0.1:5174",
        "http://localhost:5175", "http://127.0.0.1:5175"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for video snapshot keyframes
app.mount("/api/snapshots", StaticFiles(directory="snapshots"), name="snapshots")

@app.get("/")
def read_root():
    return {"message": "Video to Article Web API is running."}


@app.get('/api/health')
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text('SELECT 1'))
    except SQLAlchemyError:
        raise HTTPException(503, 'DATABASE_UNAVAILABLE') from None
    return {'status': 'ok'}


@app.get('/api/themes/{style}/preview', response_class=HTMLResponse)
def preview_reading_theme(style: str):
    if style not in THEMES:
        raise HTTPException(status_code=404, detail='主题不存在')
    from services.reading_sample import SAMPLE_BODY, SAMPLE_TITLE
    return HTMLResponse(render_document(
        article_content=SAMPLE_BODY, style=style, title=SAMPLE_TITLE, author='排版示例',
        platform='阅读样例', publish_date='', duration_formatted='', video_url='', thumbnail_url=''
    ))

@app.post("/api/task", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    task_in: TaskCreate,
    background_tasks: BackgroundTasks,
    # Inject BYOK headers
    x_gemini_key: Optional[str] = Header(None, alias="X-Gemini-Key"),
    x_claude_key: Optional[str] = Header(None, alias="X-Claude-Key"),
    x_openai_key: Optional[str] = Header(None, alias="X-OpenAI-Key"),
    x_deepseek_key: Optional[str] = Header(None, alias="X-Deepseek-Key"),
    x_kimi_key: Optional[str] = Header(None, alias="X-Kimi-Key"),
    x_glm_key: Optional[str] = Header(None, alias="X-Glm-Key"),
    x_minimax_key: Optional[str] = Header(None, alias="X-Minimax-Key"),
    x_siliconflow_key: Optional[str] = Header(None, alias="X-Siliconflow-Key"),
    db: Session = Depends(get_db)
):
    """
    Creates a new article extraction task and triggers it in the background.
    """
    keys = {
        'x-gemini-key': x_gemini_key or '',
        'x-claude-key': x_claude_key or '',
        'x-openai-key': x_openai_key or '',
        'x-deepseek-key': x_deepseek_key or '',
        'x-kimi-key': x_kimi_key or '',
        'x-glm-key': x_glm_key or '',
        'x-minimax-key': x_minimax_key or '',
        'x-siliconflow-key': x_siliconflow_key or '',
        'x-custom-key': task_in.custom_api_key or '',
    }
    with task_admission(db):
        return _create_task(task_in, background_tasks, keys, db)


def _create_task(task_in, background_tasks, keys, db):
    # Parse platform from URL
    url = task_in.video_url.lower()
    if "bilibili.com" in url or "b23.tv" in url:
        platform = "Bilibili"
    elif "youtube.com" in url or "youtu.be" in url:
        platform = "YouTube"
    else:
        platform = "Universal"

    # Create new task entry in database
    db_task = Task(
        video_url=task_in.video_url,
        platform=platform,
        style=task_in.style,
        language=task_in.language,
        api_base_url=task_in.api_base_url,
        generation_mode=task_in.generation_mode,
        include_visuals=int(task_in.include_visuals),
        status="pending",
        progress=0.0,
        current_step="已创建任务，排队中",
        logs=json.dumps(["[初始化] 任务创建成功，等待分配后台线程。"])
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)

    # Verify that at least one key is provided for the selected provider
    provider = task_in.provider.lower()
    provider_key = keys.get(f"x-{provider}-key")
    if not provider_key:
        db_task.status = "failed"
        db_task.current_step = "验证失败"
        db_task.logs = json.dumps([f"[错误] 验证失败：未检测到 {provider.upper()} API Key。请先在设置中配置你的 API Key。"])
        db.commit()
        return db_task

    # Trigger background worker task
    background_tasks.add_task(
        generate_article_task,
        db_task.id,
        task_in.provider,
        task_in.model,
        task_in.api_base_url,
        task_in.sessdata,
        keys,
        None,
        task_in.youtube_cookies
    )

    return db_task

@app.get("/api/task/{task_id}", response_model=TaskResponse)
def get_task_status(task_id: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task

@app.get("/api/history", response_model=List[ArticleResponse])
def get_history_list(db: Session = Depends(get_db)):
    """
    Returns the list of successfully generated articles.
    """
    return db.query(Article).order_by(Article.created_at.desc()).all()

@app.get("/api/history/{article_id}", response_model=ArticleDetailResponse)
def get_article_details(article_id: int, db: Session = Depends(get_db)):
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="文章不存在")
        
    if not article.markdown_content:
        # Re-generate markdown dynamically from HTML
        article.markdown_content = regenerate_markdown(article)
        db.commit()
        
    response = ArticleDetailResponse.model_validate(article)
    response.html_content = render_saved_document(article)
    return response

@app.delete("/api/history/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_article(article_id: int, db: Session = Depends(get_db)):
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="文章不存在")
        
    # Delete the corresponding task and local snapshot files if it exists
    if article.task_id:
        task = db.query(Task).filter(Task.id == article.task_id).first()
        if task:
            db.delete(task)
            
        task_snapshots_dir = os.path.join("snapshots", article.task_id)
        if os.path.exists(task_snapshots_dir):
            try:
                shutil.rmtree(task_snapshots_dir, ignore_errors=True)
            except Exception:
                pass
            
    db.delete(article)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@app.get("/api/article/{article_id}/download")
def download_article(article_id: int, db: Session = Depends(get_db)):
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="文章不存在")
        
    style = article.task.style if article.task else 'notion_dark'
    theme_name = THEMES.get(style, THEMES['notion_dark'])[0]
    filename = f"HTML-{theme_name}-{article.title[:20].strip()}.html"
    # Replace invalid filename characters
    filename = re.sub(r'[\\/*?:"<>|]', "", filename)
    
    # URL encode filename for safe transmission in HTTP headers
    from urllib.parse import quote
    encoded_filename = quote(filename)
    
    headers = {
        "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
    }
    return HTMLResponse(content=inline_snapshot_images(render_saved_document(article)), headers=headers)

def regenerate_markdown(article: Article) -> str:
    from services.generator import html_to_markdown, format_duration
    html = article.html_content
    article_html = extract_article_body(html)
        
    body_markdown = html_to_markdown(article_html)
    
    # Extract headers to make a Table of Contents (TOC)
    headers = re.findall(r'## (.*?)\n', body_markdown)
    toc_lines = []
    for h in headers:
        clean_h = h.strip()
        anchor = clean_h.replace(" ", "-")
        toc_lines.append(f"- [{clean_h}](#{anchor})")
    
    toc_markdown = "## 目录\n" + "\n".join(toc_lines) + "\n\n---\n\n"
    
    # Build complete markdown
    md_header = (
        f"# {article.title}\n\n"
        f"> **视频来源**：{article.video_url} | **作者**：{article.author}\n"
        f"> **发布时间**：{article.publish_date} | **视频时长**：{format_duration(article.duration)}\n"
        f"> **原始链接**：{article.video_url}\n\n"
        f"---\n\n"
    )
    
    return md_header + toc_markdown + body_markdown

@app.get("/api/article/{article_id}/download/markdown")
def download_article_markdown(article_id: int, db: Session = Depends(get_db)):
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="文章不存在")
        
    markdown_content = article.markdown_content
    if not markdown_content:
        # Re-generate markdown dynamically from HTML
        markdown_content = regenerate_markdown(article)
        article.markdown_content = markdown_content
        db.commit()
        
    filename = f"MD-目录索引-{article.title[:20].strip()}.md"
    filename = re.sub(r'[\\/*?:"<>|]', "", filename)
    
    from urllib.parse import quote
    encoded_filename = quote(filename)
    
    headers = {
        "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
    }
    return Response(content=markdown_content, media_type="text/markdown", headers=headers)

@app.get("/api/ima/knowledge-bases")
async def list_knowledge_bases(
    x_ima_client_id: Optional[str] = Header(None, alias="X-Ima-Client-Id"),
    x_ima_key: Optional[str] = Header(None, alias="X-Ima-Key")
):
    if not x_ima_client_id or not x_ima_key:
        raise HTTPException(status_code=400, detail="未检测到 IMA Client ID 或 API Key。")
    try:
        kbs = await get_knowledge_bases(x_ima_client_id, x_ima_key)
        return {"success": True, "data": kbs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/export/ima/{article_id}")
async def export_to_ima(
    article_id: int,
    request: ExportImaRequest = None,
    x_ima_client_id: Optional[str] = Header(None, alias="X-Ima-Client-Id"),
    x_ima_key: Optional[str] = Header(None, alias="X-Ima-Key"),
    db: Session = Depends(get_db)
):
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="文章不存在")
        
    if not x_ima_client_id or not x_ima_key:
        raise HTTPException(status_code=400, detail="未检测到 IMA Client ID 或 API Key。请先在设置中配置。")
        
    markdown_content = article.markdown_content
    if not markdown_content:
        markdown_content = regenerate_markdown(article)
        article.markdown_content = markdown_content
        db.commit()
        
    kb_id = request.knowledge_base_id if request else None
        
    try:
        result = await export_article_to_ima(
            client_id=x_ima_client_id,
            api_key=x_ima_key,
            title=article.title,
            markdown_content=markdown_content,
            kb_id=kb_id
        )
        return {"success": True, "note_id": result.get("note_id")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
