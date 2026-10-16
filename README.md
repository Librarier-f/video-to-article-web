# 视频转文章系统 (Video to Article Web)

这是一款开源、纯本地存储、支持 BYOK (Bring Your Own Key) 模式的视频转文章神器。你可以输入 YouTube 或 Bilibili 的视频链接，通过配置顶尖大模型（如 DeepSeek-V4-Pro、GLM-5.2、Kimi-K2.7-Code 等），一键将长视频提炼、转化为排版精美的结构化图文文章。

## ✨ 核心特性

- **BYOK 隐私模式**：纯本地化存储配置，后端绝不保存任何 API Key，你的数据由你自己掌控。
- **全网顶尖 AI 支持** (2026年最新款)：
  - **DeepSeek**：默认支持最新 `DeepSeek-V4-Pro` 与 `DeepSeek-V4-Flash`。
  - **智谱 GLM**：原生支持具有 1M 极长上下文能力的 `GLM-5.2`。
  - **月之暗面 (Kimi)**：无缝集成 `Kimi K2.7 Code` 与 `K2.6`。
  - **MiniMax**：接入最新一代原生多模态 `MiniMax M3`。
  - **硅基流动 (SiliconFlow)**：以极低成本集成 `Qwen2.5` 及其它兼容模型。
  - **自定义 (OpenAI 兼容)**：支持填入任意 OpenAI 兼容的代理 API 和密钥。
- **动态单页面应用 (SPA)**：采用无感滚动的自适应瀑布流界面，彻底告别页面闪烁与跳动。
- **丰富排版主题**：提供 Notion 深色、蓝白商务、Claude 赭石、赛博暗黑科技、极简现代等多种主题。
- **HTML 精读体验**：自动生成章节目录、阅读时长和正文摘句；支持字号调节、深浅色切换、专注阅读、图片放大、代码复制及打印排版。手机目录自动折叠，宽表格可横向滚动。
- **可独立分享的 HTML**：样式和阅读脚本内嵌，导出时嵌入本地视频截图；历史文章打开和导出时自动使用新版主题，无需重新调用模型。主题设计手册可直接体验真实导出效果。原视频链接与远程封面仍需联网。
- **支持多语言输出**：一键生成中文、英文、日文等语言的优质文章。

## 🛠️ 技术栈

- **前端**：React 18 + Vite + TypeScript + TailwindCSS + Lucide React 图标
- **后端**：Python (FastAPI) + SQLite + SQLAlchemy
- **包管理**：npm (前端) + uv / pip (后端)

## 🚀 快速启动

### 1. 启动后端 (Python FastAPI)

请确保你的环境已安装 Python 3.10+。推荐使用 `uv` 提升安装与运行速度。

```bash
cd backend
# 激活虚拟环境 (可选)
python -m venv .venv
source .venv/bin/activate  # Windows 下请使用 .venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 启动服务 (默认端口 8000)
uvicorn main:app --reload
```

### 2. 启动前端 (React Vite)

请确保你的环境已安装 Node.js 18+。

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端启动后，打开浏览器访问终端中提示的本地地址（通常是 `http://localhost:5173`）即可体验。

## 💡 使用指南

1. **配置密钥**：点击页面顶部的“设置”按钮，选择你注册过的大模型提供商（例如 DeepSeek），输入你的 API 密钥。所有的密钥仅保存在你当前浏览器的 `localStorage` 中。
2. **提交转换**：在页面主输入框填入你需要转换的视频链接（支持 B 站或 YouTube），选择你想要的生成风格，点击“立即转换”。
3. **查阅与历史**：系统会自动抓取字幕并交由大模型重写。生成的文章会自动存入左侧的“转换历史”中，方便随时回顾。

### 自定义接口与 Markdown 预览

- 在“设置 → 自定义模型接口”填写 **Base URL、API Key、模型名称** 并保存，生成页会自动选中自定义接口；也可以在生成页选择“自定义（兼容 OpenAI 格式）”后填写。Base URL 支持接口前缀（例如 `https://your-api.example/v1`）或完整的 `/chat/completions` 地址。填写接口实际支持的模型 ID。
- 生成页的“在此浏览器记住自定义配置”控制是否在提交时保存配置；取消勾选并提交后会移除已保存的自定义配置。后端不持久化 API Key。
- 打开历史文章，点击 **MD 预览** 阅读 Markdown 渲染结果，支持标题、列表、表格、引用、代码块和图片；可切换 **源码**，也可复制或下载原始 Markdown。

## 生成性能与校招开发路线

默认使用 **快速成文**：12000 字符以内字幕一次生成正文和卡片；更长字幕并行提炼后合成。正文就绪即展示，截图随后补充；也可关闭截图或切换 **深度精写**。快速模式按信息量组织篇幅，深度模式保留逐章扩写。详见 [当前生成架构及对照基准](docs/generation-architecture.md)。

摘要、章节正文和视觉图注默认采用单任务最多 3 个并发请求，结果按原始顺序汇总。视频解析和 FFmpeg 截图在工作线程执行，任务日志记录阶段耗时和总耗时。模型严格限流时，可在启动后端前设置 `GENERATION_CONCURRENCY=1`；支持范围为 1–8，多个任务的总并发还需要后续的服务级限流。

PowerShell 示例：`$env:GENERATION_CONCURRENCY="3"`。Docker Compose 同样读取这个环境变量。此项配置不减少模型调用次数与 Token，也不并行执行单次截图内部的重试。

详见 [性能分析与校招增量路线](docs/performance-and-campus-roadmap.md)，包含离线对照结果、真实链路测量方法和功能验收标准。

## Ubuntu 同机部署

已有其他项目的服务器请使用独立的 `compose.ubuntu.yml`，不要使用占用宿主机80端口的默认配置。前端本机构建，数据库与截图一起持久化；详见 [部署入口](README-DEPLOY.md) 和 [Ubuntu部署手册](docs/deployment/Ubuntu部署.md)。

## 🤝 贡献与许可
欢迎提交 Pull Request 或者 Issue。本项目采用 MIT 许可证，你可以随意分发、修改与商用。
