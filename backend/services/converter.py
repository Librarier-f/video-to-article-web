import os
import re
import tempfile
import yt_dlp
from typing import Callable, Dict, Any, Optional

def create_temp_cookies(sessdata: str) -> Optional[str]:
    """
    Creates a temporary Netscape-formatted cookies file using the Bilibili SESSDATA.
    """
    if not sessdata:
        return None
    
    content = (
        "# Netscape HTTP Cookie File\n"
        ".bilibili.com\tTRUE\t/\tTRUE\t1799320292\tSESSDATA\t{sessdata}\n"
    ).format(sessdata=sessdata)
    
    fd, path = tempfile.mkstemp(suffix="_cookies.txt", prefix="bili_")
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        f.write(content)
    return path

def create_temp_yt_cookies(youtube_cookies: str) -> Optional[str]:
    """
    Creates a temporary Netscape-formatted cookies file using the uploaded YouTube cookies content.
    """
    if not youtube_cookies or not youtube_cookies.strip():
        return None
    
    content = youtube_cookies.strip()
    if not content.startswith("# Netscape HTTP Cookie File"):
        content = "# Netscape HTTP Cookie File\n" + content
    if not content.endswith("\n"):
        content += "\n"
        
    fd, path = tempfile.mkstemp(suffix="_cookies.txt", prefix="yt_")
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        f.write(content)
    return path

def clean_subtitle(raw_text: str, is_vtt: bool = False) -> str:
    """
    Cleans raw subtitle text by removing SRT index numbers, timestamps, WebVTT headers,
    formatting tags, and adjacent duplicates.
    """
    lines = raw_text.split('\n')
    cleaned_lines = []
    
    # Regex to match timestamps like "00:00:00,080 --> 00:00:02,220" or "00:00.080 --> 00:00.800"
    timestamp_re = re.compile(r'\d{2}:\d{2}.*-->.*')
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line.isdigit():  # SRT indices
            continue
        if timestamp_re.search(line):  # Timestamps
            continue
        if is_vtt and (line.startswith('WEBVTT') or line.startswith('Kind:') or line.startswith('Language:')):
            continue
        
        # Remove HTML/XML formatting tags (e.g. <c> or </c>)
        line = re.sub(r'<[^>]+>', '', line)
        line = line.strip()
        
        if line:
            cleaned_lines.append(line)
            
    # Deduplicate adjacent identical lines
    final_lines = []
    for line in cleaned_lines:
        if not final_lines or final_lines[-1] != line:
            final_lines.append(line)
            
    return "\n".join(final_lines)

