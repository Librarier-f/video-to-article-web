import { useState, useEffect, useRef, useMemo } from "react";
import { Settings, Link, Sparkles, UploadCloud, CheckCircle2, Trash2 } from "lucide-react";
import type { TaskCreatePayload } from "../utils/api";

interface VideoInputProps {
  onSubmit: (payload: TaskCreatePayload) => void;
  onOpenSettings: () => void;
  isLoading: boolean;
}

export default function VideoInput({ onSubmit, onOpenSettings, isLoading }: VideoInputProps) {
  const [url, setUrl] = useState("");
  const [isBilibili, setIsBilibili] = useState(false);
  const [isYoutube, setIsYoutube] = useState(false);
  
  // YouTube Cookies State
  const [youtubeCookies, setYoutubeCookies] = useState("");
  const [youtubeCookieFilename, setYoutubeCookieFilename] = useState("");
  const [youtubeCookieSize, setYoutubeCookieSize] = useState<number | null>(null);
  const [saveYoutubeCookieLocal, setSaveYoutubeCookieLocal] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form options
  const [style, setStyle] = useState("notion_dark");
  const [language, setLanguage] = useState("zh");
  const [sessdata, setSessdata] = useState("");
  const [provider, setProvider] = useState("deepseek");
  const [model, setModel] = useState("deepseek-v4-pro");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [customApiKey, setCustomApiKey] = useState("");

  // Load saved YouTube cookies from localStorage on mount
  useEffect(() => {
    const savedYtCookie = localStorage.getItem("byok_youtube_cookies") || "";
    const savedYtName = localStorage.getItem("byok_youtube_cookie_filename") || "";
    if (savedYtCookie) {
      setYoutubeCookies(savedYtCookie);
      setYoutubeCookieFilename(savedYtName || "cookies.txt (已保存)");
      setYoutubeCookieSize(new Blob([savedYtCookie]).size);
    }
  }, []);

  // Track Bilibili or YouTube URL to show Cookie inputs
  useEffect(() => {
    const lowerUrl = url.toLowerCase();
    setIsBilibili(lowerUrl.includes("bilibili.com") || lowerUrl.includes("b23.tv"));
    setIsYoutube(lowerUrl.includes("youtube.com") || lowerUrl.includes("youtu.be"));
  }, [url]);

  const hasYoutubeAuthToken = useMemo(() => {
    if (!youtubeCookies) return false;
    return /SID|LOGIN_INFO|SAPISID|__Secure/i.test(youtubeCookies);
  }, [youtubeCookies]);

  useEffect(() => {
    if (provider === "minimax") {
      setModel("minimax-m3");
    } else if (provider === "glm") {
      setModel("glm-5.2");
    } else if (provider === "kimi") {
      setModel("kimi-k2.7-code");
    } else if (provider === "deepseek") {
      setModel("deepseek-v4-pro");
    } else if (provider === "siliconflow") {
      setModel("THUDM/glm-5.2");
    } else if (provider === "custom") {
      setModel("gpt-3.5-turbo"); // A generic default for custom OpenAI compatible
    }
  }, [provider]);

  const handleFileUpload = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        setYoutubeCookies(text);
        setYoutubeCookieFilename(file.name);
        setYoutubeCookieSize(file.size);
        if (saveYoutubeCookieLocal) {
          localStorage.setItem("byok_youtube_cookies", text);
          localStorage.setItem("byok_youtube_cookie_filename", file.name);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleClearCookies = () => {
    setYoutubeCookies("");
    setYoutubeCookieFilename("");
    setYoutubeCookieSize(null);
    localStorage.removeItem("byok_youtube_cookies");
    localStorage.removeItem("byok_youtube_cookie_filename");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    onSubmit({
      video_url: url.trim(),
      style,
      language,
      sessdata: isBilibili && sessdata.trim() ? sessdata.trim() : undefined,
      youtube_cookies: isYoutube && youtubeCookies.trim() ? youtubeCookies.trim() : undefined,
      provider,
      model,
      api_base_url: apiBaseUrl.trim() ? apiBaseUrl.trim() : undefined,
      custom_api_key: customApiKey.trim() ? customApiKey.trim() : undefined,
    });
  };

  const getModelsForProvider = () => {
    switch (provider) {
      case "minimax":
        return [
          { value: "minimax-m3", label: "MiniMax M3 (最新旗舰, 1M上下文)" },
          { value: "abab6.5s-chat", label: "MiniMax abab6.5s (快速)" },
        ];
      case "glm":
        return [
          { value: "glm-5.2", label: "GLM-5.2 (最新旗舰, 长程任务优化)" },
          { value: "glm-4-flash", label: "GLM-4 Flash (极速)" },
        ];
      case "kimi":
        return [
          { value: "kimi-k2.7-code", label: "Kimi K2.7 Code (最新编程&逻辑旗舰)" },
          { value: "kimi-k2.6", label: "Kimi K2.6 (多模态与智能体稳定版)" },
          { value: "moonshot-v1-128k", label: "Kimi 128k (长文本)" },
        ];
      case "deepseek":
        return [
          { value: "deepseek-v4-pro", label: "DeepSeek-V4-Pro (最新1.6T旗舰, 1M上下文)" },
          { value: "deepseek-v4-flash", label: "DeepSeek-V4-Flash (极速高性价比)" },
        ];
      case "siliconflow":
        return [
          { value: "THUDM/glm-5.2", label: "GLM-5.2 (智谱最新旗舰)" },
          { value: "MoonshotAI/kimi-k2.7-code", label: "Kimi-K2.7-Code (月之暗面最新)" },
          { value: "Qwen/Qwen2.5-7B-Instruct", label: "Qwen2.5 7B (免费且极速)" },
          { value: "deepseek-ai/DeepSeek-V4-Pro", label: "DeepSeek-V4-Pro (推荐)" },
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

          {/* Advanced Options Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-5 border-t border-border-card">
            {/* Model Provider */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-text-muted font-medium">选择 AI 提供商 (BYOK)</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  disabled={isLoading}
                  className="w-full bg-bg-bezel border border-border-bezel rounded-xl px-3 py-2 text-xs text-text-title focus:outline-none focus:border-accent-border appearance-none cursor-pointer transition-spring pr-8 shadow-inner"
                >
                  <option value="deepseek" className="bg-bg-card text-text-title">DeepSeek</option>
                  <option value="minimax" className="bg-bg-card text-text-title">MiniMax</option>
                  <option value="glm" className="bg-bg-card text-text-title">智谱 GLM</option>
                  <option value="kimi" className="bg-bg-card text-text-title">Kimi (月之暗面)</option>
                  <option value="siliconflow" className="bg-bg-card text-text-title">硅基流动</option>
                  <option value="custom" className="bg-bg-card text-text-title">自定义 (兼容 OpenAI 格式)</option>
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
                    <option key={m.value} value={m.value} className="bg-bg-card text-text-body">
                      {m.label}
                    </option>
                  ))}
                </datalist>
              </div>

              {/* Custom API Base URL & API Key (Only shown when provider is custom) */}
              {provider === "custom" && (
                <>
                  <div className="flex flex-col gap-1.5 animate-fade-up">
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
                  <div className="flex flex-col gap-1.5 animate-fade-up">
                    <label className="text-[10px] text-text-muted font-medium">自定义 API 密钥</label>
                    <input
                      type="password"
                      value={customApiKey}
                      onChange={(e) => setCustomApiKey(e.target.value)}
                      disabled={isLoading}
                      placeholder="输入你的 API Key (此 Key 仅本次有效)"
                      className="bg-bg-bezel border border-border-bezel rounded-xl px-3 py-2.5 text-xs text-text-body placeholder:text-text-muted/60 focus:outline-none focus:border-accent-border w-full transition-spring shadow-inner"
                    />
                  </div>
                </>
              )}

              {/* Visual Theme */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-text-muted font-medium">生成排版视觉主题</label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  disabled={isLoading}
                  className="bg-bg-bezel border border-border-bezel rounded-xl px-3 py-2.5 text-xs text-text-body focus:outline-none focus:border-accent-border w-full transition-spring shadow-inner cursor-pointer"
                >
                  <option value="notion_dark" className="bg-bg-card text-text-body">Notion 深色风格 (默认经典)</option>
                  <option value="blue_white" className="bg-bg-card text-text-body">蓝白商务风格 (专业大气)</option>
                  <option value="claude_style" className="bg-bg-card text-text-body">Claude 赭石风格 (优雅文艺)</option>
                  <option value="cyber_tech" className="bg-bg-card text-text-body">赛博暗黑科技风格 (酷炫偏光)</option>
                  <option value="minimal_modern" className="bg-bg-card text-text-body">极简现代风格 (留白气感)</option>
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
                  <option value="zh" className="bg-bg-card text-text-body">简体中文 (翻译整理后输出)</option>
                  <option value="en" className="bg-bg-card text-text-body">English (适合国际读者)</option>
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

              {/* YouTube Cookies File Upload (Only shown when YouTube detected) */}
              {isYoutube && (
                <div className="flex flex-col gap-2.5 md:col-span-2 bg-accent-light border border-accent-border rounded-xl p-4 animate-fade-up">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-accent-text font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                      YouTube Cookies 文件上传（Netscape 格式 cookies.txt）
                    </label>
                    <span className="text-[9px] text-text-muted bg-bg-card/70 px-2 py-0.5 rounded-full border border-border-card">
                      解决 Bot 拦截 / 私享与多语种字幕
                    </span>
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".txt"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isLoading}
                  />

                  {youtubeCookies ? (
                    <div className={`flex items-center justify-between bg-bg-bezel border rounded-xl px-3.5 py-2.5 transition-all ${
                      hasYoutubeAuthToken ? "border-emerald-500/30" : "border-amber-500/40 bg-amber-500/[0.03]"
                    }`}>
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className={`p-1.5 rounded-lg shrink-0 ${
                          hasYoutubeAuthToken ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                        }`}>
                          <CheckCircle2 size={16} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-medium text-text-title truncate">
                            {youtubeCookieFilename || "cookies.txt"}
                          </span>
                          <span className={`text-[10px] ${hasYoutubeAuthToken ? "text-emerald-400/90" : "text-amber-400 font-medium"}`}>
                            {youtubeCookieSize ? formatFileSize(youtubeCookieSize) : "已装载"} · {
                              hasYoutubeAuthToken ? "登录凭据有效 (SID/LOGIN_INFO)" : "⚠️ 未检测到账号登录态(建议在已登录浏览器重新导出)"
                            }
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isLoading}
                          className="text-[11px] text-text-muted hover:text-text-title px-2.5 py-1 rounded-lg hover:bg-bg-card transition-spring cursor-pointer"
                        >
                          替换
                        </button>
                        <button
                          type="button"
                          onClick={handleClearCookies}
                          disabled={isLoading}
                          className="text-[11px] text-red-400 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-spring flex items-center gap-1 cursor-pointer"
                          title="移除已保存的 Cookies"
                        >
                          <Trash2 size={13} />
                          <span>清除</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-spring ${
                        isDragging
                          ? "border-accent-text bg-accent-light/50"
                          : "border-border-bezel bg-bg-bezel/50 hover:border-accent-border hover:bg-bg-bezel"
                      }`}
                    >
                      <UploadCloud size={20} className="text-accent-text" />
                      <div className="text-xs text-text-title font-medium text-center">
                        点击选择或拖拽 <span className="text-accent-text font-semibold">cookies.txt</span> 文件至此
                      </div>
                      <div className="text-[10px] text-text-muted">
                        支持 Netscape 格式、JSON (Cookie-Editor) 或请求标头
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={saveYoutubeCookieLocal}
                        onChange={(e) => {
                          setSaveYoutubeCookieLocal(e.target.checked);
                          if (!e.target.checked) {
                            localStorage.removeItem("byok_youtube_cookies");
                            localStorage.removeItem("byok_youtube_cookie_filename");
                          } else if (youtubeCookies) {
                            localStorage.setItem("byok_youtube_cookies", youtubeCookies);
                            localStorage.setItem("byok_youtube_cookie_filename", youtubeCookieFilename || "cookies.txt");
                          }
                        }}
                        disabled={isLoading}
                        className="rounded border-border-bezel text-accent-text focus:ring-0 bg-bg-bezel cursor-pointer"
                      />
                      <span className="text-[10px] text-text-muted">
                        在本地浏览器（LocalStorage）保存此 Cookies，下次自动装载
                      </span>
                    </label>
                  </div>

                  <span className="text-[10px] text-text-muted leading-relaxed">
                    <strong>💡 正确导出指引：</strong>在 Chrome/Edge 浏览器安装插件「Get cookies.txt LOCALLY」➔ 登录并刷新 youtube.com（确保右上角显示已登录头像）➔ 点击插件导出 <code className="bg-bg-bezel px-1 py-0.5 rounded text-accent-text">cookies.txt</code> 后直接上传此处。
                  </span>
                </div>
              )}
          </div>
        </form>
      </div>
    </div>
  );
}
