import os
import re
import json
import logging
import tempfile
import yt_dlp
from yt_dlp.networking import Request
from typing import Callable, Dict, Any, Optional, Tuple

logger = logging.getLogger("video-to-article.converter")

import uuid
import time

def create_temp_cookies(sessdata: str = None) -> Optional[str]:
    """
    Creates a temporary Netscape-formatted cookies file for Bilibili.
    Injects device tracking tokens (buvid3, b_nut, _uuid) to mitigate WAF 412 Precondition Failed,
    and supports raw SESSDATA tokens or full cookie key-value strings.
    """
    b_nut = str(int(time.time()))
    buvid3 = f"{uuid.uuid4().hex.upper()}infoc"
    _uuid = str(uuid.uuid4())
    
    cookies = {
        "buvid3": buvid3,
        "b_nut": b_nut,
        "_uuid": _uuid,
    }
    
    if sessdata and sessdata.strip():
        text = sessdata.strip()
        if text.lower().startswith("cookie:"):
            text = text[7:].strip()
        if "=" in text:
            tokens = [t.strip() for t in text.replace("\n", ";").split(";") if t.strip()]
            for token in tokens:
                if "=" in token:
                    k, v = token.split("=", 1)
                    k, v = k.strip(), v.strip().strip('"\'')
                    if k:
                        cookies[k] = v
        else:
            cookies["SESSDATA"] = text.strip('"\'')

    lines = ["# Netscape HTTP Cookie File"]
    for k, v in cookies.items():
        lines.append(f".bilibili.com\tTRUE\t/\tTRUE\t2147483647\t{k}\t{v}")

    fd, path = tempfile.mkstemp(suffix="_cookies.txt", prefix="bili_")
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        f.write("\n".join(lines) + "\n")
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

    # We configure modern yt-dlp settings
    ydl_opts = {
        'skip_download': True,
        # These enable discovery in InfoExtractor.extract_subtitles and
        # extract_automatic_captions. download=False below still prevents
        # YoutubeDL from writing subtitle/video files during extraction.
        'writesubtitles': True,
        'writeautomaticsub': True,
        # Preferred languages for choosing a discovered track below.
        'subtitleslangs': ['zh-Hans', 'zh', 'ai-zh', 'en', 'en-orig'],
        'noplaylist': True,
        'socket_timeout': 20,
        'retries': 1,
        'extractor_retries': 1,
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

    if "bilibili.com" in lower_url or "b23.tv" in lower_url:
        ydl_opts['http_headers']['Referer'] = 'https://www.bilibili.com/'

    if cookie_path:
        ydl_opts['cookiefile'] = cookie_path
        
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            if log_func:
                log_func("【下载】正在获取视频基础元数据...")
            info = ydl.extract_info(url, download=False)
            if not info or info.get("_type") == "playlist":
                raise ValueError("请提供单个视频的有效链接。")
            
            title = info.get('title', '未知视频标题')
            author = info.get('uploader', '未知作者')
            duration = info.get('duration') or 0.0
            upload_date = info.get('upload_date') or ''
            thumbnail_url = info.get('thumbnail', '')
            
            # Format date: 20260129 -> 2026-01-29
            if len(upload_date) == 8:
                upload_date = f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:]}"
                
            if log_func:
                log_func(f"【下载】获取成功: 《{title}》 | 作者: {author} | 时长: {int(duration // 60)}分{int(duration % 60)}秒")
                
            # Fetch exactly one usable track using yt-dlp's authenticated
            # session. No shared subtitle files or scanning the temp directory.
            subs = info.get('subtitles') or {}
            auto_subs = info.get('automatic_captions') or {}
            languages = list(dict.fromkeys(['zh-Hans', 'zh', 'ai-zh', 'en', 'en-orig'] + list(subs) + list(auto_subs)))
            available_languages = [lang for lang in languages if lang != 'danmaku' and (subs.get(lang) or auto_subs.get(lang))]
            if log_func:
                log_func(f"【字幕】已发现轨道：{', '.join(available_languages) if available_languages else '未返回字幕轨道'}")
            cleaned_subtitle = ""
            attempts = 0
            failures = []
            for lang in languages:
                tracks = (subs.get(lang) or []) + (auto_subs.get(lang) or [])
                supported = [track for track in tracks if (track.get('url') or track.get('data')) and track.get('ext') in ('vtt', 'srt', 'json3', 'json')]
                ranked = sorted(supported, key=lambda track: (not bool(track.get('data')), ['vtt', 'srt', 'json3', 'json'].index(track['ext'])))
                if not ranked:
                    continue
                for track in ranked:
                    attempts += 1
                    try:
                        raw = track.get('data')
                        if not raw:
                            headers = {**ydl_opts['http_headers'], **(info.get('http_headers') or {}), **(track.get('http_headers') or {})}
                            request = Request(track['url'], headers=headers)
                            with ydl.urlopen(request) as response:
                                raw = response.read()
                        if isinstance(raw, bytes):
                            raw = raw.decode('utf-8-sig', errors='replace')
                        ext = track['ext']
                        if ext == 'json3':
                            data = json.loads(raw)
                            raw = '\n'.join(''.join(part.get('utf8', '') for part in event.get('segs', [])) for event in data.get('events', []))
                        elif ext == 'json':
                            data = json.loads(raw)
                            raw = '\n'.join(item.get('content', '') for item in data.get('body', []))
                        cleaned_subtitle = clean_subtitle(raw, is_vtt=ext == 'vtt')
                        if cleaned_subtitle:
                            if log_func:
                                log_func(f"【下载】已读取 {lang} 字幕（{ext}），跳过其余语言轨道。")
                            break
                        failures.append(f"{lang}: 字幕内容为空")
                    except Exception as exc:
                        status_code = getattr(exc, 'status', None) or getattr(exc, 'code', None)
                        reason = type(exc).__name__ + (f" HTTP {status_code}" if isinstance(status_code, int) else "")
                        failures.append(f"{lang}: {reason}")
                        logger.warning("Subtitle track failed (%s, %s)", lang, reason)
                        if log_func:
                            log_func(f"【字幕】{lang} 读取失败：{reason}，尝试其他可用轨道。")
                    if attempts >= 3:
                        break
                if cleaned_subtitle or attempts >= 3:
                    break
            if not cleaned_subtitle:
                if available_languages:
                    detail = '；'.join(failures) or '轨道格式不受支持或未返回字幕内容'
                    raise ValueError(f"已发现字幕（{', '.join(available_languages)}），但读取失败：{detail}。请检查网络与登录凭据。")
                hint = "请检查 B 站 SESSDATA 是否有效，登录后可见的 AI 字幕需要有效登录态。" if 'bilibili.com' in lower_url or 'b23.tv' in lower_url else "请检查视频字幕权限和登录 Cookies。"
                raise ValueError(f"视频平台未返回字幕轨道。{hint}")
                
            # Extract stream url and headers for ffmpeg range-request keyframing
            stream_url = info.get('url', '')
            video_formats = [f for f in info.get('formats', [])
                             if f.get('vcodec') not in (None, 'none') and f.get('url')
                             and f.get('protocol') in ('http', 'https') and f.get('height')]
            if video_formats:
                stream_url = min(video_formats, key=lambda f: (f['height'] > 720, abs(f['height'] - 480))).get('url', stream_url)

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
        if "412" in err_msg or "Precondition Failed" in err_msg:
            friendly_err = (
                "Bilibili 触发了机房安全风控拦截 (HTTP Error 412: Precondition Failed)。\n\n"
                "【原因与解决方案】：\n"
                "当前服务部署在云服务器机房 IP，B 站 WAF 限制了未登录机房 IP 的直接请求。\n"
                "1. 请在页面下方的「Bilibili SESSDATA Cookie」输入框中填入你登录 B 站后的 SESSDATA（或完整 Cookie 字符串）；\n"
                "2. 获取方式：浏览器登录 B 站 ➔ 按 F12 打开开发者工具 ➔ Application/应用 ➔ Cookies ➔ bilibili.com ➔ 复制 SESSDATA 列的值；\n"
                "3. 填入后重新点击「立即转换」即可顺畅解析并提取字幕！"
            )
            raise Exception(friendly_err)
        raise Exception(f"视频解析失败: {err_msg}")
    finally:
        # YoutubeDL may save its cookie jar on exit, so clean up afterwards.
        if cookie_path and os.path.exists(cookie_path):
            os.remove(cookie_path)

