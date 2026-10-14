import os
import re
import json
import logging
import tempfile
import urllib.request
import yt_dlp
from typing import Callable, Dict, Any, Optional, Tuple

logger = logging.getLogger("video-to-article.converter")

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

def normalize_yt_cookies(raw_cookies: str) -> Tuple[str, bool]:
    """
    Normalizes YouTube cookies from JSON, key-value header, or standard Netscape text
    into a valid Netscape-formatted string, and detects whether it contains logged-in tokens.
    """
    text = raw_cookies.strip()
    if not text:
        return "", False

    # Check for presence of authenticated user session tokens
    auth_tokens = ["SID", "SAPISID", "LOGIN_INFO", "__Secure-1PSID", "__Secure-3PSID", "SSID", "HSID"]
    has_auth = any(token in text for token in auth_tokens)

    # 1. JSON Format (e.g. Cookie-Editor / EditThisCookie export)
    if text.startswith("[") and text.endswith("]"):
        try:
            items = json.loads(text)
            lines = ["# Netscape HTTP Cookie File"]
            for item in items:
                domain = item.get("domain", ".youtube.com")
                flag = "TRUE" if domain.startswith(".") else "FALSE"
                path = item.get("path", "/")
                secure = "TRUE" if item.get("secure", False) else "FALSE"
                expiration = str(int(item.get("expirationDate", 2147483647)))
                name = item.get("name", "")
                value = item.get("value", "")
                if name:
                    lines.append(f"{domain}\t{flag}\t{path}\t{secure}\t{expiration}\t{name}\t{value}")
            return "\n".join(lines) + "\n", has_auth
        except Exception:
            pass

    # 2. Standard Netscape Format (contains tab delimiters)
    if "\t" in text:
        lines = []
        if not text.startswith("# Netscape HTTP Cookie File"):
            lines.append("# Netscape HTTP Cookie File")
        for line in text.splitlines():
            clean = line.strip()
            if not clean:
                continue
            if clean.startswith("#") and not clean.startswith("# Netscape"):
                continue
            lines.append(clean)
        return "\n".join(lines) + "\n", has_auth

    # 3. Raw header string (key=value; key=value)
    if "=" in text:
        lines = ["# Netscape HTTP Cookie File"]
        tokens = [t.strip() for t in text.replace("\n", ";").split(";") if t.strip()]
        for token in tokens:
            if "=" in token:
                k, v = token.split("=", 1)
                k = k.strip()
                v = v.strip()
                if k:
                    lines.append(f".youtube.com\tTRUE\t/\tTRUE\t2147483647\t{k}\t{v}")
                    lines.append(f".google.com\tTRUE\t/\tTRUE\t2147483647\t{k}\t{v}")
        return "\n".join(lines) + "\n", has_auth

    # Fallback as plain string with header
    if not text.startswith("# Netscape HTTP Cookie File"):
        text = "# Netscape HTTP Cookie File\n" + text
    if not text.endswith("\n"):
        text += "\n"
    return text, has_auth

