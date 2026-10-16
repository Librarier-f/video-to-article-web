import tempfile
import unittest
from pathlib import Path

from bs4 import BeautifulSoup
from services.document_renderer import render_document, extract_article_body, inline_snapshot_images


class TestDocumentRenderer(unittest.TestCase):
    def render(self, style="notion_dark", content=None, **overrides):
        values = dict(title="一篇值得读完的文章", author="原作者", platform="Bilibili",
                      publish_date="2026-10-16", duration_formatted="12:30",
                      video_url="https://example.com/video", thumbnail_url="", style=style,
                      article_content=content or '<p>开篇导读，先把问题说清楚。</p><h2>为什么重要</h2><p><strong>保留原始数据和事实</strong>，让理解更加具体。</p><h2>为什么重要</h2><pre><code>print(42)</code></pre>')
        values.update(overrides)
        return render_document(**values)

    def test_all_themes_have_distinct_identity_and_shared_reading_controls(self):
        for style in ["notion_dark", "blue_white", "claude_style", "cyber_tech", "minimal_modern"]:
            with self.subTest(style=style):
                doc = BeautifulSoup(self.render(style), "html.parser")
                self.assertEqual(doc.body["data-theme"], style)
                self.assertTrue(doc.select_one("#article-body"))
                self.assertTrue(doc.select_one('[data-action="focus"]'))
                self.assertTrue(doc.select_one('[data-action="font-increase"]'))
                self.assertTrue(doc.select_one("#reader-lightbox"))
                self.assertFalse(doc.select('link[rel="stylesheet"], script[src]'))

    def test_toc_links_are_unique_and_match_actual_headings(self):
        doc = BeautifulSoup(self.render(), "html.parser")
        ids = [heading["id"] for heading in doc.select("#article-body h2")]
        self.assertEqual(len(ids), len(set(ids)))
        for link in doc.select('.toc a[href^="#"]'):
            self.assertIsNotNone(doc.find(id=link["href"][1:]))

    def test_metadata_is_escaped_and_model_scripts_are_removed(self):
        html = self.render(title='<img src=x onerror="alert(1)">', content='<p>正文</p><script>alert(1)</script><img src="javascript:alert(1)" onerror="alert(2)">')
        doc = BeautifulSoup(html, "html.parser")
        self.assertEqual(doc.h1.get_text(), '<img src=x onerror="alert(1)">')
        self.assertFalse(doc.select('#article-body script, #article-body [onerror]'))
        self.assertNotIn('javascript:', str(doc.select_one('#article-body')))

    def test_repeated_render_preserves_internal_links_and_table_wrapper(self):
        content = '<p>导读</p><a href="#original">继续阅读</a><h2 id="original">正文</h2><table><tr><td>内容</td></tr></table>'
        first = self.render(content=content)
        doc = BeautifulSoup(self.render(content=extract_article_body(first)), 'html.parser')
        body = doc.select_one('#article-body')
        link = body.find('a')
        self.assertEqual(link['href'], '#' + body.h2['id'])
        self.assertEqual(len(body.select('.table-scroll')), 1)
        self.assertEqual(body.p['class'], ['article-lead'])

    def test_legacy_article_and_notion_comment_body_are_extracted_without_source_card(self):
        for html in [
            '<header>来源</header><article class="container"><h2>标题</h2><p>正文</p></article><footer>页脚</footer>',
            '<div class="page"><h1>总标题</h1><div class="source-card">来源</div><!-- Main Article Content --><h2>标题</h2><p>正文</p><hr class="divider"><footer>页脚</footer></div>',
        ]:
            body = extract_article_body(html)
            self.assertIn('正文', body)
            self.assertNotIn('来源', body)
            self.assertNotIn('页脚', body)

    def test_download_embeds_local_snapshots_and_rejects_path_traversal(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'snapshots'
            (root / 'task').mkdir(parents=True)
            (root / 'task/frame.jpg').write_bytes(b'jpeg-fixture')
            (Path(directory) / 'secret.jpg').write_bytes(b'private')
            html = '<img src="/api/snapshots/task/frame.jpg"><img src="/api/snapshots/../secret.jpg">'
            result = inline_snapshot_images(html, root)
            self.assertIn('data:image/jpeg;base64,', result)
            self.assertNotIn('cHJpdmF0ZQ==', result)
