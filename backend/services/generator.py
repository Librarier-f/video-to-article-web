import json
import logging
import os
import re
import traceback
from datetime import datetime
from jinja2 import Environment, FileSystemLoader
from sqlalchemy.orm import Session
from typing import Optional
from models import Task, Article
from services.converter import extract_video_details
from services.llm_service import call_llm_api

# Set up logger
logger = logging.getLogger("video-to-article.generator")

def update_task_progress(task_id: str, status: str, progress: float, current_step: str, log_message: str, db: Session):
    """
    Updates a task's progress, status, step and appends a log entry.
    """
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        return
        
    task.status = status
    task.progress = progress
    task.current_step = current_step
    
    # Append log message
    try:
        logs_list = json.loads(task.logs or "[]")
    except:
        logs_list = []
    
    timestamp = datetime.now().strftime("%H:%M:%S")
    logs_list.append(f"[{timestamp}] {log_message}")
    task.logs = json.dumps(logs_list)
    
    db.add(task)
    db.commit()
    db.refresh(task)

def format_duration(seconds: float) -> str:
    """Formats duration seconds into MM:SS or HH:MM:SS."""
    seconds = int(seconds)
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"

def html_to_markdown(html_content: str) -> str:
    """Converts standard simple HTML tag output to Markdown text."""
    # 1. Replace <strong> and <b> with **
    md = re.sub(r'<(?:strong|b)>(.*?)</(?:strong|b)>', r'**\1**', html_content, flags=re.DOTALL)
    # 2. Replace <em> and <i> with *
    md = re.sub(r'<(?:em|i)>(.*?)</(?:em|i)>', r'*\1*', md, flags=re.DOTALL)
    # 3. Replace <h2> with ##
    md = re.sub(r'<h2>(.*?)</h2>', r'## \1\n\n', md, flags=re.DOTALL)
    # 4. Replace <h3> with ###
    md = re.sub(r'<h3>(.*?)</h3>', r'### \1\n\n', md, flags=re.DOTALL)
    # 5. Replace <blockquote> with >
    md = re.sub(r'<blockquote>(.*?)</blockquote>', r'> \1\n\n', md, flags=re.DOTALL)
    # 6. Replace <li> within lists
    md = re.sub(r'<li>(.*?)</li>', r'- \1\n', md, flags=re.DOTALL)
    # 7. Remove <ul>, </ul>, <ol>, </ol>
    md = re.sub(r'</?(?:ul|ol)>', r'\n', md)
    # 8. Replace <p> with newlines
    md = re.sub(r'<p>(.*?)</p>', r'\1\n\n', md, flags=re.DOTALL)
    # 9. Replace <br> with newlines
    md = re.sub(r'<br\s*/?>', r'\n', md)
    # 10. Clean any other remaining HTML tags
    md = re.sub(r'<[^>]+>', '', md)
    # Normalize multiple newlines
    md = re.sub(r'\n{3,}', '\n\n', md)
    return md.strip()

