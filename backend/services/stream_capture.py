import os
import subprocess
import logging
from time import monotonic
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Any, Optional
from PIL import Image, ImageStat

logger = logging.getLogger("video-to-article.stream_capture")

def is_valid_frame(image_path: str, min_brightness: float = 15.0, min_stddev: float = 10.0) -> bool:
    """
    Checks if the frame contains valid visible content (not a black screen or solid color transition).
    """
    if not os.path.exists(image_path) or os.path.getsize(image_path) == 0:
        return False
    try:
        with Image.open(image_path) as img:
            gray = img.convert("L")
            stat = ImageStat.Stat(gray)
            mean_brightness = stat.mean[0]
            stddev = stat.stddev[0]
            if mean_brightness < min_brightness:
                return False
            if stddev < min_stddev:
                return False
            return True
    except Exception as e:
        logger.warning(f"Failed to analyze frame {image_path}: {e}")
        return False

def capture_single_frame(
    stream_url: str,
    timestamp_sec: int,
    output_path: str,
    headers: Optional[Dict[str, str]] = None
) -> bool:
    """
    Extracts a single frame from the direct stream URL using FFmpeg without downloading the video.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    header_str = ""
    if headers:
        header_str = "".join([f"{k}: {v}\r\n" for k, v in headers.items()])

    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
    if header_str:
        cmd.extend(["-headers", header_str])
        
    cmd.extend([
        "-ss", str(timestamp_sec),
        "-i", stream_url,
        "-frames:v", "1",
        "-q:v", "2",
        output_path
    ])

    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=12)
        return res.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 0
    except Exception as e:
        logger.error(f"FFmpeg stream capture failed at {timestamp_sec}s: {e}")
        return False

def capture_keyframes_from_stream(
    stream_url: str,
    timestamps: List[int],
    task_id: str,
    base_dir: str = "snapshots",
    headers: Optional[Dict[str, str]] = None
) -> List[Dict[str, Any]]:
    """
    Extracts keyframes for a list of timestamps, applying automatic ±2s offset retry on black frames.
    """
    target_dir = os.path.join(base_dir, task_id)
    os.makedirs(target_dir, exist_ok=True)
    deadline = monotonic() + 30.0
    def capture(ts):
        if monotonic() >= deadline:
            return None
        filename = f"frame_{ts}s.jpg"
        out_path = os.path.join(target_dir, filename)
        
        # Primary attempt
        success = capture_single_frame(stream_url, ts, out_path, headers)
        if success and not is_valid_frame(out_path) and monotonic() < deadline:
            # Try jitter +2s
            capture_single_frame(stream_url, ts + 2, out_path, headers)
            if not is_valid_frame(out_path) and monotonic() < deadline:
                # Try jitter -2s
                capture_single_frame(stream_url, max(0, ts - 2), out_path, headers)

        if os.path.exists(out_path) and is_valid_frame(out_path):
            return {
                "timestamp_sec": ts,
                "relative_path": f"/api/snapshots/{task_id}/{filename}",
                "local_path": out_path
            }
        return None

    # Two independent range requests overlap network waits without spawning a
    # process per timestamp all at once. executor.map preserves input order.
    with ThreadPoolExecutor(max_workers=2) as executor:
        return [frame for frame in executor.map(capture, dict.fromkeys(timestamps)) if frame]
