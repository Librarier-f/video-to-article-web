import { useState } from "react";
import { FileText, Trash2, Plus, Search, Video, Clock } from "lucide-react";
import type { ArticleResponseData, TaskResponseData } from "../utils/api";

interface HistoryPanelProps {
  articles: ArticleResponseData[];
  activeTasks?: TaskResponseData[];
  selectedArticleId: number | null;
  selectedActiveTaskId: string | null;
  onSelectArticle: (id: number) => void;
  onSelectActiveTask: (id: string) => void;
  onDeleteArticle: (id: number) => void;
  onNewTask: () => void;
}

export default function HistoryPanel({
  articles,
  activeTasks = [],
  selectedArticleId,
  selectedActiveTaskId,
  onSelectArticle,
  onSelectActiveTask,
  onDeleteArticle,
  onNewTask,
}: HistoryPanelProps) {
  const [search, setSearch] = useState("");

  const filteredArticles = articles.filter(
    (a) =>
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.author.toLowerCase().includes(search.toLowerCase())
  );

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}分${secs}秒`;
  };

  return (
    <div className="flex flex-col h-full bg-bg-sidebar/80 border-r border-border-bezel backdrop-blur-xl w-full text-text-body">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-border-card flex items-center justify-between">
        <span className="text-sm font-semibold text-text-muted flex items-center gap-1.5 uppercase tracking-wider">
          <FileText size={14} strokeWidth={1.5} className="text-accent-text" />
          <span>转换历史 ({articles.length})</span>
        </span>
        <button
          onClick={onNewTask}
          className="p-2 hover:bg-bg-bezel active:scale-[0.95] text-accent-text hover:text-accent-text/80 rounded-full transition-spring focus:outline-none cursor-pointer"
          title="新建转换任务"
        >
          <Plus size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div className="p-3.5 border-b border-border-card relative flex items-center">
        <Search size={13} strokeWidth={1.5} className="absolute left-6.5 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索历史标题或作者..."
          className="w-full bg-bg-bezel border border-border-bezel rounded-xl pl-9 pr-3 py-2 text-xs text-text-title placeholder:text-text-muted/60 focus:outline-none focus:border-accent-border transition-spring shadow-inner"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Active Tasks list */}
        {activeTasks.length > 0 && (
          <div className="p-3 border-b border-border-card space-y-2">
            <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">
              当前任务 ({activeTasks.length})
            </div>
            {activeTasks.map((task) => {
              let logs = [];
              try { logs = JSON.parse(task.logs); } catch (e) {}
              const lastLog = logs.length > 0 ? logs[logs.length - 1] : "正在初始化...";
              const isSelected = selectedActiveTaskId === task.id;

              return (
                <div 
                  key={task.id} 
                  onClick={() => onSelectActiveTask(task.id)}
                  className={`border rounded-2xl p-3 flex flex-col gap-2 cursor-pointer transition-spring ${
                    isSelected
                      ? "bg-accent-light border-accent-border shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]"
                      : "bg-bg-card/40 border-border-card hover:bg-bg-bezel hover:border-border-bezel"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold truncate transition-colors ${isSelected ? "text-text-title" : "text-text-body/90"}`} title={task.video_url}>
                      {task.video_url}
                    </span>
                    <span className="text-[10px] font-mono text-accent-text">{Math.round(task.progress)}%</span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="h-1.5 w-full bg-bg-bezel rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-accent-theme transition-all duration-500 ease-out rounded-full"
                      style={{ width: `${Math.max(2, task.progress)}%` }}
                    />
                  </div>

                  <div className="text-[10px] text-text-muted truncate">
                    {lastLog}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* History Items list */}
        <div className="p-3 space-y-1">
          {filteredArticles.length === 0 ? (
          <div className="text-center text-xs text-text-muted py-12">
            {search ? "没有匹配的历史记录" : "暂无历史记录"}
          </div>
        ) : (
          filteredArticles.map((a) => {
            const isSelected = selectedArticleId === a.id;
            return (
              <div
                key={a.id}
                onClick={() => onSelectArticle(a.id)}
                className={`group flex items-start gap-2.5 p-3 rounded-2xl cursor-pointer relative border transition-spring ${
                  isSelected
                    ? "bg-accent-light border-accent-border shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]"
                    : "bg-bg-card/40 border-border-card hover:bg-bg-bezel hover:border-border-bezel"
                }`}
              >
                <div className="flex-shrink-0 mt-0.5 text-text-muted">
                  <Video size={14} strokeWidth={1.5} className={isSelected ? "text-accent-text" : ""} />
                </div>
                
                <div className="flex-1 min-w-0 pr-6">
                  <h4 className={`text-xs font-semibold truncate mb-1.5 transition-colors ${isSelected ? "text-text-title" : "text-text-body/90"}`} title={a.title}>
                    {a.title}
                  </h4>
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] text-text-muted">
                    <span className="truncate max-w-[80px]">@{a.author}</span>
                    <span className="flex items-center gap-0.5">
                      <Clock size={8} strokeWidth={1.5} /> {formatDuration(a.duration)}
                    </span>
                    <span>{a.publish_date}</span>
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`确认要删除文章 《${a.title}》 吗？`)) {
                      onDeleteArticle(a.id);
                    }
                  }}
                  className="absolute right-2.5 top-3 p-1.5 text-text-muted hover:text-red-400 hover:bg-red-500/10 active:scale-[0.95] rounded-full transition-spring opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none cursor-pointer"
                  title="删除历史记录"
                >
                  <Trash2 size={12} strokeWidth={1.5} />
                </button>
              </div>
            );
          })
          )}
        </div>
      </div>
    </div>
  );
}
