export interface CustomApiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

type ConfigStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export const CUSTOM_API_SETTINGS_EVENT = "custom-api-settings-changed";
const keys = { baseUrl: "byok_custom_base_url", apiKey: "byok_custom_key", model: "byok_custom_model" };

export function loadCustomApiConfig(storage: ConfigStorage = localStorage): CustomApiConfig {
  return {
    baseUrl: storage.getItem(keys.baseUrl) || "",
    apiKey: storage.getItem(keys.apiKey) || "",
    model: storage.getItem(keys.model) || "",
  };
}

export function saveCustomApiConfig(config: CustomApiConfig, storage: ConfigStorage = localStorage) {
  for (const field of ["baseUrl", "apiKey", "model"] as const) {
    const value = field === "baseUrl" ? config[field].trim().replace(/\/+$/, "") : config[field].trim();
    if (value) storage.setItem(keys[field], value);
    else storage.removeItem(keys[field]);
  }
}

export function validateCustomApiConfig(config: CustomApiConfig): string {
  try {
    const url = new URL(config.baseUrl.trim());
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error("invalid URL");
    }
  } catch {
    return "请填写有效的 HTTP/HTTPS Base URL，不包含账号、查询参数或片段。";
  }
  if (!config.apiKey.trim()) return "请填写自定义 API Key。";
  if (!config.model.trim()) return "请填写自定义模型名称。";
  return "";
}
