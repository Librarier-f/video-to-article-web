import { useState, useEffect } from "react";
import { 
  BookOpen, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Sparkles, 
  ExternalLink
} from "lucide-react";

interface FullThemeManualViewProps {
  currentStyle: string;
  onSelectStyle: (styleKey: string) => void;
  onBackToInput?: () => void;
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

export default function FullThemeManualView({
  currentStyle,
  onSelectStyle,
}: FullThemeManualViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Sync index on load
  useEffect(() => {
    const foundIdx = THEME_SPECIMENS.findIndex((s) => s.id === currentStyle);
    if (foundIdx !== -1) {
      setCurrentIndex(foundIdx);
    }
  }, [currentStyle]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex]);

  const currentSpecimen = THEME_SPECIMENS[currentIndex];
  const isSelected = currentSpecimen.id === currentStyle;

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % THEME_SPECIMENS.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + THEME_SPECIMENS.length) % THEME_SPECIMENS.length);
  };

  return (
    <div className="flex flex-col h-full bg-bg-card rounded-[24px] border border-border-card overflow-hidden shadow-2xl animate-fade-in">
      {/* Top Fullscreen Header Control Bar */}
      <div className="px-6 py-4 border-b border-border-card bg-bg-bezel/60 flex items-center justify-between flex-wrap gap-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-accent-theme/15 text-accent-text border border-accent-border/30">
            <BookOpen size={20} strokeWidth={2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-text-title">视觉排版主题设计手册</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-accent-theme/10 text-accent-text font-semibold border border-accent-border/20">
                FULLSCREEN SPECIMEN BOOK
              </span>
            </div>
            <p className="text-xs text-text-muted">全屏沉浸浏览 5 套排版风格导出示例（按键盘 ← → 翻页）</p>
          </div>
        </div>

        {/* Page Switcher Tabs & Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-bg-bezel p-1 rounded-2xl border border-border-bezel overflow-x-auto max-w-full">
            {THEME_SPECIMENS.map((specimen, idx) => (
              <button
                key={specimen.id}
                onClick={() => setCurrentIndex(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  currentIndex === idx
                    ? "bg-accent-theme text-white shadow-md font-semibold"
                    : "text-text-muted hover:text-text-title"
                }`}
              >
                <span>{specimen.title}</span>
                {currentStyle === specimen.id && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrev}
              className="p-2 rounded-xl bg-bg-bezel border border-border-bezel text-text-body hover:text-text-title hover:border-accent-border transition-colors cursor-pointer"
              title="上一页 (←)"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-mono text-text-muted bg-bg-bezel px-2.5 py-1.5 rounded-xl border border-border-bezel">
              {currentIndex + 1} / {THEME_SPECIMENS.length}
            </span>
            <button
              onClick={handleNext}
              className="p-2 rounded-xl bg-bg-bezel border border-border-bezel text-text-body hover:text-text-title hover:border-accent-border transition-colors cursor-pointer"
              title="下一页 (→)"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Set Theme Action */}
          <button
            onClick={() => onSelectStyle(currentSpecimen.id)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md ${
              isSelected
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-accent-theme text-white hover:opacity-95 active:scale-[0.98]"
            }`}
          >
            {isSelected ? (
              <>
                <Check size={15} /> <span>当前主题生效中</span>
              </>
            ) : (
              <>
                <Sparkles size={15} /> <span>设定为此排版主题</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area: Left Specimen Meta + Right Interactive Stage */}
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Specimen Profile Summary Bar */}
          <div className="p-6 rounded-3xl bg-bg-bezel/50 border border-border-bezel flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-accent-theme/15 text-accent-text border border-accent-border/30">
                  {currentSpecimen.tag}
                </span>
                <span className="text-xs font-mono text-text-muted">{currentSpecimen.subtitle}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-text-title tracking-tight">
                {currentSpecimen.title}
              </h1>
              <p className="text-xs text-text-body leading-relaxed max-w-2xl">
                {currentSpecimen.description}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="space-y-1 bg-bg-card p-3 rounded-2xl border border-border-card min-w-[160px]">
                <span className="text-[10px] text-text-muted uppercase tracking-wider block font-semibold">视觉语汇</span>
                <span className="font-semibold text-text-title">{currentSpecimen.vibe}</span>
              </div>
              <div className="space-y-1 bg-bg-card p-3 rounded-2xl border border-border-card min-w-[160px]">
                <span className="text-[10px] text-text-muted uppercase tracking-wider block font-semibold">使用的字体</span>
                <span className="font-mono text-accent-text font-medium">{currentSpecimen.font}</span>
              </div>
              <div className="space-y-1 bg-bg-card p-3 rounded-2xl border border-border-card">
                <span className="text-[10px] text-text-muted uppercase tracking-wider block font-semibold">主题调色盘</span>
                <div className="flex items-center gap-1.5 pt-1">
                  {currentSpecimen.palette.map((color, i) => (
                    <span
                      key={i}
                      className="w-5 h-5 rounded-full border border-black/20 shadow-sm"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Live Full Article Render Mock Stage */}
          <div className="shadow-2xl rounded-3xl overflow-hidden border border-black/20">
            <div 
              className="w-full p-8 sm:p-14 transition-all duration-300 min-h-[700px] text-left"
              style={{
                backgroundColor: currentSpecimen.previewBg,
                color: currentSpecimen.previewText,
                borderColor: currentSpecimen.previewBorder
              }}
            >
              <div className="max-w-2xl mx-auto space-y-8">
                {/* Article Header Specimen */}
                <div className="space-y-6">
                  <h1 
                    className="text-2xl sm:text-4xl font-extrabold leading-tight tracking-tight"
                    style={currentSpecimen.previewHeaderStyle}
                  >
                    《如何构建高可用 AI 智能体应用架构与长文本处理》
                  </h1>

                  {/* Integrated Source Card Specimen */}
                  <div 
                    className="p-5 rounded-2xl border flex flex-col gap-3 text-xs shadow-md"
                    style={currentSpecimen.previewCardStyle}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs opacity-90 flex items-center gap-1.5">
                        🎬 Bilibili 原创内容出处
                      </span>
                      <span 
                        className="text-xs px-3 py-1 rounded-md border font-semibold flex items-center gap-1"
                        style={{ borderColor: currentSpecimen.previewAccent, color: currentSpecimen.previewAccent }}
                      >
                        <ExternalLink size={12} /> 观看原视频
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs opacity-80 pt-1">
                      <span>原作者: 架构精进堂</span>
                      <span>•</span>
                      <span>发布时间: 2026-08-10</span>
                      <span>•</span>
                      <span>视频时长: 18:45</span>
                    </div>
                  </div>
                </div>

                {/* Article Main Prose Specimen */}
                <div className="space-y-4 text-sm sm:text-base leading-relaxed opacity-95">
                  <p>
                    在现代软件开发中，人工智能大语言模型（LLM）的接入正在全面颠覆传统的单体架构设计范式。如何保持系统在高并发响应下的稳定性，并有效缓解长时间推理中的长上下文延迟，已成为当下技术团队所面临的核心工程考验。
                  </p>

                  <h2 
                    className="text-xl font-bold pt-4 pb-1 border-b"
                    style={{ borderColor: currentSpecimen.previewBorder, color: currentSpecimen.previewText }}
                  >
                    一、 核心模块拆分与解耦设计
                  </h2>

                  <p>
                    将大模型的推理逻辑与前台业务逻辑彻底解耦，不仅能够大幅降低微服务间的耦合度，还能够利用服务器端 SSE（Server-Sent Events）流式传输，极大地提升用户端感知响应的交互流畅度。
                  </p>

                  <ul>
                    <li><strong>异步任务队列：</strong>采用后台线程解耦高耗时长视频提取流程。</li>
                    <li><strong>上下文分块机制：</strong>根据字幕长度智能判定一次性精写或分章串行精写。</li>
                    <li><strong>双重标记校验：</strong>严格输出 HTML 节点与语义 Callout，摒弃混乱的双星号粗体符号。</li>
                  </ul>

                  <h2 
                    className="text-xl font-bold pt-4 pb-1 border-b"
                    style={{ borderColor: currentSpecimen.previewBorder, color: currentSpecimen.previewText }}
                  >
                    二、 重点信息与 Callout 高亮盒
                  </h2>

                  {/* Callout Box Specimen */}
                  <div 
                    className="p-4 rounded-xl border flex items-start gap-3 text-sm my-4 shadow-sm"
                    style={{
                      backgroundColor: currentSpecimen.sampleCallout.bg,
                      borderColor: currentSpecimen.sampleCallout.border,
                      color: currentSpecimen.sampleCallout.text
                    }}
                  >
                    <span className="text-xl flex-shrink-0">{currentSpecimen.sampleCallout.icon}</span>
                    <p className="m-0 leading-normal">{currentSpecimen.sampleCallout.content}</p>
                  </div>

                  <blockquote className="p-4 border-l-4 opacity-80 my-4 text-sm" style={{ borderColor: currentSpecimen.previewAccent }}>
                    “架构设计的艺术，本质上是在约束与灵活性之间寻找最优雅的平衡。”
                  </blockquote>

                  <p>
                    通过合理的视觉分层与模板系统渲染，长篇字幕得以化繁为简，呈现出如高品质书籍出版物一般的极致阅读与研习体验。
                  </p>
                </div>

                {/* Article Footer Specimen */}
                <div className="pt-8 border-t text-xs opacity-50 text-center font-mono" style={{ borderColor: currentSpecimen.previewBorder }}>
                  💡 {currentSpecimen.title} · 全屏高保真排版 Specimen 视图渲染完成
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
