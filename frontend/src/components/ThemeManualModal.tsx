import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Check, BookOpen, ExternalLink, Sparkles } from "lucide-react";

interface ThemeManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStyle: string;
  onSelectStyle: (styleKey: string) => void;
}

interface ThemeSpecimen {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  vibe: string;
  font: string;
  palette: string[];
  description: string;
  previewBg: string;
  previewText: string;
  previewBorder: string;
  previewAccent: string;
  previewHeaderStyle: React.CSSProperties;
  previewCardStyle: React.CSSProperties;
  sampleCallout: {
    bg: string;
    border: string;
    text: string;
    icon: string;
    content: string;
  };
}

const THEME_SPECIMENS: ThemeSpecimen[] = [
  {
    id: "notion_dark",
    title: "Notion 深色风格",
    subtitle: "Notion Dark Theme System",
    tag: "默认经典",
    vibe: "极简沉浸 • 专注学习 • 结构化Callout",
    font: "Inter + Noto Sans SC + JetBrains Mono",
    palette: ["#191919", "#222222", "#ededed", "#7b9fd9"],
    description: "高度还原 Notion 经典黑调编辑器质感，内置 5 种 Notion 调色 Callout 高亮盒，层次分明，适合学术长文与知识复盘。",
    previewBg: "#191919",
    previewText: "#ededed",
    previewBorder: "#2f2f2f",
    previewAccent: "#7b9fd9",
    previewHeaderStyle: { fontFamily: "Inter, sans-serif", color: "#ededed" },
    previewCardStyle: { backgroundColor: "#222222", borderColor: "#2f2f2f" },
    sampleCallout: {
      bg: "#1d283a",
      border: "#2b3d5b",
      text: "#8db5e9",
      icon: "💡",
      content: "核心概念：Notion 风格强调信息的结构化与块级渐进呈现。"
    }
  },
  {
    id: "blue_white",
    title: "Cobalt 蓝白商务",
    subtitle: "Stripe & Linear Cobalt System",
    tag: "专业大气",
    vibe: "现代科技 • Cobalt Blue • 浮雕质感",
    font: "Inter + Noto Sans SC",
    palette: ["#ffffff", "#f8fafc", "#0f62fe", "#0f172a"],
    description: "借鉴 Stripe 与 Linear 现代商务规范，采用精致 Cobalt 钴蓝与 Slate 冷调，适合商业调研、行业报告与技术通识。",
    previewBg: "#ffffff",
    previewText: "#0f172a",
    previewBorder: "#e2e8f0",
    previewAccent: "#0f62fe",
    previewHeaderStyle: { fontFamily: "Inter, sans-serif", color: "#0f172a" },
    previewCardStyle: { backgroundColor: "#f8fafc", borderColor: "#e2e8f0", borderLeft: "4px solid #0f62fe" },
    sampleCallout: {
      bg: "#edf5ff",
      border: "#bae0ff",
      text: "#0043ce",
      icon: "⚡",
      content: "系统观点：Cobalt 高反差色彩能为长篇商业报告建立清晰的视觉动线。"
    }
  },
  {
    id: "claude_style",
    title: "Claude 赭石人文",
    subtitle: "Anthropic Editorial Warm Paper",
    tag: "优雅文艺",
    vibe: "Anthropic 暖纸感 • Drop Cap 首字下沉 • 典雅衬线",
    font: "Noto Serif SC + Noto Sans SC",
    palette: ["#fbf9f5", "#f3efe6", "#b95525", "#2c2a29"],
    description: "灵感来自 Anthropic/Claude 官方向人文印记致敬的设计理念， Warm Paper 纸感背板配合 Noto Serif SC 衬线长文与首字下沉。",
    previewBg: "#fbf9f5",
    previewText: "#2c2a29",
    previewBorder: "#e3dec3",
    previewAccent: "#b95525",
    previewHeaderStyle: { fontFamily: "'Noto Serif SC', serif", color: "#2c2a29" },
    previewCardStyle: { backgroundColor: "#f3efe6", borderColor: "#e3dec3", borderLeft: "4px solid #b95525" },
    sampleCallout: {
      bg: "#f3efe6",
      border: "#e3dec3",
      text: "#b95525",
      icon: "📜",
      content: "人文印记：文字不仅仅是信息的载体，更是一种温暖的书卷呼吸体验。"
    }
  },
  {
    id: "cyber_tech",
    title: "赛博暗黑科技",
    subtitle: "Industrial Brutalist Terminal",
    tag: "酷炫偏光",
    vibe: "工业终端 • JetBrains Mono • Industrial Neon Cyan",
    font: "JetBrains Mono + Noto Sans SC",
    palette: ["#0a0a0c", "#18181f", "#ff5500", "#00f0ff"],
    description: "硬核工业极客终端风格，全网格点阵底纹，采用单间隔 Mono 字符与高亮度 Neon Cyan/Orange 强对比反差。",
    previewBg: "#0a0a0c",
    previewText: "#e2e8f0",
    previewBorder: "#2d3748",
    previewAccent: "#00f0ff",
    previewHeaderStyle: { fontFamily: "'JetBrains Mono', monospace", color: "#ffffff" },
    previewCardStyle: { backgroundColor: "#18181f", borderColor: "#2d3748", borderLeft: "4px solid #00f0ff" },
    sampleCallout: {
      bg: "#18181f",
      border: "#4a5568",
      text: "#00f0ff",
      icon: "⌨️",
      content: "[SYS_INFO]: HARDCORE TERMINAL GRID RENDER ENGINE LOADED."
    }
  },
  {
    id: "minimal_modern",
    title: "瑞士极简现代",
    subtitle: "Swiss Architectural Minimalist",
    tag: "留白气感",
    vibe: "瑞士国际主义 • 建筑刻度 • 空气感留白",
    font: "Inter + Noto Sans SC + JetBrains Mono",
    palette: ["#ffffff", "#f5f5f7", "#111111", "#888888"],
    description: "瑞士包豪斯与建筑美学，极致大字刻度对比与大跨度布局留白，排版严谨，传递高级艺术画册出版物风貌。",
    previewBg: "#ffffff",
    previewText: "#111111",
    previewBorder: "#e5e5eb",
    previewAccent: "#111111",
    previewHeaderStyle: { fontFamily: "Inter, sans-serif", color: "#111111" },
    previewCardStyle: { backgroundColor: "#f5f5f7", borderColor: "#e5e5eb", borderLeft: "3px solid #111111" },
    sampleCallout: {
      bg: "#f5f5f7",
      border: "#e5e5eb",
      text: "#111111",
      icon: "📐",
      content: "LESS IS MORE: 真正的极简是用精准的比例与留白赋予内容呼吸。"
    }
  }
];

