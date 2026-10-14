import json
import re
import logging
from typing import List, Optional
from services.llm_service import call_llm_api

logger = logging.getLogger("video-to-article.planner")

def sanitize_timestamps(raw_timestamps: List[int], duration: float, min_interval: int = 35) -> List[int]:
    """Sorts, deduplicates, and removes points that are too close to each other or exceed duration."""
    valid = sorted(list(set([t for t in raw_timestamps if 5 < t < max(10, duration - 5)])))
    res = []
    for t in valid:
        if not res or (t - res[-1] >= min_interval):
            res.append(t)
    return res[:6]

def parse_timestamps_fallback(duration: float) -> List[int]:
    """Generates evenly spaced keyframes when LLM prediction is empty or fails."""
    if duration <= 120:
        return [int(duration * 0.5)]
    elif duration <= 600:
        return [int(duration * 0.25), int(duration * 0.5), int(duration * 0.75)]
    else:
        return [
            int(duration * 0.15),
            int(duration * 0.35),
            int(duration * 0.55),
            int(duration * 0.75)
        ]

async def predict_keyframe_timestamps(
    subtitles_text: str,
    duration: float,
    provider: str,
    model: str,
    keys: dict,
    api_base_url: Optional[str] = None
) -> List[int]:
    """
    Uses LLM to scan subtitle text and extract 3-6 timestamps where architecture diagrams,
    charts, tables, or critical visual slides are demonstrated.
    """
    if duration <= 60:
        return []

    # Take first 15000 characters of subtitle text to inspect
    sample_text = subtitles_text[:15000]

    system_prompt = (
        "你是一个视频画面与结构分析助手。\n"
        "任务：根据字幕文本中涉及展示、PPT、架构图、表格、数据对比、演示的表述，推荐 3~6 个最需要截图佐证的视频时间戳（以秒数表示）。\n"
        "输出格式：必须严格返回 JSON 数组，例如：[65, 180, 420]，禁止返回任何 markdown 标记或其他多余文字。"
    )

    user_prompt = (
        f"视频总时长为 {int(duration)} 秒。以下为视频字幕内容：\n\n"
        f"{sample_text}\n\n"
        "请返回最值得截取架构图或演示页面的时间戳（秒）JSON 整数列表："
    )

    try:
        content, _ = await call_llm_api(provider, model, user_prompt, system_prompt, keys, api_base_url)
        cleaned = content.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(cleaned)
        if isinstance(parsed, list):
            ints = [int(x) for x in parsed if isinstance(x, (int, float))]
            res = sanitize_timestamps(ints, duration)
            if res:
                return res
    except Exception as e:
        logger.warning(f"LLM timestamp prediction failed, using fallback: {e}")

    return parse_timestamps_fallback(duration)
