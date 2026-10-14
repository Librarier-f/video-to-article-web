from typing import List, Dict, Any
from services.vision_service import format_timestamp

def build_visual_context_prompt(frames: List[Dict[str, Any]]) -> str:
    """
    Constructs visual guidance instructions so the Editorial Agent embeds relevant
    figures naturally around matching timestamps.
    """
    if not frames:
        return ""

    lines = [
        "\n\n【重要：系统已通过流式截帧与多模态 VLM 为本文成功提取以下高价值视频截图与图表，请在讲解到对应时间节点的论点后，严格使用以下 HTML figure 模板将其嵌入正文】：\n"
    ]

    for f in frames:
        ts = f["timestamp_sec"]
        time_str = format_timestamp(ts)
        url = f["relative_path"]
        cap = f.get("caption", "核心内容演示")
        template = (
            f"▼ 对应时间点 [{time_str}]：\n"
            f'<figure class="article-figure">\n'
            f'  <img src="{url}" alt="{cap}" loading="lazy" />\n'
            f'  <figcaption>\n'
            f'    <span class="fig-badge">⏱️ {time_str}</span>\n'
            f'    <strong>图：</strong>{cap}\n'
            f'  </figcaption>\n'
            f'</figure>\n'
        )
        lines.append(template)

    lines.append("【排版要求】：每个图表必须自然融入对应章节段落之间，图文互证。严禁将所有图片集中堆在开头或末尾，必须在讲到该节点时才展示对应图表。\n")
    return "\n".join(lines)
