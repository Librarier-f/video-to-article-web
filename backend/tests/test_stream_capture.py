import unittest
import os
import tempfile
from PIL import Image
from services.stream_capture import is_valid_frame

class TestStreamCapture(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()

    def test_pure_black_frame_is_invalid(self):
        black_path = os.path.join(self.test_dir, "black.jpg")
        img = Image.new("RGB", (100, 100), color=(0, 0, 0))
        img.save(black_path)
        self.assertFalse(is_valid_frame(black_path))

    def test_high_contrast_frame_is_valid(self):
        valid_path = os.path.join(self.test_dir, "valid.jpg")
        img = Image.new("RGB", (100, 100), color=(255, 255, 255))
        for x in range(50):
            for y in range(50):
                img.putpixel((x, y), (0, 0, 255))
        img.save(valid_path)
        self.assertTrue(is_valid_frame(valid_path))

if __name__ == "__main__":
    unittest.main()
