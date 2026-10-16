import asyncio
import json
import threading
import time
import unittest
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from models import Article, Task
from services import generator
from bs4 import BeautifulSoup


class TestGenerationPerformance(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        settings = patch.dict("os.environ", {"GENERATION_CONCURRENCY": "3"})
        settings.start()
        self.addCleanup(settings.stop)
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.task = Task(video_url="https://example.com/video", platform="test",
                         style="notion_dark", language="zh", generation_mode="deep")
        self.db.add(self.task)
        self.db.commit()
        self.task_id = self.task.id

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    async def run_generation(self, text, stream_url="", duration=0):
        active = {"summary": 0, "chapter": 0, "vision": 0}
        peak = dict(active)
        self.extract_thread = None
        self.progress_threads = []
        self.progress_values = []
        original_progress = generator.update_task_progress

        def progress(*args):
            self.progress_threads.append(threading.get_ident())
            self.progress_values.append(args[2])
            return original_progress(*args)

        def extract(*args, **kwargs):
            self.extract_thread = threading.get_ident()
            args[2]("test extraction log")
            time.sleep(0.02)
            return dict(title="测试", author="test", duration=duration, upload_date="2026-01-01",
                        thumbnail_url="", cleaned_text=text, platform="test", stream_url=stream_url)

        async def counted(kind, value, delay=0.01):
            active[kind] += 1
            peak[kind] = max(peak[kind], active[kind])
            try:
                await asyncio.sleep(delay)
                return value
            finally:
                active[kind] -= 1

        async def llm(provider, model, prompt, system, *args):
            if "JSON 数组的格式返回" in prompt:
                return json.dumps([{"title": f"章节{i}", "description": "要点"} for i in range(5)]), {"total_tokens": 1}
            if "以下视频段落字幕" in prompt:
                return await counted("summary", ("摘要" + prompt[-1], {"total_tokens": 1}))
            if "请深度撰写" in prompt:
                index = int(prompt.split("第 ")[1].split(" ")[0])
                return await counted("chapter", (f"<p>正文{index}</p>", {"total_tokens": 1}), (6-index)*0.005)
            if "互动学习" in prompt:
                return '[]', {"total_tokens": 1}
            return '<h2>短文标题</h2><p>短文正文</p>', {"total_tokens": 1}

        def capture(*args, **kwargs):
            self.capture_thread = threading.get_ident()
            return [dict(local_path=f"frame{i}.jpg", timestamp_sec=i*40,
                         relative_path=f"/api/snapshots/test/frame{i}.jpg") for i in range(5)]

        async def caption(*args):
            return await counted("vision", "图注")

        with patch.object(generator, "extract_video_details", side_effect=extract), \
             patch.object(generator, "call_llm_api", side_effect=llm), \
             patch.object(generator, "update_task_progress", side_effect=progress), \
             patch.object(generator, "predict_keyframe_timestamps", return_value=[40, 80, 120]), \
             patch.object(generator, "capture_keyframes_from_stream", side_effect=capture), \
             patch.object(generator, "analyze_frame_caption", side_effect=caption):
            await generator.generate_article_task(self.task_id, "custom", "test", None, None, {}, db=self.db)
        self.db.refresh(self.task)
        self.assertEqual(self.task.status, "completed", self.task.logs)
        return self.db.query(Article).one(), peak

    async def test_long_generation_is_bounded_parallel_and_preserves_order(self):
        article, peak = await self.run_generation("a"*15000)
        self.assertEqual(peak["summary"], 3)
        self.assertEqual(peak["chapter"], 3)
        doc = BeautifulSoup(article.html_content, 'html.parser')
        self.assertEqual([heading.get_text() for heading in doc.select('#article-body h2')], [f'章节{i}' for i in range(5)])
        self.assertIn("Tokens: 12", self.task.logs)

    async def test_extraction_runs_off_loop_but_progress_stays_on_loop(self):
        await self.run_generation("a"*3001)
        self.assertNotEqual(self.extract_thread, threading.get_ident())
        self.assertEqual(set(self.progress_threads), {threading.get_ident()})
        self.assertIn("test extraction log", self.task.logs)

    async def test_short_video_can_render_and_save(self):
        article, _ = await self.run_generation("短字幕")
        self.assertIn("短文正文", article.markdown_content)
        self.assertIn("- [短文标题]", article.markdown_content)

    async def test_visual_analysis_is_bounded_parallel_and_progress_never_rewinds(self):
        _, peak = await self.run_generation("a"*3001, stream_url="https://example.com/stream", duration=300)
        self.assertEqual(peak["vision"], 3)
        self.assertNotEqual(self.capture_thread, threading.get_ident())
        self.assertEqual(self.progress_values, sorted(self.progress_values))


if __name__ == "__main__":
    unittest.main()
