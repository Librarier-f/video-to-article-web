import { useState, useRef } from "react";
import { Download, ExternalLink, RefreshCw, FileText, FileCode, Copy, Check } from "lucide-react";
import { getDownloadUrl, getMarkdownDownloadUrl } from "../utils/api";
import type { ArticleDetailResponseData } from "../utils/api";

interface ArticlePreviewProps {
  article: ArticleDetailResponseData;
  onRefresh?: () => void;
}

export default function ArticlePreview({ article, onRefresh }: ArticlePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [activeTab, setActiveTab] = useState<"html" | "markdown">("html");
  const [copied, setCopied] = useState(false);

  // Trigger download endpoint
  const handleDownload = () => {
    window.location.href = getDownloadUrl(article.id);
  };

  // Trigger markdown download endpoint
  const handleDownloadMarkdown = () => {
    window.location.href = getMarkdownDownloadUrl(article.id);
  };

  // Open HTML content in a new tab
  const handleOpenNewTab = () => {
    const newTab = window.open();
    if (newTab) {
      newTab.document.write(article.html_content);
      newTab.document.close();
    }
  };

  // Copy Markdown to Clipboard
  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(article.markdown_content || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <div className="p-[6px] rounded-[24px] bg-bg-bezel border border-border-bezel shadow-[0_24px_64px_rgba(0,0,0,0.15)] flex-1 h-full w-full transition-all duration-300 overflow-hidden min-h-0 flex flex-col">
      <div className="bg-bg-card rounded-[18px] border border-border-card flex flex-col h-full overflow-hidden">
        {/* Article Preview Header Controls */}
        <div className="p-4 border-b border-border-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <span className="text-[9px] text-text-muted uppercase tracking-[0.15em] font-semibold">
              文章预览
            </span>
            <h2 className="text-sm font-semibold text-text-title truncate font-serif" title={article.title}>
              {article.title}
            </h2>
          </div>

          {/* Segmented Control Switcher */}
          <div className="flex bg-bg-bezel border border-border-bezel p-1 rounded-full flex-shrink-0 self-center md:self-auto">
            <button
              onClick={() => setActiveTab("html")}
              className={`px-3.5 py-1.5 rounded-full text-[10px] font-semibold transition-all duration-300 flex items-center gap-1.5 focus:outline-none active:scale-[0.97] cursor-pointer ${
                activeTab === "html"
                  ? "bg-bg-card text-text-title shadow-sm border border-border-card/20"
                  : "text-text-muted hover:text-text-title"
              }`}
            >
              <FileText size={11} strokeWidth={1.5} />
              <span>HTML 预览</span>
            </button>
            <button
              onClick={() => setActiveTab("markdown")}
              className={`px-3.5 py-1.5 rounded-full text-[10px] font-semibold transition-all duration-300 flex items-center gap-1.5 focus:outline-none active:scale-[0.97] cursor-pointer ${
                activeTab === "markdown"
                  ? "bg-bg-card text-text-title shadow-sm border border-border-card/20"
                  : "text-text-muted hover:text-text-title"
              }`}
            >
              <FileCode size={11} strokeWidth={1.5} />
              <span>Markdown</span>
            </button>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0 w-full md:w-auto justify-end">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-2 text-text-muted hover:text-text-title hover:bg-bg-bezel active:scale-[0.95] rounded-full transition-spring focus:outline-none cursor-pointer"
                title="刷新记录"
              >
                <RefreshCw size={14} strokeWidth={1.5} />
              </button>
            )}
            
            <button
              onClick={handleOpenNewTab}
              className="px-3.5 py-1.5 text-xs font-semibold bg-bg-card border border-border-card hover:bg-bg-bezel text-text-body hover:text-text-title active:scale-[0.97] rounded-full flex items-center gap-1.5 transition-spring focus:outline-none cursor-pointer shadow-sm"
            >
              <ExternalLink size={13} strokeWidth={1.5} />
              <span>新标签打开</span>
            </button>
            
            <button
              onClick={handleDownloadMarkdown}
              className="px-3.5 py-1.5 text-xs font-semibold bg-bg-card border border-border-card hover:bg-bg-bezel text-text-body hover:text-text-title active:scale-[0.97] rounded-full flex items-center gap-1.5 transition-spring focus:outline-none cursor-pointer shadow-sm"
            >
              <Download size={13} strokeWidth={1.5} className="text-text-muted" />
              <span>下载 Markdown</span>
            </button>
            
            <button
              onClick={handleDownload}
              className="px-3.5 py-1.5 text-xs font-semibold bg-accent-light border border-accent-border text-accent-text hover:bg-accent-light/80 hover:border-accent-border/80 rounded-full flex items-center gap-1.5 transition-spring focus:outline-none active:scale-[0.97] cursor-pointer shadow-sm"
            >
              <Download size={13} strokeWidth={1.5} />
              <span>下载 HTML</span>
            </button>
          </div>
        </div>

        {/* Viewport content */}
        <div className="flex-1 bg-bg-bezel/30 relative p-2 overflow-hidden flex flex-col">
          {activeTab === "html" ? (
            <iframe
              ref={iframeRef}
              srcDoc={article.html_content}
              title={article.title}
              sandbox="allow-scripts allow-popups"
              className="w-full h-full rounded-xl border border-border-card bg-bg-card"
            />
          ) : (
            <div className="relative flex-1 rounded-xl border border-border-card bg-bg-bezel flex flex-col overflow-hidden shadow-inner">
              {/* Floating Copy Button inside viewport */}
              <button
                onClick={handleCopyMarkdown}
                className="absolute right-4 top-4 z-20 px-3.5 py-2 text-[10px] font-semibold bg-bg-card/90 border border-border-card hover:bg-bg-bezel hover:border-border-bezel active:scale-[0.95] text-text-body rounded-full flex items-center gap-1.5 transition-spring focus:outline-none shadow-md backdrop-blur-sm cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check size={11} strokeWidth={1.5} className="text-emerald-500 animate-bounce" />
                    <span className="text-emerald-500">已复制!</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} strokeWidth={1.5} className="text-accent-text" />
                    <span>复制代码</span>
                  </>
                )}
              </button>
              
              <textarea
                readOnly
                value={article.markdown_content || "# 暂无 Markdown 内容\n内容转换中，或系统尝试提取旧数据，请稍候。"}
                className="w-full h-full p-6 pr-24 bg-transparent text-text-body font-mono text-[11px] leading-relaxed border-none outline-none resize-none overflow-y-auto selection:bg-accent-text/20"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
