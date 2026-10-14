import unittest
import os
import tempfile
from PIL import Image
from services.vision_service import format_timestamp, encode_image_base64

class TestVisionService(unittest.TestCase):
    def test_format_timestamp(self):
        self.assertEqual(format_timestamp(65), "01:05")
        self.assertEqual(format_timestamp(3665), "01:01:05")

    def test_encode_image_base64(self):
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
            temp_path = f.name
        try:
            img = Image.new("RGB", (10, 10), color=(100, 100, 100))
            img.save(temp_path)
            b64 = encode_image_base64(temp_path)
            self.assertTrue(len(b64) > 0)
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

if __name__ == "__main__":
    unittest.main()
