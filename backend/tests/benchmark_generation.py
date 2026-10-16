"""Offline end-to-end scheduling benchmark; no external requests or API keys.

Run from backend: .venv/Scripts/python.exe tests/benchmark_generation.py
Uses identical fake model latencies for serial and bounded-parallel runs.
"""
import asyncio
import os
from pathlib import Path
import statistics
import sys
from time import perf_counter
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from test_generation_performance import TestGenerationPerformance


async def measure(limit):
    samples = []
    for _ in range(5):
        case = TestGenerationPerformance()
        case.setUp()
        try:
            with patch.dict(os.environ, {"GENERATION_CONCURRENCY": str(limit)}):
                started = perf_counter()
                await case.run_generation("a" * 15000)
                samples.append(perf_counter() - started)
        finally:
            case.tearDown()
            case.doCleanups()
    return statistics.median(samples)


async def main():
    # Warm templates/imports before measuring both configurations.
    await measure(1)
    serial = await measure(1)
    parallel = await measure(3)
    print(f"Offline fixture: 15000 chars, 5 summaries, 5 chapters; median of 5 runs")
    print(f"concurrency=1: {serial:.3f}s")
    print(f"concurrency=3: {parallel:.3f}s")
    print(f"speedup: {serial / parallel:.2f}x; elapsed reduction: {(1-parallel/serial)*100:.1f}%")
    print("Synthetic scheduling result only; real provider latency/rate limits are not measured.")


if __name__ == "__main__":
    asyncio.run(main())
