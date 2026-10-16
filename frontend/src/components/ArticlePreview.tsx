import { useState, useMemo, useEffect } from "react";
import { Download, ExternalLink, RefreshCw, FileText, FileCode, Copy, Check, Bot, Lightbulb, ChevronDown, X } from "lucide-react";
import { API_BASE_URL, getDownloadUrl, getMarkdownDownloadUrl, exportToIma } from "../utils/api";
import type { ArticleDetailResponseData } from "../utils/api";
import MarkdownPreview from "./MarkdownPreview";
import { resolveSnapshotUrls } from "../utils/htmlDocument";

interface ArticlePreviewProps {
  article: ArticleDetailResponseData;
  onRefresh?: () => void;
}

export default function ArticlePreview({ article, onRefresh }: ArticlePreviewProps) {
  const [activeTab, setActiveTab] = useState<"html" | "markdown" | "anki">("html");
  const [copied, setCopied] = useState(false);
  const [markdownMode, setMarkdownMode] = useState<"preview" | "source">("preview");
  const [isExportingIma, setIsExportingIma] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);
  const readerHtml = useMemo(() => resolveSnapshotUrls(article.html_content, API_BASE_URL), [article.html_content]);

  // Handle ESC key to close lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxImage(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const parsedCards = useMemo(() => {
    if (!article.anki_csv) return [];
    try {
      // New JSON format
      return JSON.parse(article.anki_csv);
    } catch (e) {
      // Fallback for old CSV format
      const lines = article.anki_csv.split('\n');
      const cards = [];
      for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.split(',');
        if (parts.length >= 2) {
          cards.push({ q: parts[0], a: parts.slice(1).join(',') });
        }
      }
      return cards;
    }
  }, [article.anki_csv]);

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
      newTab.opener = null;
      newTab.document.write(readerHtml);
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


  const handleExportToIma = async () => {
    const clientId = localStorage.getItem("byok_ima_client_id");
    const apiKey = localStorage.getItem("byok_ima_key");
    if (!clientId || !apiKey) {
      alert("请先点击右上角⚙️图标配置您的 IMA Client ID 和 API Key！");
      return;
    }
    try {
      setIsExportingIma(true);
      const kbId = localStorage.getItem("byok_ima_kb_id") || undefined;
      await exportToIma(article.id, kbId);
      if (kbId) {
        alert("✅ 成功保存笔记并关联到 IMA 知识库！请在您的 IMA 客户端查看。");
      } else {
        alert("✅ 成功保存笔记到 IMA！请在您的 IMA 客户端查看。");
      }
    } catch (err: any) {
      alert(err.message || "保存到 IMA 失败");
    } finally {
      setIsExportingIma(false);
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
              <span>MD 预览</span>
            </button>
            <button
              onClick={() => setActiveTab("anki")}
              className={`px-3.5 py-1.5 rounded-full text-[10px] font-semibold transition-all duration-300 flex items-center gap-1.5 focus:outline-none active:scale-[0.97] cursor-pointer ${
                activeTab === "anki"
                  ? "bg-bg-card text-text-title shadow-sm border border-border-card/20"
                  : "text-text-muted hover:text-text-title"
              }`}
            >
              <Lightbulb size={11} strokeWidth={1.5} />
              <span>知识卡片</span>
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
              onClick={handleExportToIma}
              disabled={isExportingIma}
              className={`px-3.5 py-1.5 text-xs font-semibold bg-bg-card border border-border-card text-text-body hover:text-text-title rounded-full flex items-center gap-1.5 transition-spring focus:outline-none shadow-sm ${
                isExportingIma ? "opacity-50 cursor-not-allowed" : "hover:bg-bg-bezel active:scale-[0.97] cursor-pointer"
              }`}
            >
              {isExportingIma ? (
                <RefreshCw size={13} strokeWidth={1.5} className="animate-spin text-blue-500" />
              ) : (
                <Bot size={13} strokeWidth={1.5} className="text-blue-500" />
              )}
              <span>{isExportingIma ? "保存中..." : "保存到 IMA"}</span>
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
              srcDoc={readerHtml}
              title={article.title}
              sandbox="allow-scripts allow-popups allow-modals"
              allow="clipboard-write"
              className="w-full h-full rounded-xl border border-border-card bg-bg-card"
            />
          ) : activeTab === "anki" ? (
            <div className="relative flex-1 rounded-xl border border-border-card bg-bg-bezel flex flex-col overflow-y-auto p-4 md:p-8 shadow-inner custom-scrollbar">
              <div className="max-w-2xl w-full mx-auto space-y-3 pb-10">
                {parsedCards.length > 0 ? (
                  parsedCards.map((card: any, idx: number) => (
                    <details 
                      key={idx} 
                      className="group bg-bg-card border border-border-card rounded-xl shadow-sm overflow-hidden transition-all duration-300 open:pb-4"
                    >
                      <summary className="flex items-center justify-between p-4 cursor-pointer select-none text-sm font-medium text-text-title hover:bg-bg-bezel/50 transition-colors list-none [&::-webkit-details-marker]:hidden">
                        <div className="flex items-start gap-3">
                          <span className="text-accent-text font-serif opacity-80 mt-0.5">Q.</span>
                          <span>{card.q}</span>
                        </div>
                        <ChevronDown size={16} className="text-text-muted transition-transform duration-300 group-open:-rotate-180 flex-shrink-0 ml-4" />
                      </summary>
                      <div className="px-4 pt-2 pb-1 text-xs text-text-body leading-relaxed border-t border-border-card/50 mt-1 flex gap-3 animate-fade-down animate-duration-200">
                        <span className="text-emerald-500 font-serif opacity-80 select-none">A.</span>
                        <div className="flex-1 whitespace-pre-wrap">{card.a}</div>
                      </div>
                    </details>
                  ))
                ) : (
                  <div className="text-text-muted text-xs p-10 flex flex-col items-center justify-center opacity-70 h-full">
                    <span>暂无知识卡片数据</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="relative flex-1 rounded-xl border border-border-card bg-bg-bezel flex flex-col overflow-hidden shadow-inner">
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border-card bg-bg-card">
                <div className="flex gap-1" role="group" aria-label="Markdown 显示模式">
                  <button type="button" onClick={() => setMarkdownMode("preview")} aria-pressed={markdownMode === "preview"}
                    className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer ${markdownMode === "preview" ? "bg-accent-light text-accent-text" : "text-text-muted"}`}>预览</button>
                  <button type="button" onClick={() => setMarkdownMode("source")} aria-pressed={markdownMode === "source"}
                    className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer ${markdownMode === "source" ? "bg-accent-light text-accent-text" : "text-text-muted"}`}>源码</button>
                </div>
              <button
                onClick={handleCopyMarkdown}
                className="px-3 py-1.5 text-[11px] font-semibold border border-border-card text-text-body rounded-lg flex items-center gap-1.5 hover:bg-bg-bezel cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check size={11} strokeWidth={1.5} className="text-emerald-500 animate-bounce" />
                    <span className="text-emerald-500">已复制!</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} strokeWidth={1.5} className="text-accent-text" />
                    <span>复制 Markdown</span>
                  </>
                )}
              </button>
              </div>
              {markdownMode === "preview" ? (
                <div className="flex-1 min-h-0 overflow-y-auto p-5 md:p-8 bg-bg-card custom-scrollbar">
                  <MarkdownPreview content={article.markdown_content || ""} assetBaseUrl={API_BASE_URL} onImageClick={setLightboxImage} />
                </div>
              ) : <textarea
                aria-label="Markdown 源码"
                readOnly
                value={article.markdown_content || "# 暂无 Markdown 内容\n内容转换中，或系统尝试提取旧数据，请稍候。"}
                className="w-full flex-1 min-h-0 p-6 bg-transparent text-text-body font-mono text-xs leading-relaxed border-none outline-none resize-none overflow-y-auto selection:bg-accent-text/20"
              />}
            </div>
          )}
        </div>
      </div>

      {/* Interactive High-Definition Image Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/80 backdrop-blur-md animate-fade animate-duration-200"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] w-full flex flex-col items-center bg-bg-card border border-border-card rounded-2xl shadow-2xl overflow-hidden p-3 animate-scale animate-duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="w-full flex items-center justify-between px-3 py-2 border-b border-border-card/50">
              <span className="text-xs font-semibold text-text-title truncate max-w-[85%]">
                {lightboxImage.alt}
              </span>
              <button
                onClick={() => setLightboxImage(null)}
                className="p-1.5 rounded-full hover:bg-bg-bezel text-text-muted hover:text-text-title transition-colors cursor-pointer"
                title="关闭 (ESC)"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            {/* High-res Image Preview */}
            <div className="relative overflow-auto max-h-[72vh] w-full flex items-center justify-center p-2 bg-black/30 rounded-xl my-2">
              <img
                src={lightboxImage.src}
                alt={lightboxImage.alt}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg select-none"
              />
            </div>

            {/* Footer with caption */}
            {lightboxImage.alt && (
              <div className="w-full px-3 py-1.5 text-center text-xs text-text-muted truncate">
                {lightboxImage.alt}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
