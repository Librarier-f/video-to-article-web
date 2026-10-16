type CredentialStorage = { getItem(key: string): string | null };

/** Credentials remain per browser/request and never become build-time values. */
export function buildApiHeaders(storage: CredentialStorage): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const credentials: Record<string, string> = {
    byok_gemini_key: 'X-Gemini-Key',
    byok_claude_key: 'X-Claude-Key',
    byok_openai_key: 'X-OpenAI-Key',
    byok_deepseek_key: 'X-Deepseek-Key',
    byok_kimi_key: 'X-Kimi-Key',
    byok_glm_key: 'X-Glm-Key',
    byok_minimax_key: 'X-Minimax-Key',
    byok_siliconflow_key: 'X-Siliconflow-Key',
    byok_ima_client_id: 'X-Ima-Client-Id',
    byok_ima_key: 'X-Ima-Key',
  };
  for (const [key, header] of Object.entries(credentials)) {
    const value = storage.getItem(key)?.trim();
    if (value) headers[header] = value;
  }
  return headers;
}
