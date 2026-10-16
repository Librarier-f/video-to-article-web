import asyncio
import json
import unittest

from services.fast_writer import write_fast_article


class TestFastWriter(unittest.IsolatedAsyncioTestCase):
    async def test_medium_transcript_uses_one_request_and_keeps_all_source(self):
        calls = []

        async def llm(prompt, system):
            calls.append(prompt)
            return json.dumps({"html": "<h2>正文</h2><p>结论</p>", "cards": [{"q": "问题", "a": "回答"}]}), {"total_tokens": 4}

        result = await write_fast_article("开头" + "文"*9000 + "末尾数据=42", "中文", llm)
        self.assertEqual(len(calls), 1)
        self.assertIn("末尾数据=42", calls[0])
        self.assertIn("开头", calls[0])
        self.assertIn("<h2>正文", result.html)
        self.assertEqual(result.cards[0]["a"], "回答")
        self.assertEqual(result.tokens, 4)

    async def test_long_transcript_summaries_are_parallel_and_ordered(self):
        active = peak = 0
        synthesis = []

        async def llm(prompt, system):
            nonlocal active, peak
            if "SOURCE_CHUNK" in prompt:
                active += 1
                peak = max(peak, active)
                await asyncio.sleep(0.01)
                active -= 1
                return prompt[-1] + "要点", {"total_tokens": 1}
            synthesis.append(prompt)
            return '{"html":"<p>正文</p>","cards":[]}', {"total_tokens": 2}

        result = await write_fast_article("a"*12000 + "b"*12000 + "c"*100, "中文", llm)
        self.assertEqual(peak, 3)
        self.assertLess(synthesis[0].index("a要点"), synthesis[0].index("b要点"))
        self.assertIn("c要点", synthesis[0])
        self.assertEqual(result.tokens, 5)

    async def test_html_fallback_does_not_repeat_paid_request(self):
        count = 0

        async def llm(*args):
            nonlocal count
            count += 1
            return "```html\n<h2>正文</h2><p>内容</p>\n```", {}

        result = await write_fast_article("字幕", "中文", llm)
        self.assertEqual(count, 1)
        self.assertEqual(result.cards, [])
        self.assertIn("<p>内容</p>", result.html)

    async def test_empty_or_invalid_model_response_is_not_published(self):
        async def llm(*args):
            return '{"html":"", "cards":[]}', {}

        with self.assertRaises(ValueError):
            await write_fast_article("字幕", "中文", llm)
