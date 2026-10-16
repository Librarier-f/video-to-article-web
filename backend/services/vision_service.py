import base64
import logging
import httpx
from typing import Optional
from services.llm_service import request_client, build_chat_completions_url

logger = logging.getLogger("video-to-article.vision")

def format_timestamp(seconds: int) -> str:
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"

def encode_image_base64(image_path: str) -> str:
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")

async def analyze_frame_caption(
    image_path: str,
    timestamp_sec: int,
    keys: dict,
    api_base_url: Optional[str] = None
) -> str:
    """
    Sends frame to lightweight multimodal VLM (e.g. Gemini 2.5 Flash / OpenAI-compatible / Qwen-VL)
    to extract concise architecture, table, or code diagram captions.
    """
    time_str = format_timestamp(timestamp_sec)
    system_instruction = (
        "你是一个顶尖的技术图表与学术汇报分析专家。\n"
        "任务：观察视频关键帧截图，提炼图中的核心架构、流程分支或数据结论。\n"
        "要求：输出一段 40~70 字以内极其精炼的专业图注，直击要害，禁止废话。"
    )

    prompt = f"这是视频在 {time_str} 处的画面截图，请提炼该画面的核心图表要点或架构结论："

    # 1. Try Gemini 2.5 Flash Multimodal if key exists
    gemini_key = keys.get("x-gemini-key")
    if gemini_key:
        try:
            b64_data = encode_image_base64(image_path)
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
            payload = {
                "contents": [{
                    "parts": [
                        {"text": f"{system_instruction}\n\n{prompt}"},
                        {
                            "inline_data": {
                                "mime_type": "image/jpeg",
                                "data": b64_data
                            }
                        }
                    ]
                }]
            }
            async with request_client(httpx.Timeout(25.0)) as client:
                res = await client.post(url, json=payload, timeout=25.0)
                if res.status_code == 200:
                    data = res.json()
                    caption = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                    return caption.replace("\n", " ").strip()
        except Exception as e:
            logger.warning(f"Gemini VLM analysis failed: {e}")

    # 2. Try OpenAI-compatible VLM if OpenAI key exists
    # A custom text API does not imply gpt-4o-mini/vision support.
    openai_key = keys.get("x-openai-key")
    if openai_key:
        try:
            b64_data = encode_image_base64(image_path)
            url = build_chat_completions_url("https://api.openai.com/v1")
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": system_instruction},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{b64_data}"
                                }
                            }
                        ]
                    }
                ],
                "max_tokens": 150
            }
            headers = {
                "Authorization": f"Bearer {openai_key}",
                "Content-Type": "application/json"
            }
            async with request_client(httpx.Timeout(25.0)) as client:
                res = await client.post(url, json=payload, headers=headers, timeout=25.0)
                if res.status_code == 200:
                    data = res.json()
                    caption = data["choices"][0]["message"]["content"].strip()
                    return caption.replace("\n", " ").strip()
        except Exception as e:
            logger.warning(f"OpenAI-compatible VLM analysis failed: {e}")

    # 3. Fallback default caption
    return f"视频 {time_str} 处截图（未进行视觉内容识别）"
