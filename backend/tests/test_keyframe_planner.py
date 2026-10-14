import unittest
from services.keyframe_planner import parse_timestamps_fallback, sanitize_timestamps

class TestKeyframePlanner(unittest.TestCase):
    def test_sanitize_and_deduplicate(self):
        raw = [10, 12, 120, 125, 300, 302]
        sanitized = sanitize_timestamps(raw, duration=600)
        # Should drop points within 35 seconds of each other and limit count
        self.assertIn(10, sanitized)
        self.assertNotIn(12, sanitized)
        self.assertIn(120, sanitized)
        self.assertNotIn(125, sanitized)

    def test_fallback_sampling(self):
        res = parse_timestamps_fallback(duration=600)
        self.assertTrue(len(res) >= 3)
        self.assertTrue(all(0 < t < 600 for t in res))

if __name__ == "__main__":
    unittest.main()