async def generate_article_task(
    task_id: str,
    provider: str,
    model: str,
    api_base_url: Optional[str],
    sessdata: Optional[str],
    keys: dict,
    db: Optional[Session] = None
):
    """
    Async background task that processes the video-to-article conversion.
    """
    from database import SessionLocal
    
    db_created = False
    if db is None:
        db = SessionLocal()
        db_created = True
        
    try:
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            logger.error(f"Task {task_id} not found in database.")
            return
            
        video_url = task.video_url
        style = task.style or "notion_dark"
        
        # Track token usage
        total_tokens = 0
            
        # Start task pipeline
        try:
            update_task_progress(task_id, "downloading", 10.0, "正在提取视频与字幕...", "开始解析视频源...", db)
            
            # Step 1: Extract details and subtitles
            def log_converter(msg: str):
                update_task_progress(task_id, "downloading", 15.0, "正在提取视频与字幕...", msg, db)
                
            details = extract_video_details(video_url, sessdata, log_converter)
            title = details["title"]
            author = details["author"]
            duration = details["duration"]
            publish_date = details["upload_date"]
            thumbnail_url = details["thumbnail_url"]
            subtitles_text = details["cleaned_text"]
            platform = details["platform"]
            
            sub_len = len(subtitles_text)
            update_task_progress(task_id, "processing", 25.0, "成功提取字幕，开始评估文章结构...", f"成功提取字幕，共 {sub_len} 字符。", db)
            
            # Decide process flow based on subtitle length
            article_html = ""
            
            # System instructions to guarantee no markdown bold is outputted and only HTML tags are generated
            system_instruction = (
                "你是一个顶级的自媒体主编与排版大师。\n"
                "写作规范要求：\n"
                "1. 严格使用 HTML 标签（<p>, <h2>, <h3>, <ul>, <li>）进行排版。\n"
                "2. 引用金句使用 <blockquote> 标签。\n"
                "3. 重点标注或重点强调模块使用 Notion 风格 of Callout 语法：\n"
                "   `<div class=\"callout callout-blue\"><span class=\"callout-icon\">💡</span><div class=\"callout-content\"><p>...</p></div></div>`\n"
                "   （callout 类型有：callout-blue, callout-green, callout-orange, callout-yellow, callout-pink）\n"
                "4. ⚠️【极其重要】严禁使用任何 Markdown 格式的粗体标记（即 ** 符号），必须使用标准 HTML 标签 `<strong>` 进行文本加粗以保证系统渲染排版解析正常。\n"
                "5. 直接返回 HTML 标签包裹的内容，不要包含任何 markdown 代码块标识符（如 ```html），也不要包含 <html>, <head>, <body> 外部容器。"
            )
            
            # --- Short video flow (<= 3000 chars) ---
            if sub_len <= 3000:
                update_task_progress(task_id, "writing", 50.0, "正在精写文章正文...", "字数符合短文标准，启动单次模型生成...", db)
                
                prompt = (
                    f"请根据以下视频字幕内容，整理、润色并写成一篇排版精美、富有深度的 Notion 风格自媒体文章。\n"
                    f"要求还原视频中的核心案例与主要数据，语言要口语化且有吸引力。\n\n"
                    f"【字幕内容】：\n{subtitles_text}"
                )
                
                article_content, usage = await call_llm_api(provider, model, prompt, system_instruction, keys, api_base_url)
                total_tokens += usage.get("total_tokens", 0) if "total_tokens" in usage else (usage.get("totalTokens", 0) if "totalTokens" in usage else 0)
                # Ensure raw markdown symbols are stripped
                article_content = article_content.replace("```html", "").replace("```", "").strip()
                article_html = article_content
                
            # --- Long video flow (> 3000 chars) ---
            else:
                # Phase 1: Segmented Summarization
                update_task_progress(task_id, "summarizing", 30.0, "正在对超长字幕进行分段要点整理...", "字幕较长，启动分段汇总流程...", db)
                
                # Slice subtitles into chunks of ~3000 characters
                chunk_size = 3000
                chunks = [subtitles_text[i:i+chunk_size] for i in range(0, sub_len, chunk_size)]
                num_chunks = len(chunks)
                
                summaries = []
                for idx, chunk in enumerate(chunks):
                    update_task_progress(
                        task_id, 
                        "summarizing", 
                        30.0 + (idx / num_chunks * 20.0), 
                        f"正在对超长字幕进行分段整理 ({idx+1}/{num_chunks})...", 
                        f"整理视频第 {idx+1}/{num_chunks} 阶段内容要点...", 
                        db
                    )
                    
                    chunk_prompt = f"请简明扼要地总结以下视频段落字幕的核心论点、引用的数据、金句与案例（尽量保留具体的专业名词和数值细节）：\n\n{chunk}"
                    summary, usage = await call_llm_api(provider, model, chunk_prompt, "你是一个擅长提炼核心要点的专业助理。", keys, api_base_url)
                    total_tokens += usage.get("total_tokens", 0) if "total_tokens" in usage else (usage.get("totalTokens", 0) if "totalTokens" in usage else 0)
                    summaries.append(summary)
                    
                combined_summaries = "\n\n".join(summaries)
                
                # Phase 2: Outline Planning
                update_task_progress(task_id, "outlining", 55.0, "正在规划精细文章大纲...", "大纲规划中，计算文章章节框架...", db)
                
                outline_prompt = (
                    f"请根据以下整部视频的片段要点汇总，规划一个 5 至 8 个章节的深度文章大纲。\n"
                    f"为了能让后台程序分段解析，请**严格以标准 JSON 数组的格式返回**大纲。JSON 数组中的每个对象代表一个章节，包含以下两个字段：\n"
                    f"1. 'title': 该章节的标题名称（不含任何 HTML 或 markdown 标签）\n"
                    f"2. 'description': 该章节拟深入撰写的内容要点与数据引导\n\n"
                    f"⚠️ 注意：只返回合法的 JSON 数组本身，绝对不要包含任何 markdown 包裹符号（不要写 ```json）或其他多余的解释文字！\n\n"
                    f"【片段汇总要点】：\n{combined_summaries}"
                )
                
                outline_response, usage = await call_llm_api(provider, model, outline_prompt, "你是一个严谨输出 JSON 格式的高级编辑系统。", keys, api_base_url)
                total_tokens += usage.get("total_tokens", 0) if "total_tokens" in usage else (usage.get("totalTokens", 0) if "totalTokens" in usage else 0)
                # Clean JSON response
                cleaned_json = outline_response.replace("```json", "").replace("```", "").strip()
                
                try:
                    chapters_outline = json.loads(cleaned_json)
                    if not isinstance(chapters_outline, list):
                        raise ValueError("JSON output is not a list")
                except Exception as json_err:
                    logger.warning(f"Failed to parse JSON outline: {cleaned_json}. Fallback to manual parsing.")
                    # Basic fallback parser if JSON is corrupted
                    chapters_outline = []
                    titles = re.findall(r'"title"\s*:\s*"([^"]+)"', cleaned_json)
                    descriptions = re.findall(r'"description"\s*:\s*"([^"]+)"', cleaned_json)
                    for t, d in zip(titles, descriptions):
                        chapters_outline.append({"title": t, "description": d})
                        
                    if not chapters_outline:
                        # Generic default outline if all parsing failed
                        chapters_outline = [
                            {"title": "第一章：概念引入与背景分析", "description": "讨论视频开始的基础概念与背景论据。"},
                            {"title": "第二章：核心机理解构与推演", "description": "分析视频中的主要核心内容与技术/商业逻辑。"},
                            {"title": "第三章：深度案例剖析与印证", "description": "根据视频中给出的实际案例进行详细复盘。"},
                            {"title": "第四章：避坑指南与行动建议", "description": "提炼关键教训、警示红线与具体行动路线。"},
                            {"title": "第五章：总结与复利式前景展望", "description": "文章总结与长效期盼。"}
                        ]
                
                # Phase 3: Phased Writing (High-fidelity)
                update_task_progress(task_id, "writing", 60.0, "开始分章节深度精写...", f"大纲生成成功，共规划了 {len(chapters_outline)} 个章节。启动章节分阶段精写...", db)
                
                written_chapters = []
                num_chapters = len(chapters_outline)
                
                for ch_idx, chapter in enumerate(chapters_outline):
                    ch_title = chapter.get("title", f"第 {ch_idx+1} 章节")
                    ch_desc = chapter.get("description", "详实撰写本章内容。")
                    
                    update_task_progress(
                        task_id, 
                        "writing", 
                        60.0 + (ch_idx / num_chapters * 30.0), 
                        f"正在精写第 {ch_idx+1}/{num_chapters} 章节...", 
                        f"精写中: 《{ch_title}》...", 
                        db
                    )
                    
                    chapter_prompt = (
                        f"请深度撰写文章的第 {ch_idx+1} 章节。\n"
                        f"本章标题：《{ch_title}》\n"
                        f"本章撰写指南：{ch_desc}\n\n"
                        f"【本章上下文依赖要点汇总】：\n{combined_summaries}\n\n"
                        f"请严格遵守写作规范：\n"
                        f"1. 正文内容字数不少于 800 - 1200 字，力求还原原视频中具体的细节、数据、故事与金句，拒绝平铺直叙的空洞概括。\n"
                        f"2. 必须使用标准的 HTML 标签（如 <p>, <ul>, <li>，可用引用 <blockquote>，重点标注可以用 callout 等标签）。\n"
                        f"3. ⚠️【极其重要】严禁使用 `**` 进行加粗，必须统一使用 `<strong>` 标签。\n"
                        f"4. 绝对不要输出章节标题（不要输出 <h2> 标题），只输出本章的 HTML 正文内容。"
                    )
                    
                    chapter_content, usage = await call_llm_api(provider, model, chapter_prompt, system_instruction, keys, api_base_url)
                    total_tokens += usage.get("total_tokens", 0) if "total_tokens" in usage else (usage.get("totalTokens", 0) if "totalTokens" in usage else 0)
                    # Strip markdown code blocks
                    chapter_content = chapter_content.replace("```html", "").replace("```", "").strip()
                    
                    written_chapters.append(f"<h2>{ch_title}</h2>\n{chapter_content}")
                    
                article_html = "\n\n".join(written_chapters)
    
            # Step 3: Render Template
            update_task_progress(task_id, "rendering", 90.0, "正在渲染 Notion 深色文章模板...", "正文精写完毕，开始进行排版模板渲染...", db)
            
            # Clean any remaining double asterisk markdown bold symbols from LLM output
            # Replaces **bold** with <strong>bold</strong>
            article_html = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', article_html)
            
            # Load Template using Jinja2
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            template_dir = os.path.join(base_dir, "templates")
            env = Environment(loader=FileSystemLoader(template_dir))
            
            template_filename = f"{style}.html"
            if not os.path.exists(os.path.join(template_dir, template_filename)):
                template_filename = "notion_dark.html"
            
            template = env.get_template(template_filename)
            
            # Render full page
            final_html = template.render(
                title=title,
                platform=platform,
                author=author,
                publish_date=publish_date if publish_date else datetime.now().strftime("%Y-%m-%d"),
                thumbnail_url=thumbnail_url if thumbnail_url else "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=300",
                duration_formatted=format_duration(duration),
                video_url=video_url,
                style=style,
                article_content=article_html
            )
            
            # Compile Markdown with TOC
            toc_lines = []
            for ch_idx, chapter in enumerate(chapters_outline):
                ch_title = chapter.get("title", f"第 {ch_idx+1} 章节")
                clean_ch_title = re.sub(r'<[^>]+>', '', ch_title)
                anchor = clean_ch_title.strip().replace(" ", "-")
                toc_lines.append(f"- [{clean_ch_title}](#{anchor})")
            
            toc_markdown = "## 目录\n" + "\n".join(toc_lines) + "\n\n---\n\n"
            
            pub_date = publish_date if publish_date else datetime.now().strftime("%Y-%m-%d")
            duration_formatted = format_duration(duration)
            
            md_header = (
                f"# {title}\n\n"
                f"> **视频来源**：{platform} | **作者**：{author}\n"
                f"> **发布时间**：{pub_date} | **视频时长**：{duration_formatted}\n"
                f"> **原始链接**：{video_url}\n\n"
                f"---\n\n"
            )
            
            body_markdown = html_to_markdown(article_html)
            final_markdown = md_header + toc_markdown + body_markdown
            
            # Save Article to Database
            new_article = Article(
                task_id=task_id,
                title=title,
                author=author,
                duration=duration,
                publish_date=pub_date,
                thumbnail_url=thumbnail_url if thumbnail_url else "",
                video_url=video_url,
                html_content=final_html,
                markdown_content=final_markdown
            )
            db.add(new_article)
            db.commit()
            
            # Complete Task
            update_task_progress(task_id, "completed", 100.0, "完成生成！", f"任务全部成功完成！总计消耗 Tokens: {total_tokens}。文章已归档到历史数据库。", db)
            
        except Exception as e:
            error_msg = f"发生未捕获异常: {str(e)}\n{traceback.format_exc()}"
            logger.error(f"Task {task_id} failed. {error_msg}")
            update_task_progress(task_id, "failed", 100.0, "任务失败", f"错误: {str(e)}", db)
    finally:
        if db_created:
            db.close()
