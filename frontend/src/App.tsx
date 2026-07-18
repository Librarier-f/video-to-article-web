import { useState, useEffect } from "react";
import { 
  Menu, 
  Settings as SettingsIcon, 
  Sun, 
  Moon, 
  Plus, 
  Video, 
  Sparkles,
  ArrowRight
} from "lucide-react";
import { 
  createConvertTask, 
  fetchTaskStatus, 
  fetchHistoryList, 
  fetchArticleDetails, 
  deleteArticleRecord
} from "./utils/api";
import type {
  TaskCreatePayload, 
  TaskResponseData, 
  ArticleResponseData, 
  ArticleDetailResponseData 
} from "./utils/api";

import SettingsPanel from "./components/SettingsPanel";
import VideoInput from "./components/VideoInput";
import GenerationProgress from "./components/GenerationProgress";
import HistoryPanel from "./components/HistoryPanel";
import ArticlePreview from "./components/ArticlePreview";

export default function App() {
  // App global state
  const [history, setHistory] = useState<ArticleResponseData[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<ArticleDetailResponseData | null>(null);
  
  // Active task monitoring (supports multiple tasks)
  const [activeTasks, setActiveTasks] = useState<TaskResponseData[]>([]);
  const [selectedActiveTaskId, setSelectedActiveTaskId] = useState<string | null>(null);
  
  // UI control state
  const [showSettings, setShowSettings] = useState(false);
  const [showMobileHistory, setShowMobileHistory] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize theme
  useEffect(() => {
    const savedTheme = (localStorage.getItem("byok_app_theme") || "dark") as "dark" | "light";
    setTheme(savedTheme);
    document.documentElement.className = savedTheme;
  }, []);

  // Fetch history list on load
  const loadHistory = async () => {
    try {
      const data = await fetchHistoryList();
      setHistory(data);
    } catch (err: any) {
      console.error(err);
      setError("无法连接到后端服务，请检查后端是否正在运行。");
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Handle multiple active tasks polling
  useEffect(() => {
    if (activeTasks.length === 0) return;

    const interval = setInterval(async () => {
      try {
        let historyNeedsUpdate = false;
        
        const updatedTasks = await Promise.all(
          activeTasks.map(async (task) => {
            try {
              const status = await fetchTaskStatus(task.id);
              if (status.status === "completed" || status.status === "failed") {
                if (status.status === "completed") {
                  if (task.id === selectedActiveTaskId) {
                    setSelectedActiveTaskId(null); // Deselect if completed
                  }
                  historyNeedsUpdate = true;
                } else if (status.status === "failed") {
                  if (task.id === selectedActiveTaskId) {
                    setSelectedActiveTaskId(null);
                  }
                  try {
                    const logsArray = JSON.parse(status.logs);
                    setError(`任务失败: ${logsArray[logsArray.length - 1] || "生成失败"}`);
                  } catch {
                    setError("任务生成失败");
                  }
                }
                return null; // Task finished, will be filtered out
              }
              return status;
            } catch (err) {
              console.error("Polling error for", task.id, err);
              return task; // Keep old status on fetch error
            }
          })
        );
        
        const newActiveTasks = updatedTasks.filter((t) => t !== null) as TaskResponseData[];
        
        setActiveTasks((prev) => {
          // Only update if lengths match (simple check, assume we didn't add new tasks in the middle of a poll)
          // Actually, just updating is fine, but to avoid race conditions with handleCreateTask, we should be careful.
          // For simplicity, we just set the newly mapped array, but merge any new tasks that might have been added.
          const prevIds = prev.map((p) => p.id);
          const newIds = newActiveTasks.map((n) => n.id);
          const addedSincePoll = prev.filter((p) => !prevIds.includes(p.id) && !newIds.includes(p.id));
          return [...newActiveTasks, ...addedSincePoll];
        });

        if (historyNeedsUpdate) {
          loadHistory();
        }
      } catch (err) {
        console.error("Global polling error:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeTasks]);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("byok_app_theme", newTheme);
    document.documentElement.className = newTheme;
  };

  const handleCreateTask = async (payload: TaskCreatePayload) => {
    setError(null);
    setSelectedArticleId(null);
    setSelectedArticle(null);
    setIsSubmitting(true);

    try {
      const task = await createConvertTask(payload);
      if (task.status === "failed") {
        try {
          const logsArray = JSON.parse(task.logs);
          setError(logsArray[logsArray.length - 1] || "创建失败");
        } catch {
          setError("任务创建失败：可能 API Key 未配置。");
        }
        setIsSubmitting(false);
        return;
      }
      setActiveTasks((prev) => [...prev, task]);
      setSelectedActiveTaskId(task.id);
    } catch (err: any) {
      setError(err.message || "无法创建任务，请重试。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectArticle = async (id: number) => {
    setSelectedArticleId(id);
    setSelectedActiveTaskId(null);
    setShowMobileHistory(false);
    setError(null);

    try {
      const details = await fetchArticleDetails(id);
      setSelectedArticle(details);
    } catch (err) {
      setError("无法加载文章详情。");
    }
  };

  const handleDeleteArticle = async (id: number) => {
    try {
      await deleteArticleRecord(id);
      setHistory((prev) => prev.filter((a) => a.id !== id));
      if (selectedArticleId === id) {
        setSelectedArticleId(null);
        setSelectedArticle(null);
      }
    } catch (err) {
      alert("删除失败，请重试。");
    }
  };

  const handleNewTask = () => {
    setSelectedArticleId(null);
    setSelectedArticle(null);
    setSelectedActiveTaskId(null);
    setError(null);
    setShowMobileHistory(false);
  };

  const handleSelectActiveTask = (id: string) => {
    setSelectedActiveTaskId(id);
    setSelectedArticleId(null);
    setSelectedArticle(null);
    setShowMobileHistory(false);
    setError(null);
  };

  const getLogsArray = (task: TaskResponseData | undefined) => {
    if (!task?.logs) return [];
    try {
      return JSON.parse(task.logs);
    } catch {
      return [];
    }
  };



  return (
    <div className="flex h-screen overflow-hidden bg-bg-app text-text-body font-sans relative">
      {/* 0. Film Grain Noise & Ambient Glow Orbs */}
      <div className="noise-grain" />
      <div 
        className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none animate-mesh-slow z-0 transition-colors duration-1000"
        style={{ backgroundColor: "var(--glow-color-1)" }}
      />
      <div 
        className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none animate-mesh-slower z-0 transition-colors duration-1000"
        style={{ backgroundColor: "var(--glow-color-2)" }}
      />
      
      {/* 1. Desktop History Sidebar */}
      <div className="hidden md:block w-72 h-full flex-shrink-0 relative z-10">
        <HistoryPanel
          articles={history}
          activeTasks={activeTasks}
          selectedArticleId={selectedArticleId}
          selectedActiveTaskId={selectedActiveTaskId}
          onSelectArticle={handleSelectArticle}
          onSelectActiveTask={handleSelectActiveTask}
          onDeleteArticle={handleDeleteArticle}
          onNewTask={handleNewTask}
        />
      </div>

      {/* 2. Mobile History Sliding Drawer */}
      {showMobileHistory && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={() => setShowMobileHistory(false)} />
          <div className="relative w-80 max-w-xs h-full bg-bg-sidebar border-r border-border-bezel flex-col z-50 flex animate-slide-in">
            <HistoryPanel
              articles={history}
              activeTasks={activeTasks}
              selectedArticleId={selectedArticleId}
              selectedActiveTaskId={selectedActiveTaskId}
              onSelectArticle={handleSelectArticle}
              onSelectActiveTask={handleSelectActiveTask}
              onDeleteArticle={handleDeleteArticle}
              onNewTask={handleNewTask}
            />
          </div>
        </div>
      )}

      {/* 3. Main Workspace Container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
        
        {/* Header Bar - Floating Glass Pill */}
        <header className="mx-4 md:mx-6 mt-4 md:mt-6 h-16 border border-border-bezel flex items-center justify-between px-6 bg-bg-card/30 backdrop-blur-xl rounded-full flex-shrink-0 shadow-[0_8px_32px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.05)] z-20 transition-all duration-300">
          <div className="flex items-center gap-3">
            {/* Mobile menu trigger */}
            <button
              onClick={() => setShowMobileHistory(true)}
              className="p-2 hover:bg-bg-bezel active:scale-[0.95] rounded-full text-text-body md:hidden focus:outline-none transition-all cursor-pointer"
            >
              <Menu size={18} strokeWidth={1.5} />
            </button>
            
            <h1 className="text-sm md:text-base font-semibold tracking-wide flex items-center gap-2 text-text-title">
              <Video size={16} strokeWidth={1.5} className="text-accent-text" />
              <span>视频转文章系统</span>
            </h1>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleNewTask}
              className="px-3.5 py-1.5 hover:bg-bg-bezel active:scale-[0.97] text-text-body rounded-full focus:outline-none flex items-center gap-1.5 text-sm transition-spring font-medium cursor-pointer"
              title="新建文章生成"
            >
              <Plus size={15} strokeWidth={1.5} />
              <span>新建</span>
            </button>

            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-bg-bezel active:scale-[0.95] text-text-body rounded-full focus:outline-none transition-spring cursor-pointer"
              title="切换模式"
            >
              {theme === "dark" ? <Sun size={15} strokeWidth={1.5} /> : <Moon size={15} strokeWidth={1.5} />}
            </button>

            <button
              onClick={() => setShowSettings(true)}
              className="pl-3.5 pr-2.5 py-1.5 bg-bg-bezel border border-border-bezel hover:bg-bg-bezel/80 hover:border-border-bezel active:scale-[0.97] text-text-title rounded-full focus:outline-none flex items-center gap-1 text-sm transition-spring font-medium shadow-sm cursor-pointer"
              title="设置 API 密钥"
            >
              <span>设置</span>
              <SettingsIcon size={14} strokeWidth={1.5} className="text-text-muted" />
            </button>
          </div>
        </header>

        {/* Workspace Body Area */}
        <main className={`flex-1 p-4 md:p-6 mx-auto w-full flex flex-col gap-6 relative z-10 ${selectedArticle && !selectedActiveTaskId ? "overflow-hidden max-w-6xl" : "overflow-y-auto max-w-4xl"}`}>
          {/* Error Banner */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-xs text-red-400 flex items-start gap-2.5 animate-fade-up">
              <span className="font-semibold uppercase flex-shrink-0 mt-0.5 text-red-500">⚠️ 运行异常:</span>
              <p className="leading-relaxed flex-1">{error}</p>
            </div>
          )}

          {/* Decision Tree Routing */}
          {selectedActiveTaskId && activeTasks.find((t) => t.id === selectedActiveTaskId) && (
            <div className="flex-1 flex items-center justify-center py-10 animate-fade-up">
              <GenerationProgress
                progress={activeTasks.find((t) => t.id === selectedActiveTaskId)!.progress}
                currentStep={activeTasks.find((t) => t.id === selectedActiveTaskId)!.current_step}
                logs={getLogsArray(activeTasks.find((t) => t.id === selectedActiveTaskId))}
                status={activeTasks.find((t) => t.id === selectedActiveTaskId)!.status}
              />
            </div>
          )}

          {selectedArticle && !selectedActiveTaskId && (
            <div className="flex-1 w-full flex flex-col overflow-hidden animate-fade-up min-h-0">
              <ArticlePreview 
                article={selectedArticle} 
                onRefresh={loadHistory}
              />
            </div>
          )}

          {/* Welcome / Input Screen - Kept in DOM to preserve state, toggled via CSS */}
          <div className={(!selectedArticle && !selectedActiveTaskId) ? "space-y-8 max-w-xl mx-auto w-full pt-6 md:pt-16 animate-fade-up" : "hidden"}>
            <div className="text-center space-y-3 mb-8">
              <div className="inline-flex rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium bg-accent-light border border-accent-border text-accent-text mb-2">
                <Sparkles size={10} className="inline mr-1" /> Premium AI Synthesizer
              </div>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-text-title font-serif">
                视频字幕生成高保真文章
              </h2>
              <p className="text-xs md:text-sm text-text-muted max-w-md mx-auto leading-relaxed">
                一键提取 Bilibili / YouTube 视频字幕，并利用顶级模型进行分章节深度重组与高档 Notion 风格排版。
              </p>
            </div>

            <VideoInput
              onSubmit={handleCreateTask}
              onOpenSettings={() => setShowSettings(true)}
              isLoading={isSubmitting}
            />

            {/* Direct Setup Wizard Prompt */}
            {!localStorage.getItem("byok_gemini_key") && 
             !localStorage.getItem("byok_claude_key") && 
             !localStorage.getItem("byok_openai_key") && (
              <div className="bg-accent-light border border-accent-border rounded-2xl p-5 text-xs text-text-body flex flex-col gap-2.5 shadow-sm">
                <span className="font-semibold text-accent-text flex items-center gap-1.5">💡 快速开始前置步骤：</span>
                <p className="text-text-muted leading-relaxed">
                  当前检测到您尚未在本地浏览器配置任何大模型密钥。本应用为 BYOK 模式，请点击右上角「设置」或下方按钮填入你的大模型 API Key 即可开始。
                </p>
                <button
                  onClick={() => setShowSettings(true)}
                  className="self-start text-accent-text underline hover:text-accent-text/80 flex items-center gap-0.5 mt-1 focus:outline-none transition-colors cursor-pointer"
                >
                  立即去配置密钥 <ArrowRight size={12} strokeWidth={1.5} />
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* 4. Settings Modal Overlay */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      
    </div>
  );
}