export default function ThemeManualModal({
  isOpen,
  onClose,
  currentStyle,
  onSelectStyle
}: ThemeManualModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Sync index when opening modal to match current active style
  useEffect(() => {
    if (isOpen) {
      const foundIdx = THEME_SPECIMENS.findIndex(s => s.id === currentStyle);
      if (foundIdx !== -1) {
        setCurrentIndex(foundIdx);
      }
    }
  }, [isOpen, currentStyle]);

  // Keyboard navigation (ArrowLeft / ArrowRight / Escape)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentIndex]);

  if (!isOpen) return null;

  const currentSpecimen = THEME_SPECIMENS[currentIndex];
  const isSelected = currentSpecimen.id === currentStyle;

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % THEME_SPECIMENS.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + THEME_SPECIMENS.length) % THEME_SPECIMENS.length);
  };

  const handleApply = () => {
    onSelectStyle(currentSpecimen.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md animate-fade-in">
      {/* Modal Card */}
      <div 
        className="relative w-full max-w-4xl bg-bg-card border border-border-card rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-card bg-bg-bezel/50">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-accent-theme/10 text-accent-text">
              <BookOpen size={16} strokeWidth={2} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-text-title flex items-center gap-2">
                视觉主题画册手册
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-theme/15 text-accent-text font-mono font-medium">
                  SPECIMEN BOOK
                </span>
              </h3>
              <p className="text-[11px] text-text-muted">按键盘 ← → 翻页预览 5 套定制排版导出效果</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted font-mono bg-bg-bezel px-2.5 py-1 rounded-lg border border-border-bezel">
              第 {currentIndex + 1} / {THEME_SPECIMENS.length} 页
            </span>
            <button
              onClick={onClose}
              className="p-2 text-text-muted hover:text-text-title hover:bg-bg-bezel rounded-full transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body: Book Page Specimen Display */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {/* Flipbook Header Controls & Page Tabs */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {THEME_SPECIMENS.map((specimen, idx) => (
                <button
                  key={specimen.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    currentIndex === idx
                      ? "bg-accent-theme text-white shadow-md font-semibold scale-105"
                      : "bg-bg-bezel text-text-muted hover:text-text-title border border-border-bezel"
                  }`}
                >
                  <span>{specimen.title}</span>
                  {currentStyle === specimen.id && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  )}
                </button>
              ))}
            </div>

            {/* Prev / Next Arrows */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                className="p-2 rounded-xl bg-bg-bezel border border-border-bezel text-text-body hover:text-text-title hover:border-accent-border transition-colors cursor-pointer"
                title="上一页 (←)"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={handleNext}
                className="p-2 rounded-xl bg-bg-bezel border border-border-bezel text-text-body hover:text-text-title hover:border-accent-border transition-colors cursor-pointer"
                title="下一页 (→)"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Page Main Content Stage (Simulated Render Preview Sheet) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Info & Specimen Cards (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-accent-theme/10 text-accent-text border border-accent-border/30">
                    {currentSpecimen.tag}
                  </span>
                  <span className="text-xs text-text-muted font-mono">{currentSpecimen.subtitle}</span>
                </div>
                <h2 className="text-2xl font-extrabold text-text-title tracking-tight">
                  {currentSpecimen.title}
                </h2>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {currentSpecimen.description}
                </p>
              </div>

              {/* Specs List */}
              <div className="p-4 rounded-2xl bg-bg-bezel/70 border border-border-bezel space-y-2.5 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-border-bezel/50">
                  <span className="text-text-muted">视觉设计语汇 (Vibe)</span>
                  <span className="font-medium text-text-title text-right">{currentSpecimen.vibe}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-border-bezel/50">
                  <span className="text-text-muted">使用字体栈 (Fonts)</span>
                  <span className="font-mono text-[11px] text-accent-text text-right">{currentSpecimen.font}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">调色盘 (Palette)</span>
                  <div className="flex items-center gap-1.5">
                    {currentSpecimen.palette.map((color, i) => (
                      <span
                        key={i}
                        className="w-4 h-4 rounded-full border border-black/20 shadow-sm"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleApply}
                className={`w-full py-3 px-5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
                  isSelected
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-accent-theme text-white hover:opacity-95 active:scale-[0.98]"
                }`}
              >
                {isSelected ? (
                  <>
                    <Check size={16} /> <span>当前已选定此主题</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} /> <span>应用此主题排版</span>
                  </>
                )}
              </button>
            </div>

            {/* Right Live Specimen Mockup (7 cols) */}
            <div className="lg:col-span-7">
              <div 
                className="w-full rounded-2xl p-6 sm:p-8 border shadow-xl transition-all duration-300 text-left min-h-[380px] flex flex-col justify-between"
                style={{ 
                  backgroundColor: currentSpecimen.previewBg,
                  color: currentSpecimen.previewText,
                  borderColor: currentSpecimen.previewBorder
                }}
              >
                {/* Header Section */}
                <div className="space-y-4">
                  {/* Article Title Specimen */}
                  <h1 
                    className="text-xl sm:text-2xl font-bold leading-tight"
                    style={currentSpecimen.previewHeaderStyle}
                  >
                    《如何构建高可用 AI 智能体应用架构》
                  </h1>

                  {/* Integrated Source Card Specimen */}
                  <div 
                    className="p-3.5 rounded-xl border flex flex-col gap-2.5 text-xs shadow-sm"
                    style={currentSpecimen.previewCardStyle}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[11px] opacity-80 flex items-center gap-1">
                        🎬 Bilibili 原创内容出处
                      </span>
                      <span 
                        className="text-[11px] px-2 py-0.5 rounded border font-medium flex items-center gap-1"
                        style={{ borderColor: currentSpecimen.previewAccent, color: currentSpecimen.previewAccent }}
                      >
                        <ExternalLink size={10} /> 观看原视频
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] opacity-75">
                      <span>原作者: 架构精进堂</span>
                      <span>•</span>
                      <span>发布时间: 2026-08-10</span>
                      <span>•</span>
                      <span>时长: 18:45</span>
                    </div>
                  </div>

                  {/* Prose Body Lines Specimen */}
                  <div className="space-y-2.5 text-xs opacity-90 leading-relaxed">
                    <p>
                      在现代软件开发中，人工智能大语言模型的接入正在颠覆传统的架构设计范式。如何保持系统高并发响应与长下文上下文的稳定性，是当前核心难题之一。
                    </p>
                    
                    <h2 
                      className="text-sm font-bold pt-2 border-b pb-1 opacity-100"
                      style={{ borderColor: currentSpecimen.previewBorder, color: currentSpecimen.previewText }}
                    >
                      一、 模块拆分与解耦设计
                    </h2>
                    
                    <p>
                      解耦模型推理逻辑与业务交互链路，不仅能大幅降低系统复杂度，还可利用流式传输改善最终用户的交互感知延迟。
                    </p>
                  </div>

                  {/* Callout Box Specimen */}
                  <div 
                    className="p-3 rounded-xl border flex items-start gap-2.5 text-xs"
                    style={{
                      backgroundColor: currentSpecimen.sampleCallout.bg,
                      borderColor: currentSpecimen.sampleCallout.border,
                      color: currentSpecimen.sampleCallout.text
                    }}
                  >
                    <span className="text-base">{currentSpecimen.sampleCallout.icon}</span>
                    <p className="m-0 text-[11px] leading-snug">{currentSpecimen.sampleCallout.content}</p>
                  </div>
                </div>

                {/* Footer Stamp */}
                <div className="pt-4 border-t text-[10px] opacity-40 text-center font-mono" style={{ borderColor: currentSpecimen.previewBorder }}>
                  {currentSpecimen.title} · REALTIME SPECIMEN PREVIEW
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-border-card bg-bg-bezel/50 flex items-center justify-between">
          <span className="text-[11px] text-text-muted">
            提示：选择后点击“应用此主题”即可更新当前转换配置。
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-bg-bezel border border-border-bezel text-text-body hover:text-text-title transition-colors cursor-pointer"
          >
            关闭手册
          </button>
        </div>
      </div>
    </div>
  );
}
