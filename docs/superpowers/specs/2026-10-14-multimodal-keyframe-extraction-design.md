# 技术方案设计文档：多模态视频关键帧抽取与图文深度对齐系统

- **版本**：v1.0.0
- **日期**：2026-10-14
- **状态**：已评审 (Approved)
- **目标场景**：AI 智能应用工程（LLM Application Engineering）核心杀手级特性

---

## 1. 背景与目标 (Background & Objectives)

### 1.1 现状与痛点
当前的“视频转文章”系统主要依赖原视频的文本字幕进行长文提炼与润色。然而，对于绝大多数高价值的视频内容（如系统架构演讲、技术发布会、财报与行业分析、代码演示等），**最核心的信息密度与论据集中在视频画面的 PPT、流程图与代码截图上**。纯文本转换会导致文章空洞乏味、缺乏关键佐证。

若采用常规的“先下载完整高画质视频到服务器，再本地抽帧”的方案，会导致：
1. **网络与磁盘成本极高**：长视频动辄数百 MB 乃至数 GB，下载耗时数分钟，磁盘极易爆满；
2. **处理延迟过长**：无法在 Web 端为用户提供轻快、实时的转换体验。

### 1.2 建设目标
1. **免落盘秒级定点抽帧 (Zero-Disk Stream Extraction)**：利用 `yt-dlp` 获取视频 Direct Stream URL，结合 `FFmpeg` 的 HTTP Range-Request 协议特性，直接在远程流中秒级定位抽帧，零全量视频落盘，单次抽帧仅需 1~2 秒。
2. **语义驱动的关键帧决策 (Semantic-Driven Scheduling)**：通过规划阶段的 LLM 自动通读带时间戳的字幕，识别出 3~6 个最具视觉佐证价值的时间戳（如讲解架构图、对比表、核心图例的时间节点）。
3. **主笔与视觉双 Agent 解耦架构 (Dual-Agent Separation)**：
   - **Vision Agent**（轻量极速多模态 VLM，如 Gemini 2.5 Flash / Qwen2-VL）：专职负责图像的 OCR 与核心结构解析，输出高信息密度的专业图注（Caption）。
   - **Editorial Agent**（主笔大模型）：负责将文字与视觉元数据深度融合成稿，在对应段落嵌入带有时间戳的 `<figure>` 图文组件。
4. **高质量前端交互与灯箱查看 (UX Lightbox)**：在生成的各排版主题中优雅挂载图表，支持点击全屏高清灯箱（Lightbox）查看与原视频时间戳溯源。

---

## 2. 系统架构与模块划分 (Architecture & Modules)

```mermaid
flowchart TD
    subgraph Client [前端与客户端]
        UI[Web 提交页面]
        Reader[文章阅读器 + 高清灯箱 Lightbox]
    end

    subgraph Backend [FastAPI 后端系统]
        subgraph Stage1 [Phase 1: 视频解析与语义规划]
            YTDL[yt-dlp 抓取字幕与 Direct Stream URL]
            Planner[Planner Agent: 语义预测视觉爆发点]
        end

        subgraph Stage2 [Phase 2: 免落盘流式定点抽帧]
            FFMPEG[FFmpeg Range-Request 引擎]
            Detector[黑屏/转场方差检测器 (防抖微调 ±2s)]
            Storage[静态快照缓存 /snapshots/task_id/]
        end

        subgraph Stage3 [Phase 3: 双 Agent 图文融合]
            VisionAgent[Vision Agent (Gemini Flash / Qwen-VL)]
            EditorialAgent[Editorial Agent (DeepSeek / Claude)]
        end
    end

    UI --> YTDL
    YTDL --> Planner
    YTDL & Planner --> FFMPEG
    FFMPEG --> Detector --> Storage
    Storage --> VisionAgent
    VisionAgent & Planner --> EditorialAgent
    EditorialAgent --> Reader
```

### 2.1 模块职责划分

| 模块名称 | 文件路径 | 职责说明 |
| :--- | :--- | :--- |
| **StreamCaptureService** | `backend/services/stream_capture.py` | 负责 Direct Stream URL 的解析与基于 FFmpeg 的网络定点抽帧，内置黑屏检测与自动平移容错。 |
| **VisionAnalysisService** | `backend/services/vision_service.py` | 负责调度轻量多模态模型（Gemini 2.5 Flash / Qwen2-VL 等），并发分析关键帧图像并提炼专业图注。 |
| **LayoutEnricher** | `backend/services/layout_enricher.py` | 负责构建包含图文时序元数据的 Prompt，指导 Editorial Agent 在对应段落注入标准 `<figure>` 标签。 |
| **Static Snapshots Mount** | `backend/main.py` | 在 FastAPI 中挂载 `/api/snapshots/{task_id}/{filename}` 静态安全路由，支持前端访问与缓存。 |
| **Frontend Lightbox** | `frontend/src/components/ArticlePreview.tsx` | 为所有文章渲染出的 `<figure> <img>` 提供轻量级灯箱放大交互。 |

