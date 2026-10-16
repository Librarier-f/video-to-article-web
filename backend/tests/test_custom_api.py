import json
import unittest
from unittest.mock import AsyncMock, patch

import httpx
from pydantic import ValidationError

from schemas import TaskCreate
from services.llm_service import call_llm_api, llm_session
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from database import Base, get_db
from main import app
from models import Task


class TestCustomAPI(unittest.IsolatedAsyncioTestCase):
    async def test_one_task_reuses_client_and_keeps_keys_per_request(self):
        observed = []

        def handle(request):
            observed.append(request.headers["authorization"])
            return httpx.Response(200, json={"choices": [{"message": {"content": "ok"}}]})

        client = httpx.AsyncClient(transport=httpx.MockTransport(handle))
        with patch("services.llm_service.httpx.AsyncClient", return_value=client) as factory:
            async with llm_session():
                for key in ["key-a", "key-b"]:
                    await call_llm_api("custom", "m", "p", keys={"x-custom-key": key}, api_base_url="https://proxy.example/v1")
        self.assertEqual(factory.call_count, 1)
        self.assertEqual(observed, ["Bearer key-a", "Bearer key-b"])
        self.assertTrue(client.is_closed)

    async def test_custom_endpoint_and_key_reach_provider(self):
        for address in ["https://proxy.example/v1", "https://proxy.example/v1/",
                        " https://proxy.example/v1/chat/completions/ "]:
            with self.subTest(address=address):
                seen = []

                def handle(request):
                    seen.append(request)
                    return httpx.Response(200, json={"choices": [{"message": {"content": "正文"}}],
                                                    "usage": {"total_tokens": 3}})

                client = httpx.AsyncClient(transport=httpx.MockTransport(handle))
                with patch("services.llm_service.httpx.AsyncClient", return_value=client):
                    result, usage = await call_llm_api("custom", "my-model", "字幕", keys={
                        "x-custom-key": "test-custom-key"
                    }, api_base_url=address)
                self.assertEqual(result, "正文")
                self.assertEqual(usage["total_tokens"], 3)
                self.assertEqual(str(seen[0].url), "https://proxy.example/v1/chat/completions")
                self.assertEqual(seen[0].headers["authorization"], "Bearer test-custom-key")
                self.assertEqual(json.loads(seen[0].content)["model"], "my-model")

    def test_custom_configuration_requires_valid_base_url_and_model(self):
        for address, model in [(None, "model"), ("ftp://proxy.example/v1", "model"),
                               ("https://proxy.example/v1", "   ")]:
            with self.subTest(address=address, model=model):
                with self.assertRaises(ValidationError):
                    TaskCreate(video_url="https://example.com/video", provider="custom",
                               api_base_url=address, model=model, custom_api_key="key")


class TestCustomTaskAPI(unittest.TestCase):
    def test_task_forwards_custom_credentials_without_persisting_key(self):
        engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False},
                               poolclass=StaticPool)
        Base.metadata.create_all(engine)
        sessions = sessionmaker(bind=engine)

        def database():
            with sessions() as db:
                yield db

        previous = app.dependency_overrides.copy()
        app.dependency_overrides[get_db] = database
        try:
            with patch("main.generate_article_task", new_callable=AsyncMock) as worker:
                with TestClient(app) as client:
                    response = client.post("/api/task", json={
                        "video_url": "https://example.com/video", "provider": "custom",
                        "model": "custom-model", "api_base_url": "https://proxy.example/v1/",
                        "custom_api_key": " test-only-key ",
                    })
                self.assertEqual(response.status_code, 201, response.text)
                self.assertEqual(worker.await_args.args[3], "https://proxy.example/v1")
                self.assertEqual(worker.await_args.args[5]["x-custom-key"], "test-only-key")
                with sessions() as db:
                    record = db.query(Task).one()
                    self.assertNotIn("test-only-key", str(record.__dict__))
        finally:
            app.dependency_overrides.clear()
            app.dependency_overrides.update(previous)
            engine.dispose()
