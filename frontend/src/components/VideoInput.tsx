import { useState, useEffect } from "react";
import { Link, Sparkles, ChevronDown, ChevronUp, Settings } from "lucide-react";
import type { TaskCreatePayload } from "../utils/api";

interface VideoInputProps {
  onSubmit: (payload: TaskCreatePayload) => void;
  onOpenSettings: () => void;
  isLoading: boolean;
}

export default function VideoInput({ onSubmit, onOpenSettings, isLoading }: VideoInputProps) {
  const [url, setUrl] = useState("");
  const [isBilibili, setIsBilibili] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Form options
  const [style, setStyle] = useState("notion_dark");
  const [language, setLanguage] = useState("zh");
  const [sessdata, setSessdata] = useState("");
  const [provider, setProvider] = useState("gemini");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [apiBaseUrl, setApiBaseUrl] = useState("");

  // Track Bilibili URL to show Cookie input
  useEffect(() => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes("bilibili.com") || lowerUrl.includes("b23.tv")) {
      setIsBilibili(true);
    } else {
      setIsBilibili(false);
    }
  }, [url]);

  // Adjust model default choices when provider changes
  useEffect(() => {
    if (provider === "gemini") {
      setModel("gemini-2.5-flash");
    } else if (provider === "claude") {
      setModel("claude-3-5-sonnet-latest");
    } else if (provider === "openai") {
      setModel("gpt-4o-mini");
    } else if (provider === "deepseek") {
      setModel("deepseek-v4-pro");
    } else if (provider === "kimi") {
      setModel("moonshot-v1-8k");
    }
  }, [provider]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    onSubmit({
      video_url: url.trim(),
      style,
      language,
      sessdata: isBilibili && sessdata.trim() ? sessdata.trim() : undefined,
      provider,
      model,
      api_base_url: apiBaseUrl.trim() ? apiBaseUrl.trim() : undefined,
    });
  };

  const getModelsForProvider = () => {
    switch (provider) {
      case "gemini":
        return [
          { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (推荐，快速高性价比)" },
          { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (深度文章首选)" },
        ];
      case "claude":
        return [
          { value: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet (逻辑与表达极佳)" },
          { value: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku (轻快写作)" },
        ];
      case "openai":
        return [
          { value: "gpt-4o-mini", label: "GPT-4o-mini (极快低延迟)" },
          { value: "gpt-4o", label: "GPT-4o (深度写作)" },
        ];
      case "deepseek":
        return [
          { value: "deepseek-v4-pro", label: "DeepSeek-V4-Pro (旗舰MoE，适合中文)" },
          { value: "deepseek-v4-flash", label: "DeepSeek-V4-Flash (极速高性价比)" },
        ];
      case "kimi":
        return [
          { value: "moonshot-v1-8k", label: "Kimi 8k" },
          { value: "moonshot-v1-32k", label: "Kimi 32k (适合超长视频)" },
          { value: "moonshot-v1-128k", label: "Kimi 128k" },
        ];
      default:
        return [];
    }
  };

  return (
    <div className="p-[6px] rounded-[24px] bg-bg-bezel border border-border-bezel shadow-[0_24px_64px_rgba(0,0,0,0.15)] w-full transition-all duration-300">
      <div className="bg-bg-card rounded-[18px] p-6 border border-border-card backdrop-blur-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* URL Input Bar */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-text-muted font-semibold tracking-[0.1em] uppercase">
                输入视频源链接
              </label>
              <button
                type="button"
                onClick={onOpenSettings}
                className="text-[11px] text-accent-text hover:text-accent-text/80 flex items-center gap-1 focus:outline-none font-medium transition-colors cursor-pointer"
              >
                <Settings size={12} strokeWidth={1.5} /> <span>密钥管理</span>
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 flex items-center">
                <Link size={14} strokeWidth={1.5} className="absolute left-3.5 text-text-muted" />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="支持 Bilibili 或 YouTube 视频链接..."
                  required
                  disabled={isLoading}
                  className="w-full bg-bg-bezel border border-border-bezel rounded-xl pl-10 pr-3 py-3 text-xs text-text-title placeholder:text-text-muted/60 focus:outline-none focus:border-accent-border disabled:opacity-50 transition-spring shadow-inner"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !url.trim()}
                className="group bg-accent-theme text-white hover:opacity-90 active:scale-[0.98] font-semibold text-xs px-6 py-3 rounded-full flex items-center justify-center gap-2 focus:outline-none disabled:opacity-40 transition-spring cursor-pointer shadow-md"
              >
                <span>立即转换</span>
                <span className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center text-white group-hover:scale-110 transition-spring">
                  <Sparkles size={11} strokeWidth={1.5} />
                </span>
              </button>
            </div>
          </div>

          {/* Advanced Options Toggler */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-[11px] text-text-muted hover:text-text-title flex items-center gap-1 focus:outline-none font-medium transition-colors cursor-pointer"
          >
            {showAdvanced ? <ChevronUp size={12} strokeWidth={1.5} /> : <ChevronDown size={12} strokeWidth={1.5} />}
            <span>高级配置与模型选择</span>
          </button>

          {/* Advanced Options Panel */}
          {showAdvanced && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-5 border-t border-border-card animate-fade-up">
              {/* Model Provider */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-text-muted font-medium">选择 AI 提供商 (BYOK)</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  disabled={isLoading}
                  className="bg-bg-bezel border border-border-bezel rounded-xl px-3 py-2.5 text-xs text-text-body focus:outline-none focus:border-accent-border w-full transition-spring shadow-inner cursor-pointer"
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="claude">Anthropic Claude</option>
                  <option value="openai">OpenAI</option>
                  <option value="deepseek">DeepSeek (深度求索)</option>
                  <option value="kimi">月之暗面 Kimi</option>
                </select>
              </div>

              {/* Model Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-text-muted font-medium">具体基座模型 (可自定义输入)</label>
                <input
                  type="text"
                  list="model-options"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={isLoading}
                  placeholder="选择或输入自定义模型名称..."
                  className="bg-bg-bezel border border-border-bezel rounded-xl px-3 py-2.5 text-xs text-text-body focus:outline-none focus:border-accent-border w-full transition-spring shadow-inner"
                />
                <datalist id="model-options">
                  {getModelsForProvider().map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </datalist>
              </div>

              {/* Custom API Base URL */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-text-muted font-medium">自定义 API 代理地址 (可选)</label>
                <input
                  type="url"
                  value={apiBaseUrl}
                  onChange={(e) => setApiBaseUrl(e.target.value)}
                  disabled={isLoading}
                  placeholder="例如: https://api.proxy.com/v1"
                  className="bg-bg-bezel border border-border-bezel rounded-xl px-3 py-2.5 text-xs text-text-body placeholder:text-text-muted/60 focus:outline-none focus:border-accent-border w-full transition-spring shadow-inner"
                />
              </div>

              {/* Visual Theme */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-text-muted font-medium">生成排版视觉主题</label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  disabled={isLoading}
                  className="bg-bg-bezel border border-border-bezel rounded-xl px-3 py-2.5 text-xs text-text-body focus:outline-none focus:border-accent-border w-full transition-spring shadow-inner cursor-pointer"
                >
                  <option value="notion_dark">Notion 深色风格 (默认经典)</option>
                  <option value="blue_white">蓝白商务风格 (专业大气)</option>
                  <option value="claude_style">Claude 赭石风格 (优雅文艺)</option>
                  <option value="cyber_tech">赛博暗黑科技风格 (酷炫偏光)</option>
                  <option value="minimal_modern">极简现代风格 (留白气感)</option>
                </select>
              </div>

              {/* Language */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-text-muted font-medium">文章输出语言</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  disabled={isLoading}
                  className="bg-bg-bezel border border-border-bezel rounded-xl px-3 py-2.5 text-xs text-text-body focus:outline-none focus:border-accent-border w-full transition-spring shadow-inner cursor-pointer"
                >
                  <option value="zh">简体中文 (翻译整理后输出)</option>
                  <option value="en">English (适合国际读者)</option>
                </select>
              </div>

              {/* Bilibili Cookie (Only shown when Bilibili detected) */}
              {isBilibili && (
                <div className="flex flex-col gap-2.5 md:col-span-2 bg-accent-light border border-accent-border rounded-xl p-4 animate-fade-up">
                  <label className="text-[10px] text-accent-text font-semibold flex items-center gap-1">
                    Bilibili SESSDATA Cookie（可选，用于无 CC 字幕视频提取 AI 字幕）
                  </label>
                  <input
                    type="text"
                    value={sessdata}
                    onChange={(e) => setSessdata(e.target.value)}
                    placeholder="粘贴你的 B 站 SESSDATA Cookie 值"
                    disabled={isLoading}
                    className="w-full bg-bg-bezel border border-border-bezel rounded-xl px-3 py-2 text-xs text-text-title placeholder:text-text-muted/60 focus:outline-none focus:border-accent-border"
                  />
                  <span className="text-[10px] text-text-muted leading-relaxed">
                    <strong>获取方式：</strong>在浏览器登录 B站 ➔ 按 F12 打开开发者工具 ➔ Application/应用 ➔ Cookies ➔ bilibili.com ➔ 复制 SESSDATA 列的 Value 粘贴至此。
                  </span>
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
