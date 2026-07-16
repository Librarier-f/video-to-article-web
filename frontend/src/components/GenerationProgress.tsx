import { useEffect, useRef } from "react";
import { Loader2, AlertCircle, CheckCircle2, Terminal } from "lucide-react";

interface GenerationProgressProps {
  progress: number;
  currentStep: string;
  logs: string[];
  status: string;
}

export default function GenerationProgress({ progress, currentStep, logs, status }: GenerationProgressProps) {
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs terminal to bottom
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const isFailed = status === "failed";
  const isCompleted = status === "completed";

  return (
    <div className="p-[6px] rounded-[24px] bg-bg-bezel border border-border-bezel shadow-[0_24px_64px_rgba(0,0,0,0.15)] w-full max-w-xl transition-all duration-300">
      <div className="bg-bg-card rounded-[18px] p-6 border border-border-card backdrop-blur-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] flex flex-col gap-5">
        {/* Step and Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-border-card">
          <div className="flex items-center gap-2">
            {isFailed ? (
              <AlertCircle className="text-red-400 animate-pulse" size={16} strokeWidth={1.5} />
            ) : isCompleted ? (
              <CheckCircle2 className="text-emerald-500 animate-bounce" size={16} strokeWidth={1.5} />
            ) : (
              <Loader2 className="text-accent-text animate-spin" size={16} strokeWidth={1.5} />
            )}
            <span className="text-xs font-semibold text-text-title">
              {isFailed ? "生成任务失败" : isCompleted ? "生成全部完成" : "异步生成流水线运行中"}
            </span>
          </div>
          <span className="text-[10px] text-text-muted font-mono">
            进度: {Math.round(progress)}%
          </span>
        </div>

        {/* Progress Bar Container */}
        <div className="w-full bg-bg-bezel border border-border-bezel rounded-full h-3 overflow-hidden shadow-inner p-[2px]">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out shadow-sm ${
              isFailed
                ? "bg-red-500"
                : isCompleted
                ? "bg-emerald-500"
                : "bg-accent-theme"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Current Step Description */}
        <div className="text-[11px] bg-bg-bezel border border-border-card rounded-xl px-4 py-3 text-text-body">
          <span className="font-semibold text-accent-text uppercase tracking-wider text-[9px] mr-1.5 bg-accent-light border border-accent-border px-2 py-0.5 rounded-full">当前状态</span> {currentStep}
        </div>

        {/* Terminal logs monitor */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-[10px] text-text-muted uppercase tracking-wider font-semibold">
            <Terminal size={12} strokeWidth={1.5} />
            <span>后台处理日志监控</span>
          </div>
          <div className="bg-[#07080b]/95 border border-border-card rounded-xl p-4 font-mono text-[10px] text-emerald-400/90 h-48 overflow-y-auto space-y-2 shadow-inner">
            {logs.map((log, i) => (
              <div key={i} className="leading-relaxed border-l-2 border-emerald-500/20 pl-2.5">
                {log}
              </div>
            ))}
            {/* Blink cursor if active */}
            {!isCompleted && !isFailed && (
              <div className="flex items-center gap-1.5 text-text-muted pt-1">
                <Loader2 className="animate-spin text-accent-text" size={10} strokeWidth={1.5} />
                <span className="animate-pulse">正在等待下一步日志反馈...</span>
              </div>
            )}
            <div ref={terminalEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
