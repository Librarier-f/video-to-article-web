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

## 🤝 贡献与许可
欢迎提交 Pull Request 或者 Issue。本项目采用 MIT 许可证，你可以随意分发、修改与商用。
