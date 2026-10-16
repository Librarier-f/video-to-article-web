import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { API_BASE_URL } from "../utils/api";

interface FullThemeManualViewProps {
  currentStyle: string;
  onSelectStyle: (styleKey: string) => void;
  onBackToInput?: () => void;
}

const themes = [
  { id: "notion_dark", title: "Notion 深色风格", description: "石墨底色与柔和绿调，适合夜间长文阅读。", color: "#a5c8b1" },
  { id: "blue_white", title: "Cobalt 蓝白商务", description: "清晰的报告层级，适合知识整理与数据解读。", color: "#2d62aa" },
  { id: "claude_style", title: "Claude 赭石书刊", description: "保留纸面温度，用书刊标题与引用组织阅读节奏。", color: "#985235" },
  { id: "cyber_tech", title: "暗黑科技", description: "克制的技术版式，突出代码、流程与图表。", color: "#dfa67e" },
  { id: "minimal_modern", title: "极简现代", description: "适度留白与清楚的文字层级，让内容成为中心。", color: "#3f5c4a" },
];

export default function FullThemeManualView({ currentStyle, onSelectStyle }: FullThemeManualViewProps) {
  const [index, setIndex] = useState(Math.max(0, themes.findIndex((theme) => theme.id === currentStyle)));
  useEffect(() => {
    const next = themes.findIndex((theme) => theme.id === currentStyle);
    if (next >= 0) setIndex(next);
  }, [currentStyle]);
  const theme = themes[index];
  return (
    <section className="flex flex-col h-full min-h-0 rounded-2xl border border-border-card bg-bg-card overflow-hidden">
      <div className="px-4 md:px-6 py-4 border-b border-border-card space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h2 className="text-sm font-semibold text-text-title">视觉排版主题设计手册</h2>
            <p className="text-xs text-text-muted mt-1">下面展示实际导出的 HTML，可直接体验目录、字号与专注阅读。</p>
          </div>
          <button type="button" onClick={() => onSelectStyle(theme.id)}
            className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg bg-accent-light border border-accent-border text-accent-text cursor-pointer">
            {currentStyle === theme.id && <Check size={13} />}
            {currentStyle === theme.id ? "当前使用" : "使用此风格"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="上一个主题" onClick={() => setIndex((index + themes.length - 1) % themes.length)} className="p-2 text-text-muted cursor-pointer"><ChevronLeft size={16} /></button>
          <div className="flex-1 flex gap-2 overflow-x-auto">
            {themes.map((item, position) => (
              <button key={item.id} type="button" onClick={() => setIndex(position)} aria-pressed={index === position}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs border cursor-pointer ${index === position ? "border-accent-border bg-accent-light text-text-title" : "border-border-card text-text-muted"}`}>
                {item.title}
              </button>
            ))}
          </div>
          <button type="button" aria-label="下一个主题" onClick={() => setIndex((index + 1) % themes.length)} className="p-2 text-text-muted cursor-pointer"><ChevronRight size={16} /></button>
        </div>
        <p className="text-xs text-text-muted border-l-2 pl-3" style={{ borderColor: theme.color }}>{theme.description}</p>
      </div>
      <iframe key={theme.id} src={`${API_BASE_URL}/api/themes/${theme.id}/preview`} title={`${theme.title}实际阅读预览`}
        sandbox="allow-scripts allow-popups allow-modals" allow="clipboard-write" className="w-full flex-1 min-h-0 border-0" />
    </section>
  );
}