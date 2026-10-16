"""Local editorial layout for generated and previously saved articles."""
import base64
from functools import lru_cache
import math
import mimetypes
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

from bs4 import BeautifulSoup, Comment
from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup

TEMPLATES = Path(__file__).resolve().parents[1] / 'templates'
THEMES = {
    'notion_dark': ('Notion 深色', 'dark'),
    'blue_white': ('蓝白商务', 'light'),
    'claude_style': ('Claude 赭石', 'light'),
    'cyber_tech': ('暗黑科技', 'dark'),
    'minimal_modern': ('极简现代', 'light'),
}


@lru_cache(maxsize=1)
def template_environment():
    return Environment(loader=FileSystemLoader(TEMPLATES), autoescape=select_autoescape(['html']))


def extract_article_body(html):
    doc = BeautifulSoup(html or '', 'html.parser')
    article = doc.select_one('#article-body') or doc.find('article')
    if article is not None:
        return ''.join(str(node) for node in article.contents)
    for comment in doc.find_all(string=lambda text: isinstance(text, Comment)):
        if str(comment).strip() in ('Main Article Content', '主体文章内容'):
            nodes = []
            for sibling in comment.next_siblings:
                if getattr(sibling, 'name', None) == 'hr' and 'divider' in sibling.get('class', []):
                    break
                nodes.append(str(sibling))
            return ''.join(nodes).strip()
    if doc.body:
        for node in doc.select('header, footer, script, style, .source-card, .hero, .reader-tools'):
            node.decompose()
        return ''.join(str(node) for node in doc.body.contents)
    return str(doc)


def safe_url(url, image=False):
    url = str(url or '').strip()
    try:
        scheme = urlsplit(url).scheme.lower()
    except ValueError:
        return ''
    if not scheme or scheme in ('http', 'https') or (not image and scheme == 'mailto'):
        return url
    if image and re.match(r'^data:image/(?:png|jpeg|webp|gif);base64,', url, re.I):
        return url
    return ''


def prepare_content(content):
    soup = BeautifulSoup(content or '', 'html.parser')
    for node in list(soup.find_all(['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'button', 'select', 'link', 'meta', 'base', 'svg'])):
        node.decompose()
    for node in soup.find_all(True):
        for attr in list(node.attrs):
            if attr.lower().startswith('on') or attr.lower() in ('style', 'srcdoc', 'srcset'):
                del node.attrs[attr]
        for attr in ('href', 'src'):
            if node.has_attr(attr):
                node[attr] = safe_url(node[attr], image=attr == 'src')
        if node.name == 'a' and not node.get('href', '').startswith('#'):
            node['target'] = '_blank'
            node['rel'] = 'noopener noreferrer'
        if node.name == 'img':
            node['loading'] = 'lazy'
            node['alt'] = node.get('alt') or '视频配图'

    toc = []
    heading_ids = {}
    headings = soup.find_all(['h2', 'h3'])
    reserved_ids = {node['id'] for node in soup.find_all(id=True) if node not in headings}
    for index, heading in enumerate(headings, 1):
        anchor = f'article-section-{index}'
        while anchor in reserved_ids:
            anchor += '-section'
        reserved_ids.add(anchor)
        if heading.get('id'):
            heading_ids.setdefault(heading['id'], anchor)
        heading['id'] = anchor
        toc.append(dict(id=heading['id'], title=heading.get_text(' ', strip=True), level=int(heading.name[1])))
    for link in soup.select('a[href^="#"]'):
        target = unquote(link['href'][1:])
        if target in heading_ids:
            link['href'] = '#' + heading_ids[target]
    first_paragraph = soup.find('p', recursive=False)
    if first_paragraph:
        first_paragraph['class'] = list(dict.fromkeys([*first_paragraph.get('class', []), 'article-lead']))
    for table in list(soup.find_all('table')):
        if 'table-scroll' in table.parent.get('class', []):
            continue
        wrapper = soup.new_tag('div', attrs={'class': 'table-scroll', 'tabindex': '0', 'aria-label': '可横向滚动的数据表格'})
        table.wrap(wrapper)
    highlights = []
    for strong in soup.find_all(['strong', 'b']):
        text = strong.get_text(' ', strip=True)
        if 8 <= len(text) <= 80 and text not in highlights:
            highlights.append(text)
        if len(highlights) == 3:
            break
    text = soup.get_text(' ', strip=True)
    chinese = len(re.findall(r'[\u3400-\u9fff]', text))
    words = len(re.findall(r'[A-Za-z0-9]+', text))
    minutes = max(1, math.ceil(chinese / 450 + words / 200))
    return Markup(str(soup)), toc, highlights, minutes


def render_document(*, article_content, style='notion_dark', **metadata):
    style = style if style in THEMES else 'notion_dark'
    content, toc, highlights, minutes = prepare_content(article_content)
    values = {**metadata, 'style': style, 'article_content': content, 'toc': toc,
              'highlights': highlights, 'reading_minutes': minutes,
              'theme_label': THEMES[style][0], 'default_scheme': THEMES[style][1]}
    values['footer_note'] = {
        'notion_dark': '提示：本文内容系根据视频字幕自动提取整理，格式遵循 Notion 暗黑规范排版。仅供学习交流使用。',
        'blue_white': '提示：本文基于视频字幕自动整理生成，采用 Cobalt Light 高质感排版体系。仅供学习研究使用。',
        'claude_style': '本文内容根据原视频字幕整理。仅供学习交流使用。',
        'cyber_tech': '内容根据视频字幕整理，请尊重原作者权益。',
        'minimal_modern': '本文内容根据原视频字幕整理。仅供学习交流使用。',
    }[style]
    values['video_url'] = safe_url(metadata.get('video_url', ''))
    values['thumbnail_url'] = safe_url(metadata.get('thumbnail_url', ''), image=True)
    return template_environment().get_template(f'{style}.html').render(**values)


def render_saved_document(article):
    from services.generator import format_duration
    style = article.task.style if article.task else 'notion_dark'
    return render_document(
        article_content=extract_article_body(article.html_content), style=style,
        title=article.title, author=article.author, platform=article.task.platform if article.task else '视频',
        publish_date=article.publish_date, duration_formatted=format_duration(article.duration or 0),
        video_url=article.video_url, thumbnail_url=article.thumbnail_url or ''
    )


def inline_snapshot_images(html, snapshot_root=None):
    root = Path(snapshot_root or 'snapshots').resolve()
    doc = BeautifulSoup(html, 'html.parser')
    for image in doc.find_all('img', src=True):
        src = image['src']
        if not src.startswith('/api/snapshots/'):
            continue
        path = (root / unquote(src[len('/api/snapshots/'):])).resolve()
        if not path.is_relative_to(root) or not path.is_file() or path.stat().st_size > 10 * 1024 * 1024:
            continue
        mime = mimetypes.guess_type(path.name)[0]
        if mime not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif'):
            continue
        image['src'] = f'data:{mime};base64,{base64.b64encode(path.read_bytes()).decode("ascii")}'
    return str(doc)
