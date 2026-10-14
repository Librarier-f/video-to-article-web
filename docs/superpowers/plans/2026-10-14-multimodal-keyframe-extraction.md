# 多模态关键帧抽取与图文深度对齐实现计划 (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建免落盘 FFmpeg 流式定点抽帧、Vision Agent 视觉提炼与 Editorial Agent 图文深度对齐的多模态长文生成系统。

**Architecture:** 
1. 通过 yt-dlp 获取 Direct Stream URL，基于 FFmpeg Range-Request 在网络流中秒级定点抽帧，配合亮度与标准差防抖检测剔除黑屏；
2. 双 Agent 解耦：Planner Agent 基于字幕语义推荐 3~6 个视觉时间戳，Vision Agent（轻量 VLM）并发识别提取图表结构与图注，Editorial Agent 将图文深度缝合成稿；
3. FastAPI 挂载快照静态目录并提供级联清理，前端多主题挂载 `<figure>` 组件并支持高清点击灯箱放大。

**Tech Stack:** Python 3.13, FastAPI, yt-dlp, FFmpeg, Pillow, React 19, TypeScript, TailwindCSS

**Spec:** `docs/superpowers/specs/2026-10-14-multimodal-keyframe-extraction-design.md`

## Global Constraints

- 绝不全量下载视频文件至本地磁盘，所有抽帧必须通过 FFmpeg Range-Request 流式定点获取。
- 抽帧失败或多模态 Key 缺失时必须优雅降级为纯文本长文，绝不可导致任务中断抛错。
- 所有输出与代码注释均遵循中文规范，图片挂载严格遵循语义化 `<figure>` 标签。
- 视频删除时，对应的本地快照目录必须被同步级联清理。

## Review Focus

1. **直链防盗链过期/403**：当视频平台的 Direct Stream URL 具有时效性或需要特定 Header 时，抽帧引擎需透传 User-Agent 与 Cookies，失败时降级纯文本。
2. **全黑过渡帧/主播人脸废帧**：使用方差检测算法过滤低信息量帧，自动前后偏移 2 秒重试。
3. **并发网络竞争与锁**：多个任务同时抽帧时，快照目录按 `task_id` 绝对隔离，互不干扰。
4. **长短视频自适应**：极短视频（< 2 分钟）自动降频为 1~2 张配图，长视频（> 30 分钟）限制最多 6 张，防止图片泛滥。
5. **前端灯箱无感兼容**：在 Notion、Claude、科技黑等多种主题下，图片必须自适应居中且点击可平滑放大。

---

### Task 1: 图像处理依赖安装与免落盘流式抽帧引擎

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/services/stream_capture.py`
- Test: `backend/tests/test_stream_capture.py`

**Interfaces:**
- Produces:
  ```python
  def is_valid_frame(image_path: str, min_brightness: float = 15.0, min_stddev: float = 10.0) -> bool: ...
  def capture_single_frame(stream_url: str, timestamp_sec: int, output_path: str, headers: dict = None) -> bool: ...
  def capture_keyframes_from_stream(stream_url: str, timestamps: list[int], task_id: str, headers: dict = None) -> list[dict]: ...
  ```

- [ ] **Step 1: 安装 Pillow 依赖并更新 requirements.txt**

运行命令：
```bash
.venv\Scripts\python.exe -m pip install Pillow
```
在 `backend/requirements.txt` 中追加 `Pillow`。

- [ ] **Step 2: 编写抽帧与图像有效性检测的失败测试**

创建 `backend/tests/test_stream_capture.py`：
```python
import unittest
import os
import tempfile
from PIL import Image
from services.stream_capture import is_valid_frame

