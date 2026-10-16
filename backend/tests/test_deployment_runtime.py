import json
import os
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from main import app
from models import Article, Task


class DeploymentRuntimeTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite:///:memory:', connect_args={'check_same_thread': False},
                                    poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(bind=self.engine)
        self.previous = app.dependency_overrides.copy()

        def database():
            with self.sessions() as db:
                yield db

        app.dependency_overrides[get_db] = database
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(self.previous)
        self.engine.dispose()

    def payload(self, provider='deepseek'):
        return {'video_url': 'https://example.com/video', 'provider': provider, 'model': 'test-model'}

    def test_provider_credentials_reach_worker_without_persistence(self):
        for provider in ('deepseek', 'kimi', 'glm', 'minimax', 'siliconflow'):
            with self.subTest(provider=provider), patch.dict(os.environ, {'MAX_ACTIVE_TASKS': '0'}), \
                    patch('main.generate_article_task', new_callable=AsyncMock) as worker:
                response = self.client.post('/api/task', json=self.payload(provider),
                                            headers={f'X-{provider}-Key': 'test-only-private-value'})
                self.assertEqual(response.status_code, 201, response.text)
                self.assertEqual(response.json()['status'], 'pending', response.text)
                self.assertEqual(worker.await_count, 1)
                self.assertEqual(worker.await_args.args[5][f'x-{provider}-key'], 'test-only-private-value')
                self.assertNotIn('test-only-private-value', response.text)
                with self.sessions() as db:
                    row = db.get(Task, response.json()['id'])
                    self.assertNotIn('test-only-private-value', repr(row.__dict__))

    def test_active_task_limit_rejects_without_creating_another_row(self):
        with self.sessions() as db:
            db.add(Task(video_url='https://example.com/old', platform='test', style='notion_dark',
                        language='zh', status='enriching'))
            db.commit()
        with patch.dict(os.environ, {'MAX_ACTIVE_TASKS': '1'}), \
                patch('main.generate_article_task', new_callable=AsyncMock) as worker:
            response = self.client.post('/api/task', json=self.payload(), headers={'X-Deepseek-Key': 'key'})
        self.assertEqual(response.status_code, 429, response.text)
        self.assertIn('retry-after', response.headers)
        self.assertEqual(worker.await_count, 0)
        with self.sessions() as db:
            self.assertEqual(db.query(Task).count(), 1)

    def test_terminal_tasks_do_not_use_conversion_slot(self):
        with self.sessions() as db:
            for state in ('completed', 'failed'):
                db.add(Task(video_url='https://example.com/old', platform='test', style='notion_dark',
                            language='zh', status=state))
            db.commit()
        with patch.dict(os.environ, {'MAX_ACTIVE_TASKS': '1'}), \
                patch('main.generate_article_task', new_callable=AsyncMock):
            response = self.client.post('/api/task', json=self.payload(), headers={'X-Deepseek-Key': 'key'})
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()['status'], 'pending')

    def test_health_checks_database(self):
        response = self.client.get('/api/health')
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['status'], 'ok')

    def test_restart_marks_incomplete_tasks_failed_but_keeps_published_article(self):
        with self.sessions() as db:
            interrupted = Task(video_url='https://example.com/old', platform='test', style='notion_dark',
                               language='zh', status='enriching', progress=92, logs='["已有执行记录"]')
            completed = Task(video_url='https://example.com/done', platform='test', style='notion_dark',
                             language='zh', status='completed', progress=100, logs='[]')
            db.add_all([interrupted, completed])
            db.flush()
            db.add(Article(task_id=interrupted.id, title='已生成正文', video_url=interrupted.video_url,
                           html_content='<p>保留正文</p>'))
            db.commit()
            interrupted_id, completed_id = interrupted.id, completed.id
        with patch.dict(os.environ, {'V2A_RECOVER_INTERRUPTED': 'true'}), \
                patch('main.SessionLocal', self.sessions, create=True):
            with TestClient(app) as client:
                self.assertEqual(client.get('/api/health').status_code, 200)
        with self.sessions() as db:
            row = db.get(Task, interrupted_id)
            self.assertEqual(row.status, 'failed')
            self.assertIn('重启', row.current_step)
            self.assertIn('已有执行记录', json.loads(row.logs))
            self.assertEqual(db.get(Task, completed_id).status, 'completed')
            self.assertEqual(db.query(Article).one().html_content, '<p>保留正文</p>')
