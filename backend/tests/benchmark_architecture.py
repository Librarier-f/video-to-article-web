"""Compare fast and deep request topology with deterministic offline latency.

Run from backend: .venv/Scripts/python.exe tests/benchmark_architecture.py
No network, real keys, downloaded videos, or writes to the application's DB.
"""
import asyncio
import json
from pathlib import Path
import statistics
import sys
import time
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base
from models import Task
from services import generator


async def run(mode, length, visuals):
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    task = Task(video_url="https://example.com/video", platform="test", style="notion_dark",
                language="zh", generation_mode=mode, include_visuals=int(visuals))
    db.add(task)
    db.commit()
    count = 0
    first_read = None
    started = time.perf_counter()
    progress = generator.update_task_progress

    def observe(*args):
        nonlocal first_read
        progress(*args)
        if args[1] == "enriching" and first_read is None:
            first_read = time.perf_counter() - started

    async def llm(provider, model, prompt, system, *args):
        nonlocal count
        count += 1
        await asyncio.sleep(0.05)
        if "DOCUMENT_BUNDLE" in prompt:
            return '{"html":"<h2>正文</h2><p>固定样例</p>","cards":[]}', {"total_tokens": 1}
        if "JSON 数组的格式返回" in prompt:
            return json.dumps([{"title": f"章节{i}", "description": "要点"} for i in range(5)]), {"total_tokens": 1}
        if "互动学习" in prompt:
            return '[]', {"total_tokens": 1}
        if "请深度撰写" in prompt:
            return '<p>固定样例</p>', {"total_tokens": 1}
        return '核心要点', {"total_tokens": 1}

    def extract(*args, **kwargs):
        time.sleep(0.01)
        return dict(title="test", author="test", duration=300, upload_date="2026-01-01",
                    thumbnail_url="", cleaned_text="文"*length, platform="test", stream_url="https://example.com/stream")

    def capture(*args, **kwargs):
        time.sleep(0.2)
        return []

    try:
        with patch.object(generator, "extract_video_details", side_effect=extract), \
             patch.object(generator, "call_llm_api", side_effect=llm), \
             patch.object(generator, "update_task_progress", side_effect=observe), \
             patch.object(generator, "predict_keyframe_timestamps", return_value=[100]), \
             patch.object(generator, "capture_keyframes_from_stream", side_effect=capture):
            await generator.generate_article_task(task.id, "custom", "test", None, None, {}, db)
        db.refresh(task)
        assert task.status == "completed", task.logs
        return first_read, time.perf_counter() - started, count
    finally:
        db.close()
        engine.dispose()


async def main():
    with patch.dict("os.environ", {"GENERATION_CONCURRENCY": "3"}):
        await run("deep", 9000, False)  # Warm templates/imports.
        print("chars,visuals,mode,calls,first_body_median_s,completed_median_s")
        for length, visuals in [(9000, False), (30000, False), (9000, True)]:
            for mode in ["deep", "fast"]:
                rows = [await run(mode, length, visuals) for _ in range(5)]
                print(f"{length},{visuals},{mode},{rows[0][2]},"
                      f"{statistics.median(row[0] for row in rows):.3f},"
                      f"{statistics.median(row[1] for row in rows):.3f}")
        print("Synthetic fixed 50ms/request; measures scheduling only, not real model quality or speed.")


if __name__ == "__main__":
    asyncio.run(main())
