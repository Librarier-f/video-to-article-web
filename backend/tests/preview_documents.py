"""Local theme QA server. No database, model credentials or external requests.

Run from backend: .venv/Scripts/python.exe tests/preview_documents.py
"""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from services.document_renderer import render_document, THEMES
from services.reading_sample import SAMPLE_BODY, SAMPLE_TITLE

app = FastAPI()


@app.get('/{style}', response_class=HTMLResponse)
def preview(style: str):
    if style not in THEMES:
        raise HTTPException(status_code=404)
    return render_document(article_content=SAMPLE_BODY, style=style, title=SAMPLE_TITLE,
                           author='排版示例', platform='阅读样例', publish_date='',
                           duration_formatted='', video_url='', thumbnail_url='')


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=8012)