def create_temp_yt_cookies(youtube_cookies: str) -> Tuple[Optional[str], bool]:
    """
    Creates a temporary Netscape-formatted cookies file using the uploaded YouTube cookies content,
    and returns (file_path, is_authenticated).
    """
    if not youtube_cookies or not youtube_cookies.strip():
        return None, False
    
    content, is_authenticated = normalize_yt_cookies(youtube_cookies)
    if not content.strip():
        return None, False
        
    fd, path = tempfile.mkstemp(suffix="_cookies.txt", prefix="yt_")
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        f.write(content)
    return path, is_authenticated

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
    is_authenticated = False
    lower_url = url.lower()
    if "bilibili.com" in lower_url or "b23.tv" in lower_url:
        cookie_path = create_temp_cookies(sessdata)
    elif "youtube.com" in lower_url or "youtu.be" in lower_url:
        cookie_path, is_authenticated = create_temp_yt_cookies(youtube_cookies)
    else:
        if youtube_cookies:
            cookie_path, is_authenticated = create_temp_yt_cookies(youtube_cookies)
        elif sessdata:
            cookie_path = create_temp_cookies(sessdata)

    if cookie_path and log_func:
        if "youtube.com" in lower_url or "youtu.be" in lower_url:
            if is_authenticated:
                log_func("【下载】已加载 YouTube Cookies 鉴权凭据（检测到有效登录态 SID/LOGIN_INFO）...")
            else:
                log_func("【下载】已加载 YouTube Cookies，⚠️ 警告：未检测到有效账号登录凭证(如 SID/LOGIN_INFO)，若被风控拦截请使用已登录账号导出的 Cookies...")
        else:
            log_func("【下载】已加载 Bilibili SESSDATA 鉴权凭据...")

    temp_dir = tempfile.gettempdir()
    
    # We configure modern yt-dlp settings
    ydl_opts = {
        'skip_download': True,
        'writesubtitles': True,
        'writeautomaticsub': True,
        # Try downloading simplified Chinese, Chinese, automatic Chinese, and English
        'subtitleslangs': ['zh-Hans', 'zh', 'ai-zh', 'en', 'en-orig'],
        # Template output for downloaded subtitle files
        'outtmpl': os.path.join(temp_dir, 'ytdlp_%(id)s.%(ext)s'),
        'quiet': True,
        'no_warnings': True,
        'js_runtimes': {'node': {}},
        'format': 'best/bestvideo+bestaudio/worst',
        'ignore_no_formats_error': True,
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
            'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        },
    }

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

            # Second fallback: If yt-dlp did not write subtitle file to disk, try downloading directly from track URLs
            if not sub_file:
                subs = info.get('subtitles') or {}
                auto_subs = info.get('automatic_captions') or {}
                for target_lang in ['zh-Hans', 'zh', 'ai-zh', 'en', 'en-orig']:
                    tracks = subs.get(target_lang) or auto_subs.get(target_lang) or []
                    if tracks:
                        best_track = next((t for t in tracks if t.get('ext') in ('vtt', 'srt')), tracks[0])
                        sub_url = best_track.get('url')
                        if sub_url:
                            try:
                                sub_ext = best_track.get('ext', 'vtt')
                                fallback_path = os.path.join(temp_dir, f"ytdlp_{video_id}.{target_lang}.{sub_ext}")
                                req = urllib.request.Request(sub_url, headers=ydl_opts.get('http_headers', {}))
                                with urllib.request.urlopen(req, timeout=15) as resp:
                                    with open(fallback_path, 'wb') as out_f:
                                        out_f.write(resp.read())
                                if os.path.exists(fallback_path) and os.path.getsize(fallback_path) > 0:
                                    sub_file = fallback_path
                                    break
                            except Exception as dl_err:
                                logger.warning(f"Direct subtitle URL download failed for {target_lang}: {dl_err}")

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
        err_msg = str(e)
        if "Sign in to confirm you’re not a bot" in err_msg or "Sign in to confirm you're not a bot" in err_msg:
            friendly_err = (
                "YouTube 触发了严格的人机验证拦截（Sign in to confirm you're not a bot）。\n\n"
                "【解决方案】：\n"
                "1. 请确认导出的 Cookies 是否来自【已登录 YouTube/Google 账号】的浏览器页面；\n"
                "2. 推荐在 Chrome / Edge 中安装扩展【Get cookies.txt LOCALLY】（或使用 Cookie-Editor 导出为 Netscape 格式）；\n"
                "3. 保持 YouTube 页面处于登录状态，点击扩展导出 cookies.txt，并在本系统重新上传；\n"
                "4. 若已上传且包含登录态仍被拦截，说明当前代理节点/IP 已被 YouTube 临时拉黑，建议切换科学上网节点或断开后重连重试。"
            )
            raise Exception(friendly_err)
        raise Exception(f"视频解析失败: {err_msg}")

