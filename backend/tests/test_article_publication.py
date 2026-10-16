import asyncio
import json
import threading
import unittest
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base
from models import Article, Task
from services import generator


class TestArticlePublication(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.task = Task(video_url="https://example.com/video", platform="test", style="notion_dark", language="zh")
        self.db.add(self.task)
        self.db.commit()
        self.details = dict(title="测试", author="test", duration=300, upload_date="2026-01-01",
                            thumbnail_url="", cleaned_text="字幕内容"*1000, platform="test",
                            stream_url="https://example.com/stream")

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    async def test_body_is_published_before_visuals_finish(self):
        release = threading.Event()
        published = asyncio.Event()
        original = generator.update_task_progress
        llm_calls = []

        def progress(*args):
            original(*args)
            if args[1] == "enriching" and self.db.query(Article).count():
                published.set()

        def capture(*args, **kwargs):
            release.wait(2)
            return []

        async def llm(*args, **kwargs):
            llm_calls.append(args)
            return json.dumps({"html": "<h2>正文</h2><p>完整内容</p>", "cards": []}), {"total_tokens": 1}

        with patch.object(generator, "extract_video_details", return_value=self.details), \
             patch.object(generator, "call_llm_api", side_effect=llm), \
             patch.object(generator, "capture_keyframes_from_stream", side_effect=capture), \
             patch.object(generator, "update_task_progress", side_effect=progress):
            running = asyncio.create_task(generator.generate_article_task(self.task.id, "custom", "model", None, None, {}, self.db))
            try:
                await asyncio.wait_for(published.wait(), 1)
                self.assertFalse(running.done())
                self.assertIn("完整内容", self.db.query(Article).one().markdown_content)
                self.assertEqual(len(llm_calls), 1)
            finally:
                release.set()
                await running
        self.db.refresh(self.task)
        self.assertEqual(self.task.status, "completed")

    async def test_visual_failure_keeps_successful_body_and_cards(self):
        async def llm(*args, **kwargs):
            return '{"html":"<p>正文</p>","cards":[{"q":"Q","a":"A"}]}', {}

        with patch.object(generator, "extract_video_details", return_value=self.details), \
             patch.object(generator, "call_llm_api", side_effect=llm), \
             patch.object(generator, "capture_keyframes_from_stream", side_effect=RuntimeError("ffmpeg failed")):
            await generator.generate_article_task(self.task.id, "custom", "model", None, None, {}, self.db)
        self.db.refresh(self.task)
        self.assertEqual(self.task.status, "completed")
        self.assertIn("正文", self.db.query(Article).one().html_content)
        self.assertEqual(json.loads(self.db.query(Article).one().anki_csv)[0]["q"], "Q")

    async def test_deep_mode_keeps_late_frames_missing_from_written_body(self):
        self.task.generation_mode = "deep"
        self.db.commit()
        details = {**self.details, "cleaned_text": "短字幕"}
        frame = dict(timestamp_sec=100, local_path="unused.jpg", relative_path="/api/snapshots/test/100.jpg")
        waits = 0

        async def wait(awaitable, timeout):
            nonlocal waits
            waits += 1
            if waits == 1:
                raise TimeoutError()
            return await awaitable

        async def llm(*args, **kwargs):
            return ('[]' if '互动学习' in args[2] else '<h2>正文</h2><p>内容</p>'), {}

        with patch.object(generator, "extract_video_details", return_value=details), \
             patch.object(generator, "call_llm_api", side_effect=llm), \
             patch.object(generator, "predict_keyframe_timestamps", return_value=[100]), \
             patch.object(generator, "capture_keyframes_from_stream", return_value=[frame]), \
             patch.object(generator, "analyze_frame_caption", return_value="图注"), \
             patch.object(generator.asyncio, "wait_for", side_effect=wait):
            await generator.generate_article_task(self.task.id, "custom", "model", None, None, {}, self.db)
        article = self.db.query(Article).one()
        self.assertIn(frame["relative_path"], article.html_content)
        self.assertIn(frame["relative_path"], article.markdown_content)