class TestStreamCapture(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()

    def test_pure_black_frame_is_invalid(self):
        black_path = os.path.join(self.test_dir, "black.jpg")
        img = Image.new("RGB", (100, 100), color=(0, 0, 0))
        img.save(black_path)
        self.assertFalse(is_valid_frame(black_path))

    def test_high_contrast_frame_is_valid(self):
        valid_path = os.path.join(self.test_dir, "valid.jpg")
        img = Image.new("RGB", (100, 100), color=(255, 255, 255))
        for x in range(50):
            for y in range(50):
                img.putpixel((x, y), (0, 0, 255))
        img.save(valid_path)
        self.assertTrue(is_valid_frame(valid_path))

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: 运行测试验证失败**

运行：
```bash
.venv\Scripts\python.exe -m unittest tests/test_stream_capture.py
```
预期：FAIL，提示 `ModuleNotFoundError: No module named 'services.stream_capture'`。

- [ ] **Step 4: 实现流式抽帧与防抖方差检测服务**

创建 `backend/services/stream_capture.py`：
```python
import os
import subprocess
import logging
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

    cmd = ["ffmpeg", "-y"]
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
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=15)
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
    captured = []

    for ts in timestamps:
        filename = f"frame_{ts}s.jpg"
        out_path = os.path.join(target_dir, filename)
        
        # Primary attempt
        success = capture_single_frame(stream_url, ts, out_path, headers)
        if success and not is_valid_frame(out_path):
            # Try jitter +2s
            capture_single_frame(stream_url, ts + 2, out_path, headers)
            if not is_valid_frame(out_path):
                # Try jitter -2s
                capture_single_frame(stream_url, max(0, ts - 2), out_path, headers)

        if os.path.exists(out_path) and is_valid_frame(out_path):
            captured.append({
                "timestamp_sec": ts,
                "relative_path": f"/api/snapshots/{task_id}/{filename}",
                "local_path": out_path
            })
            
    return captured
```

- [ ] **Step 5: 重新运行单元测试验证通过**

运行：
```bash
.venv\Scripts\python.exe -m unittest tests/test_stream_capture.py
```
预期：PASS。

- [ ] **Step 6: Git 提交**

```bash
git add backend/services/stream_capture.py backend/tests/test_stream_capture.py
git commit -m "feat: implement stream keyframe capture with variance detection"
```

---

### Task 2: Planner Agent 字幕语义高密时间戳预测服务

**Files:**
- Create: `backend/services/keyframe_planner.py`
- Test: `backend/tests/test_keyframe_planner.py`

**Interfaces:**
- Consumes: 字幕文本与视频时长
- Produces:
  ```python
  def predict_keyframe_timestamps(
      subtitles_text: str,
      duration: float,
      provider: str,
      model: str,
      keys: dict,
      api_base_url: Optional[str] = None
  ) -> list[int]: ...
  ```

- [ ] **Step 1: 编写语义预测测试**

创建 `backend/tests/test_keyframe_planner.py`：
```python
import unittest
from services.keyframe_planner import parse_timestamps_fallback, sanitize_timestamps

class TestKeyframePlanner(unittest.TestCase):
    def test_sanitize_and_deduplicate(self):
        raw = [10, 12, 120, 125, 300, 302]
        sanitized = sanitize_timestamps(raw, duration=600)
        # Should drop points within 30 seconds of each other and limit count
        self.assertIn(10, sanitized)
        self.assertNotIn(12, sanitized)
        self.assertIn(120, sanitized)
        self.assertNotIn(125, sanitized)

    def test_fallback_sampling(self):
        res = parse_timestamps_fallback(duration=600)
        self.assertTrue(len(res) >= 3)
        self.assertTrue(all(0 < t < 600 for t in res))

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 运行测试验证失败**

运行：
```bash
.venv\Scripts\python.exe -m unittest tests/test_keyframe_planner.py
```
预期：FAIL，提示 `ModuleNotFoundError: No module named 'services.keyframe_planner'`。

- [ ] **Step 3: 实现智能时间戳决策服务**

创建 `backend/services/keyframe_planner.py`：
```python
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
```

- [ ] **Step 4: 运行测试验证通过**

运行：
```bash
.venv\Scripts\python.exe -m unittest tests/test_keyframe_planner.py
```
预期：PASS。

- [ ] **Step 5: Git 提交**

```bash
git add backend/services/keyframe_planner.py backend/tests/test_keyframe_planner.py
git commit -m "feat: implement keyframe planner agent for visual timestamp prediction"
```

---

### Task 3: Vision Agent 独立轻量 VLM 视觉图注提炼服务

**Files:**
- Create: `backend/services/vision_service.py`
- Test: `backend/tests/test_vision_service.py`

**Interfaces:**
- Produces:
  ```python
  async def analyze_frame_caption(
      image_path: str,
      timestamp_sec: int,
      provider: str,
      keys: dict,
      api_base_url: Optional[str] = None
  ) -> str: ...
  ```

- [ ] **Step 1: 编写 Vision Agent 单元测试（使用 mock 模拟 VLM 调用）**

创建 `backend/tests/test_vision_service.py`：
```python
import unittest
import os
import tempfile
from PIL import Image
from services.vision_service import format_timestamp, encode_image_base64

class TestVisionService(unittest.TestCase):
    def test_format_timestamp(self):
        self.assertEqual(format_timestamp(65), "01:05")
        self.assertEqual(format_timestamp(3665), "01:01:05")

    def test_encode_image_base64(self):
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
            temp_path = f.name
        try:
            img = Image.new("RGB", (10, 10), color=(100, 100, 100))
            img.save(temp_path)
            b64 = encode_image_base64(temp_path)
            self.assertTrue(len(b64) > 0)
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 运行测试验证失败**

运行：
```bash
.venv\Scripts\python.exe -m unittest tests/test_vision_service.py
```
预期：FAIL，提示 `ModuleNotFoundError: No module named 'services.vision_service'`。

- [ ] **Step 3: 实现 Vision Agent 视觉分析提炼服务**

创建 `backend/services/vision_service.py`：
```python
import base64
import logging
import httpx
from typing import Optional

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
    provider: str,
    keys: dict,
    api_base_url: Optional[str] = None
) -> str:
    """
    Sends frame to lightweight multimodal VLM (e.g. Gemini 2.5 Flash / Qwen-VL) to extract
    concise architecture/chart captions.
    """
    time_str = format_timestamp(timestamp_sec)
    system_instruction = (
        "你是一个顶尖的技术图表与学术汇报分析专家。\n"
        "任务：观察视频关键帧截图，提炼图中的核心架构、流程分支或数据结论。\n"
        "要求：输出一段 40~70 字以内极其精炼的专业图注，直击要害，禁止废话。"
    )

    prompt = f"这是视频在 {time_str} 处的画面截图，请提炼该画面的核心图表要点或架构结论："

    # If Gemini Key is present, call Gemini 2.5 Flash multimodal
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
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    caption = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                    return caption.replace("\n", " ")
        except Exception as e:
            logger.warning(f"Gemini VLM analysis failed: {e}")

    # Fallback default caption
    return f"视频 {time_str} 处的核心架构与关键流程演示"
```

- [ ] **Step 4: 运行测试验证通过**

运行：
```bash
.venv\Scripts\python.exe -m unittest tests/test_vision_service.py
```
预期：PASS。

- [ ] **Step 5: Git 提交**

```bash
git add backend/services/vision_service.py backend/tests/test_vision_service.py
git commit -m "feat: implement Vision Agent for multimodal chart and slide captioning"
```

---

### Task 4: 静态快照路由挂载与级联清理支持

**Files:**
- Modify: `backend/main.py`
- Test: `backend/tests/test_snapshots_api.py`

**Interfaces:**
- Produces:
  - Static endpoint: `GET /api/snapshots/{task_id}/{filename}`
  - Cascade cleanup on `DELETE /api/history/{article_id}`

- [ ] **Step 1: 编写快照路由与清理测试**

创建 `backend/tests/test_snapshots_api.py`：
```python
import unittest
import os
import shutil
from fastapi.testclient import TestClient
from main import app

class TestSnapshotsAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.test_dir = os.path.join("snapshots", "test-task-123")
        os.makedirs(self.test_dir, exist_ok=True)
        with open(os.path.join(self.test_dir, "frame_10s.jpg"), "wb") as f:
            f.write(b"fake image data")

    def tearDown(self):
        if os.path.exists("snapshots/test-task-123"):
            shutil.rmtree("snapshots/test-task-123", ignore_errors=True)

    def test_serve_snapshot(self):
        resp = self.client.get("/api/snapshots/test-task-123/frame_10s.jpg")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.content, b"fake image data")

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 运行测试验证失败**

运行：
```bash
.venv\Scripts\python.exe -m unittest tests/test_snapshots_api.py
```
预期：FAIL (404 Not Found)。

- [ ] **Step 3: 在 main.py 中挂载 snapshots 静态目录并添加清理逻辑**

在 `backend/main.py` 中：
1. 导入 `from fastapi.staticfiles import StaticFiles`
2. 确保 `os.makedirs("snapshots", exist_ok=True)`
3. 挂载：`app.mount("/api/snapshots", StaticFiles(directory="snapshots"), name="snapshots")`
4. 在 `delete_article` 端点中，级联删除 `snapshots/{task.id}` 目录。

- [ ] **Step 4: 运行测试验证通过**

运行：
```bash
.venv\Scripts\python.exe -m unittest tests/test_snapshots_api.py
```
预期：PASS。

- [ ] **Step 5: Git 提交**

```bash
git add backend/main.py backend/tests/test_snapshots_api.py
git commit -m "feat: mount static snapshots route and add cascade cleanup"
```

---

### Task 5: 主流程端到端集成 (Generator Pipeline Integration)

**Files:**
- Create: `backend/services/layout_enricher.py`
- Modify: `backend/services/converter.py` (提取 Direct Stream URL)
- Modify: `backend/services/generator.py` (串联各 Agent)
- Test: `backend/tests/test_multimodal_generator.py`

**Interfaces:**
- Consumes: `StreamCaptureService`, `KeyframePlanner`, `VisionService`
- Produces: 含有精准 `<figure>` 时序图表的精美 HTML/Markdown 文章

- [ ] **Step 1: 编写 Layout Enricher 规范测试**

创建 `backend/tests/test_multimodal_generator.py`：
```python
import unittest
from services.layout_enricher import build_visual_context_prompt

class TestLayoutEnricher(unittest.TestCase):
    def test_build_visual_context_prompt(self):
        frames = [
            {
                "timestamp_sec": 125,
                "relative_path": "/api/snapshots/task1/frame_125s.jpg",
                "caption": "核心微服务交互架构图"
            }
        ]
        prompt = build_visual_context_prompt(frames)
        self.assertIn("02:05", prompt)
        self.assertIn("核心微服务交互架构图", prompt)
        self.assertIn("<figure", prompt)

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 运行测试验证失败**

运行：
```bash
.venv\Scripts\python.exe -m unittest tests/test_multimodal_generator.py
```
预期：FAIL。

- [ ] **Step 3: 实现 Layout Enricher**

创建 `backend/services/layout_enricher.py`：
```python
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
        "\n\n【重要：本文配有以下高价值视频截图图表，请在讲解到对应时间节点的论点后，严格使用以下 HTML figure 模板将其嵌入正文】：\n"
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

    lines.append("要求：每个图表必须自然融入对应章节段落之间，图文互证，不要将图片集中堆在开头或末尾。\n")
    return "\n".join(lines)
```

- [ ] **Step 4: 在 converter.py 中增加 Direct Stream URL 提取**

修改 `backend/services/converter.py` 中的 `extract_video_details`：
在 yt-dlp 配置与提取阶段，获取 `stream_url = info.get('url')`，并返回在 `details` 字典中：
```python
"stream_url": info.get('url', '')
```

- [ ] **Step 5: 在 generator.py 中完整串联多模态流水线**

在 `generate_article_task` 中：
1. 提取视频元数据与字幕后，调用 `predict_keyframe_timestamps` 预测 3~6 个时间戳；
2. 如果存在 `stream_url`，调用 `capture_keyframes_from_stream` 获取本地关键帧；
3. 对抽出的关键帧并发调用 `analyze_frame_caption` 生成图注；
4. 调用 `build_visual_context_prompt` 组装图文时序 Prompt；
5. Editorial Agent 生成带图文章并保存至数据库。

- [ ] **Step 6: 运行测试验证通过**

运行：
```bash
.venv\Scripts\python.exe -m unittest tests/test_multimodal_generator.py
```
预期：PASS。

- [ ] **Step 7: Git 提交**

```bash
git add backend/services/layout_enricher.py backend/services/converter.py backend/services/generator.py backend/tests/test_multimodal_generator.py
git commit -m "feat: integrate multimodal keyframe pipeline into article generator"
```

---

### Task 6: 前端排版主题支持与交互式高清灯箱 (Lightbox UX)

**Files:**
- Modify: `frontend/src/components/ArticlePreview.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: 在 index.css 中增加 `<figure>` 与 `<figcaption>` 美化样式**

定义 Notion 深色、蓝白商务、Claude 赭石等各风格下 `.article-figure` 的微质感边框、圆角、阴影与悬停效果：
```css
.article-figure {
  margin: 1.5rem 0;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--border-bezel, rgba(255, 255, 255, 0.08));
  background: var(--bg-card, rgba(255, 255, 255, 0.02));
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.article-figure img {
  width: 100%;
  max-height: 480px;
  object-fit: cover;
  display: block;
  cursor: zoom-in;
}
.article-figure figcaption {
  padding: 0.6rem 1rem;
  font-size: 0.75rem;
  color: var(--text-muted, #888);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-top: 1px solid var(--border-card, rgba(255, 255, 255, 0.05));
}
.fig-badge {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  padding: 2px 6px;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 600;
}
```

- [ ] **Step 2: 在 ArticlePreview.tsx 中实现无依赖高清图片全屏灯箱**

在 `ArticlePreview.tsx` 中：
1. 添加 `activeLightboxImage: string | null` 状态；
2. 在 `useEffect` 中监听文章容器内部点击事件，当点击 `FIGURE IMG` 时，自动弹出带有淡入模糊效果的全屏 Lightbox，支持点击遮罩关闭或 ESC 键退出；
3. 提供全屏高清无损视图，让读者可以放大细看架构图里的代码与流程细节。

- [ ] **Step 3: 验证前端构建与类型检查**

运行命令：
```bash
cmd /c "npm run build"
```
预期：0 错误，生产包成功打包。

- [ ] **Step 4: Git 提交**

```bash
git add frontend/src/components/ArticlePreview.tsx frontend/src/index.css
git commit -m "feat: add responsive figure layout and interactive image lightbox"
```
