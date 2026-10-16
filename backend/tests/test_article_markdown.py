import unittest
from services.generator import html_to_markdown


class TestArticleMarkdown(unittest.TestCase):
    def test_table_structure_and_code_fences_survive_conversion(self):
        result = html_to_markdown('<table><tr><th>Name</th><th>Value</th></tr><tr><td>Rate</td><td>42</td></tr></table><pre><code>x = 1\ny = 2</code></pre>')
        self.assertIn('| Name | Value |', result)
        self.assertIn('| Rate | 42 |', result)
        self.assertIn('```', result)
        self.assertIn('x = 1\ny = 2', result)

    def test_images_and_links_are_preserved(self):
        result = html_to_markdown('<p><a href="https://example.com">来源</a></p><img src="/api/snapshots/t/1.jpg" alt="截图">')
        self.assertIn('[来源](https://example.com)', result)
        self.assertIn('![截图](/api/snapshots/t/1.jpg)', result)
