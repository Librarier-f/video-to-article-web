import unittest
from services.layout_enricher import build_visual_context_prompt

class TestLayoutEnricher(unittest.TestCase):
    def test_build_visual_context_prompt(self):
        frames = [
            {
                "timestamp_sec": 125,
                "relative_path": "/api/snapshots/task1/frame_125s.jpg",
                "caption": "核心微服务交互架构图"
            }
        ]
        prompt = build_visual_context_prompt(frames)
        self.assertIn("02:05", prompt)
        self.assertIn("核心微服务交互架构图", prompt)
        self.assertIn("<figure", prompt)

if __name__ == "__main__":
    unittest.main()
