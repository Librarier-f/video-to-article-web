import unittest
import os
import tempfile
import threading
import time
from unittest.mock import patch
from PIL import Image
from services.stream_capture import is_valid_frame, capture_keyframes_from_stream

class TestStreamCapture(unittest.TestCase):
    def test_capture_overlaps_two_frames_and_preserves_order(self):
        lock = threading.Lock()
        active = peak = 0

        def capture(url, timestamp, output, headers):
            nonlocal active, peak
            with lock:
                active += 1
                peak = max(peak, active)
            time.sleep(0.02)
            with open(output, 'wb') as stream:
                stream.write(b'frame')
            with lock:
                active -= 1
            return True

        with tempfile.TemporaryDirectory() as directory, \
             patch('services.stream_capture.capture_single_frame', side_effect=capture), \
             patch('services.stream_capture.is_valid_frame', return_value=True):
            frames = capture_keyframes_from_stream('url', [10, 20, 30, 40], 'test', base_dir=directory)
        self.assertEqual(peak, 2)
        self.assertEqual([frame['timestamp_sec'] for frame in frames], [10, 20, 30, 40])

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
