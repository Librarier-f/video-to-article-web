export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL !== undefined 
  ? import.meta.env.VITE_API_BASE_URL 
  : "http://localhost:8000";
/**
 * Grabs the user's custom API keys from localStorage and compiles them into HTTP headers.
 */
export function getApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const geminiKey = localStorage.getItem("byok_gemini_key");
  const claudeKey = localStorage.getItem("byok_claude_key");
  const openaiKey = localStorage.getItem("byok_openai_key");
  const deepseekKey = localStorage.getItem("byok_deepseek_key");
  const kimiKey = localStorage.getItem("byok_kimi_key");
  const imaClientId = localStorage.getItem("byok_ima_client_id");
  const imaKey = localStorage.getItem("byok_ima_key");

  if (geminiKey) headers["X-Gemini-Key"] = geminiKey.trim();
  if (claudeKey) headers["X-Claude-Key"] = claudeKey.trim();
  if (openaiKey) headers["X-OpenAI-Key"] = openaiKey.trim();
  if (deepseekKey) headers["X-Deepseek-Key"] = deepseekKey.trim();
  if (kimiKey) headers["X-Kimi-Key"] = kimiKey.trim();
  if (imaClientId) headers["X-Ima-Client-Id"] = imaClientId.trim();
  if (imaKey) headers["X-Ima-Key"] = imaKey.trim();

  return headers;
}

export interface TaskCreatePayload {
  video_url: string;
  style: string;
  language: string;
  sessdata?: string;
  provider: string;
  model: string;
  api_base_url?: string;
  custom_api_key?: string;
}

export interface TaskResponseData {
  id: string;
  video_url: string;
  platform: string;
  style: string;
  language: string;
  status: string;
  progress: number;
  current_step: string;
  logs: string; // JSON string array
  created_at: string;
  updated_at: string;
}

export interface ArticleResponseData {
  id: number;
  task_id: string;
  title: string;
  author: string;
  duration: number;
  publish_date: string;
  thumbnail_url: string;
  video_url: string;
  created_at: string;
}

export interface ArticleDetailResponseData extends ArticleResponseData {
  html_content: string;
  markdown_content?: string;
  mermaid_code?: string;
  anki_csv?: string;
}

// REST API calls
export async function createConvertTask(payload: TaskCreatePayload): Promise<TaskResponseData> {
  const res = await fetch(`${API_BASE_URL}/api/task`, {
    method: "POST",
    headers: getApiHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "创建任务失败");
  }
  return res.json();
}

export async function fetchTaskStatus(taskId: string): Promise<TaskResponseData> {
  const res = await fetch(`${API_BASE_URL}/api/task/${taskId}`);
  if (!res.ok) {
    throw new Error("查询任务进度失败");
  }
  return res.json();
}

export async function fetchHistoryList(): Promise<ArticleResponseData[]> {
  const res = await fetch(`${API_BASE_URL}/api/history`);
  if (!res.ok) {
    throw new Error("获取历史记录失败");
  }
  return res.json();
}

export async function fetchArticleDetails(articleId: number): Promise<ArticleDetailResponseData> {
  const res = await fetch(`${API_BASE_URL}/api/history/${articleId}`);
  if (!res.ok) {
    throw new Error("获取文章详情失败");
  }
  return res.json();
}

export async function deleteArticleRecord(articleId: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/history/${articleId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("删除文章记录失败");
  }
}

export async function fetchImaKnowledgeBases(): Promise<{ knowledge_base_id: string; name: string }[]> {
  const res = await fetch(`${API_BASE_URL}/api/ima/knowledge-bases`, {
    headers: getApiHeaders(),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "获取 IMA 知识库列表失败");
  }
  const data = await res.json();
  return data.data || [];
}

export async function exportToIma(articleId: number, kbId?: string): Promise<{ url?: string; note_id?: string }> {
  const payload: any = {};
  if (kbId) {
    payload.knowledge_base_id = kbId;
  }
  
  const res = await fetch(`${API_BASE_URL}/api/export/ima/${articleId}`, {
    method: "POST",
    headers: getApiHeaders(),
    body: Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "导出到 IMA 失败");
  }
  return res.json();
}


export function getDownloadUrl(articleId: number): string {
  return `${API_BASE_URL}/api/article/${articleId}/download`;
}

export function getMarkdownDownloadUrl(articleId: number): string {
  return `${API_BASE_URL}/api/article/${articleId}/download/markdown`;
}
