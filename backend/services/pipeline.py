"""Bounded asynchronous work and thread-safe progress forwarding."""
import asyncio
import os
from queue import Empty, SimpleQueue


async def bounded_map(items, operation):
    # Per generation task: use 1 for providers with strict rate limits.
    limit = max(1, min(8, int(os.getenv("GENERATION_CONCURRENCY", "3"))))
    semaphore = asyncio.Semaphore(limit)

    async def run(item):
        async with semaphore:
            return await operation(item)

    workers = [asyncio.create_task(run(item)) for item in items]
    try:
        # gather preserves input order even when responses arrive out of order.
        return await asyncio.gather(*workers)
    finally:
        for worker in workers:
            if not worker.done():
                worker.cancel()
        await asyncio.gather(*workers, return_exceptions=True)


async def extract_with_progress(extractor, url, sessdata, on_log, youtube_cookies):
    # SQLAlchemy sessions stay on the event-loop thread. The downloader only
    # writes strings to this queue, never calling the database callback itself.
    messages = SimpleQueue()
    worker = asyncio.create_task(asyncio.to_thread(
        extractor, url, sessdata, messages.put, youtube_cookies=youtube_cookies
    ))

    def drain():
        while True:
            try:
                message = messages.get_nowait()
            except Empty:
                break
            on_log(message)

    try:
        while not worker.done():
            await asyncio.wait({worker}, timeout=0.1)
            drain()
        return await worker
    finally:
        drain()
