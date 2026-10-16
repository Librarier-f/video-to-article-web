import unittest
from urllib.parse import unquote
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from database import Base, get_db
from main import app
from models import Task, Article


class TestDocumentAPI(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite:///:memory:', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(bind=self.engine)
        self.original = '<header>来源</header><article><h2>旧文标题</h2><p>旧文正文</p></article>'
        with self.sessions() as db:
            task = Task(video_url='https://example.com/video', platform='test', style='blue_white', language='zh', status='completed')
            db.add(task)
            db.flush()
            article = Article(task_id=task.id, title='已有文章', video_url=task.video_url,
                              html_content=self.original, markdown_content='原始 Markdown')
            db.add(article)
            db.commit()
            self.article_id = article.id

        def database():
            with self.sessions() as db:
                yield db
        self.previous = app.dependency_overrides.copy()
        app.dependency_overrides[get_db] = database
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(self.previous)
        self.engine.dispose()

    def test_old_article_uses_new_template_without_rewriting_stored_body_or_markdown(self):
        result = self.client.get(f'/api/history/{self.article_id}')
        self.assertEqual(result.status_code, 200)
        self.assertIn('data-theme="blue_white"', result.json()['html_content'])
        self.assertIn('旧文正文', result.json()['html_content'])
        self.assertEqual(result.json()['markdown_content'], '原始 Markdown')
        with self.sessions() as db:
            self.assertEqual(db.get(Article, self.article_id).html_content, self.original)

    def test_download_uses_reading_template_and_theme_preview_is_available(self):
        result = self.client.get(f'/api/article/{self.article_id}/download')
        self.assertIn('data-action="focus"', result.text)
        self.assertIn('data-theme="blue_white"', result.text)
        self.assertIn('HTML-蓝白商务-', unquote(result.headers['content-disposition']))
        self.assertEqual(self.client.get('/api/themes/claude_style/preview').status_code, 200)
        self.assertEqual(self.client.get('/api/themes/invalid/preview').status_code, 404)
