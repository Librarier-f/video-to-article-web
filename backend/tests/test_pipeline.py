import asyncio
import unittest
from unittest.mock import patch

from services.pipeline import bounded_map, extract_with_progress


class TestPipeline(unittest.IsolatedAsyncioTestCase):
    async def test_failed_batch_cancels_siblings_before_returning(self):
        started = asyncio.Event()
        stopped = asyncio.Event()

        async def operation(item):
            if item == 0:
                await started.wait()
                raise ValueError("provider failed")
            started.set()
            try:
                await asyncio.Event().wait()
            finally:
                stopped.set()

        with patch.dict("os.environ", {"GENERATION_CONCURRENCY": "3"}):
            with self.assertRaisesRegex(ValueError, "provider failed"):
                await bounded_map([0, 1], operation)
        self.assertTrue(stopped.is_set())

    async def test_single_concurrency_setting_and_order(self):
        active = 0
        peak = 0

        async def operation(item):
            nonlocal active, peak
            active += 1
            peak = max(peak, active)
            await asyncio.sleep(0)
            active -= 1
            return item

        with patch.dict("os.environ", {"GENERATION_CONCURRENCY": "1"}):
            self.assertEqual(await bounded_map(range(5), operation), list(range(5)))
        self.assertEqual(peak, 1)

    async def test_download_error_still_forwards_logs(self):
        logs = []

        def extract(url, sessdata, log, **kwargs):
            log("download failed")
            raise ValueError("no subtitles")

        with self.assertRaisesRegex(ValueError, "no subtitles"):
            await extract_with_progress(extract, "url", None, logs.append, None)
        self.assertEqual(logs, ["download failed"])