---

## 3. 核心技术实现细节 (Technical Specifications)

### 3.1 FFmpeg Range-Request 免落盘流式定点抽帧机制
在提取视频时，yt-dlp 可以获取包含音视频直接流的 URL（通常为带签名凭据的 HTTPS 直链，且包含 Cookies 和 User-Agent）。
我们执行的无落盘截帧命令如下：
```bash
ffmpeg -ss {seconds} -headers "{headers_and_cookies}" -i "{direct_stream_url}" -frames:v 1 -q:v 2 -update 1 "{output_path}" -y
```
- **Range-Request 机制**：`-ss` 参数置于 `-i` 之前，FFmpeg 会向远程服务器发送带 HTTP Range 的请求，跳过前面的无关数据包，直接读取指定时间点的关键关键帧（I-Frame）附近数据，网络流量通常仅需数 KB 至几百 KB 即可解码出一张完整图片。
- **黑屏/纯色过渡帧检测与平移重试**：
  使用 `PIL.ImageStat` 计算截得画面的亮度和标准差。若平均亮度 $< 15$（极暗黑屏）或标准差 $< 10$（纯色单调画面），自动向后或向前偏移 2 秒进行二次采样，保证截出的图片包含有效内容。

### 3.2 语义决策机制 (Semantic Timestamp Predictor)
在文章生成流水线启动前，由系统以轻量 Prompt 快速分析带时间戳的字幕片段：
```text
【输入】：带秒数时间戳的视频字幕。
【任务】：找出讲者明确展示或讲解“架构图、流程图、对比表、代码演示、关键数据结论”的时间点。
【输出要求】：严格返回 JSON 数组，包含最多 5 个推荐截帧秒数与预期图表主题。
[
  {"timestamp_sec": 145, "topic": "核心微服务交互架构图"},
  {"timestamp_sec": 320, "topic": "性能基准测试对比表格"}
]
```

### 3.3 Vision Agent 结构化提炼
抽出的图片交由独立的 Vision Agent 进行识别：
```text
你是一个专业的学术与技术图表视觉分析专家。
请仔细观察所提供的视频关键帧截图，提炼其最核心的技术/业务信息：
1. 若为架构图/流程图：列举核心模块与交互流向；
2. 若为表格/图表：提炼最关键的数字与结论对比；
3. 输出一段 40~70 字的专业图注（Caption），语言严谨精炼。
```

### 3.4 图文时序对齐排版契约
Editorial Agent 在撰写文章时，系统将识别好的图片元数据作为上下文传入：
```text
【可用图片资源】：
- 资源地址: /api/snapshots/{task_id}/frame_145s.jpg
  时间戳: 02:25
  图表提炼: 核心微服务交互架构图，展示了网关到消息总线的异步发布链路。
请在阐述到 02:25 前后相关知识点时，严格按照以下规范嵌入该图：
<figure class="article-figure">
  <img src="/api/snapshots/{task_id}/frame_145s.jpg" alt="核心微服务交互架构图" loading="lazy" />
  <figcaption>
    <span class="fig-badge">⏱️ 02:25</span>
    <strong>图：</strong>核心微服务交互架构图（网关到消息总线的异步发布链路）
  </figcaption>
</figure>
```

---

## 4. 容错与优雅降级方案 (Resilience & Fallback)

1. **直链失效或流式截帧超时**：
   若因特定视频的防盗链机制导致 FFmpeg 直链截帧失败，系统捕获异常并记录日志，自动**优雅降级为纯文本生成**，绝不中断整篇长文的撰写流程。
2. **多模态 API 额度超限/未配置**：
   若用户未配置多模态模型 API Key，系统自动降级为**免 VLM 模式**：直接利用该时间点对应的原文字幕上下文自动拼装出基础图注，文章依然能带图完整输出。
3. **临时图片存储与清理**：
   图片存储于 `backend/snapshots/{task_id}/` 目录中，生命周期与数据库文章记录绑定；当用户在历史记录中删除该文章时，联级清理对应的图片快照目录。

---

## 5. 测试与验证计划 (Testing & Verification)

1. **FFmpeg 直链截帧单元测试**：编写测试脚本模拟视频直链的秒级定向抽帧，验证输出图片的格式与分辨率。
2. **黑屏检测算法测试**：输入全黑图与真实图表图，验证方差检测与自动偏移逻辑。
3. **双 Agent 端到端流水线测试**：输入一段 YouTube/B 站真实技术视频，验证截帧、Vision Agent 图注提炼、Editorial Agent 嵌入文章的全链路是否正常无阻。
4. **前端灯箱渲染回归**：构建并预览生成的 Notion / Claude 风格文章，确认图片排版与灯箱全屏放大功能。
