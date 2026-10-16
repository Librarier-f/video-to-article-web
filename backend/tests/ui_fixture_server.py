"""Local-only manual UI fixture; no video/model requests or application DB.

Run from backend: .venv/Scripts/python.exe tests/ui_fixture_server.py
Start frontend with VITE_API_BASE_URL=http://127.0.0.1:8010 on port 5175.
"""
import asyncio
import json
from pathlib import Path
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import database
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

database.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
database.SessionLocal = sessionmaker(bind=database.engine)
from main import app
from services import generator


def extract(*args, **kwargs):
    return dict(title="生成加速验证样例", author="本地模拟", duration=300, upload_date="2026-10-15",
                thumbnail_url="", cleaned_text="完整字幕末尾数值为42。" * 400, platform="test",
                stream_url="https://example.invalid/stream")


async def llm(*args, **kwargs):
    await asyncio.sleep(0.15)
    return json.dumps({
        "html": "<h2>完整正文已就绪</h2><p>截图仍在后台补充时，这段正文就应可阅读。</p>"
                "<table><tr><th>指标</th><th>数值</th></tr><tr><td>保留数据</td><td>42</td></tr></table>"
                "<pre><code>print(42)</code></pre>",
        "cards": [{"q": "保留的数值？", "a": "42"}]
    }, ensure_ascii=False), {"total_tokens": 50}


def capture(*args, **kwargs):
    time.sleep(8)
    return []


generator.extract_video_details = extract
generator.call_llm_api = llm
generator.capture_keyframes_from_stream = capture

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8010)