def extract_video_details(
    url: str,
    sessdata: str = None,
    log_func: Callable[[str], None] = None,
    youtube_cookies: str = None
) -> Dict[str, Any]:
    """
    Downloads subtitles and metadata using yt-dlp, cleans them, and returns a details dict.
    """
    if log_func:
        log_func("【下载】开始解析视频源并提取字幕...")
        
    cookie_path = None
    lower_url = url.lower()
    if "bilibili.com" in lower_url or "b23.tv" in lower_url:
        cookie_path = create_temp_cookies(sessdata)
    elif "youtube.com" in lower_url or "youtu.be" in lower_url:
        cookie_path = create_temp_yt_cookies(youtube_cookies)
    else:
        if youtube_cookies:
            cookie_path = create_temp_yt_cookies(youtube_cookies)
        elif sessdata:
            cookie_path = create_temp_cookies(sessdata)

    if cookie_path and log_func:
        if "youtube.com" in lower_url or "youtu.be" in lower_url:
            log_func("【下载】已加载 YouTube Cookies 鉴权凭据...")
        else:
            log_func("【下载】已加载 Bilibili SESSDATA 鉴权凭据...")

    temp_dir = tempfile.gettempdir()
    
    # Define custom path for yt-dlp to look at our prebundled binary if it exists on Windows
    # or fallback to system path.
    # On Windows: C:\Users\19849\.gemini\config\skills\video-to-article-skill\component\yt-dlp.exe
    bundled_ytdlp = r"C:\Users\19849\.gemini\config\skills\video-to-article-skill\component\yt-dlp.exe"
    
    # We configure yt-dlp settings
    ydl_opts = {
        'skip_download': True,
        'writesubtitles': True,
        'writeautomaticsub': True,
        # Try downloading simplified Chinese, Chinese, automatic Chinese, and English
        'subtitleslangs': ['zh-Hans', 'zh', 'ai-zh', 'en'],
        # Template output for downloaded subtitle files
        'outtmpl': os.path.join(temp_dir, 'ytdlp_%(id)s.%(ext)s'),
        'quiet': True,
        'no_warnings': True,
    }
    
    # Use bundled yt-dlp binary if available on Windows
    if os.name == 'nt' and os.path.exists(bundled_ytdlp):
        # yt_dlp has no direct 'ffmpeg_location' or 'executable' option inside YoutubeDL, 
        # but we can set it via paths or let it fallback. Actually, importing yt_dlp uses the python library.
        pass

    if cookie_path:
        ydl_opts['cookiefile'] = cookie_path
        
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            if log_func:
                log_func("【下载】正在获取视频基础元数据...")
            info = ydl.extract_info(url, download=True)
            
            title = info.get('title', '未知视频标题')
            author = info.get('uploader', '未知作者')
            duration = info.get('duration', 0.0)
            upload_date = info.get('upload_date', '')
            thumbnail_url = info.get('thumbnail', '')
            video_id = info.get('id', '')
            
            # Format date: 20260129 -> 2026-01-29
            if len(upload_date) == 8:
                upload_date = f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:]}"
                
            if log_func:
                log_func(f"【下载】获取成功: 《{title}》 | 作者: {author} | 时长: {int(duration // 60)}分{int(duration % 60)}秒")
                
            # Scan for downloaded subtitle files
            sub_file = None
            langs = ['zh-Hans', 'zh', 'ai-zh', 'en']
            exts = ['srt', 'vtt']
            
            for lang in langs:
                for ext in exts:
                    expected_name = f"ytdlp_{video_id}.{lang}.{ext}"
                    path = os.path.join(temp_dir, expected_name)
                    if os.path.exists(path):
                        sub_file = path
                        break
                if sub_file:
                    break
                    
            # Fallback scan
            if not sub_file:
                for f in os.listdir(temp_dir):
                    if f.startswith(f"ytdlp_{video_id}") and f.endswith(('.srt', '.vtt')):
                        sub_file = os.path.join(temp_dir, f)
                        break
                        
            if not sub_file:
                raise Exception("未能找到该视频的任何字幕（CC字幕或AI生成字幕）。请确保原视频附带字幕。")
            
            is_vtt = sub_file.endswith('.vtt')
            if log_func:
                log_func(f"【下载】成功提取字幕文件: {os.path.basename(sub_file)}")
                
            with open(sub_file, 'r', encoding='utf-8', errors='ignore') as sf:
                raw_subtitle = sf.read()
                
            cleaned_subtitle = clean_subtitle(raw_subtitle, is_vtt)
            
            # Cleanup downloaded subtitle file
            try:
                os.remove(sub_file)
            except:
                pass
                
            if cookie_path and os.path.exists(cookie_path):
                try:
                    os.remove(cookie_path)
                except:
                    pass
                    
            # Extract stream url and headers for ffmpeg range-request keyframing
            stream_url = info.get('url', '')
            if not stream_url and info.get('formats'):
                video_formats = [f for f in info.get('formats', []) if f.get('vcodec') != 'none' and f.get('url')]
                if video_formats:
                    # Pick a lightweight video format URL
                    stream_url = video_formats[0].get('url', '')

            http_headers = info.get('http_headers', {})

            return {
                "title": title,
                "author": author,
                "duration": duration,
                "upload_date": upload_date,
                "thumbnail_url": thumbnail_url,
                "cleaned_text": cleaned_subtitle,
                "platform": "Bilibili" if "bilibili.com" in url or "b23.tv" in url else "YouTube",
                "stream_url": stream_url,
                "http_headers": http_headers
            }
            
    except Exception as e:
        if cookie_path and os.path.exists(cookie_path):
            try:
                os.remove(cookie_path)
            except:
                pass
        raise Exception(f"视频解析失败: {str(e)}")
