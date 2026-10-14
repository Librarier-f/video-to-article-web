import unittest
import os
import shutil
from fastapi.testclient import TestClient
from main import app

class TestSnapshotsAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.test_dir = os.path.join("snapshots", "test-task-123")
        os.makedirs(self.test_dir, exist_ok=True)
        with open(os.path.join(self.test_dir, "frame_10s.jpg"), "wb") as f:
            f.write(b"fake image data")

    def tearDown(self):
        if os.path.exists("snapshots"):
            shutil.rmtree(os.path.join("snapshots", "test-task-123"), ignore_errors=True)

    def test_serve_snapshot(self):
        resp = self.client.get("/api/snapshots/test-task-123/frame_10s.jpg")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.content, b"fake image data")

if __name__ == "__main__":
    unittest.main()
