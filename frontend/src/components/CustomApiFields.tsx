import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { CustomApiConfig } from "../utils/customApiConfig";

interface Props {
  config: CustomApiConfig;
  onChange: (config: CustomApiConfig) => void;
  idPrefix: string;
  disabled?: boolean;
  showModel?: boolean;
}

export default function CustomApiFields({ config, onChange, idPrefix, disabled, showModel = true }: Props) {
  const [showKey, setShowKey] = useState(false);
  const inputClass = "w-full bg-bg-bezel border border-border-bezel rounded-xl px-3 py-2.5 text-xs text-text-body placeholder:text-text-muted/60 focus:outline-none focus:border-accent-border transition-spring";
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-base-url`} className="text-[10px] text-text-muted font-medium">Base URL</label>
        <input id={`${idPrefix}-base-url`} type="url" value={config.baseUrl} disabled={disabled}
          onChange={(event) => onChange({ ...config, baseUrl: event.target.value })}
          placeholder="https://your-api.example/v1" className={inputClass} autoComplete="off" />
        <p className="text-[10px] text-text-muted">支持 OpenAI 兼容接口，可填写接口前缀或完整的 /chat/completions 地址。</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-api-key`} className="text-[10px] text-text-muted font-medium">API Key</label>
        <div className="relative">
          <input id={`${idPrefix}-api-key`} type={showKey ? "text" : "password"} value={config.apiKey} disabled={disabled}
            onChange={(event) => onChange({ ...config, apiKey: event.target.value })}
            placeholder="输入该接口的 API Key" className={`${inputClass} pr-10`} autoComplete="off" spellCheck={false} />
          <button type="button" onClick={() => setShowKey(!showKey)} disabled={disabled}
            aria-label={showKey ? "隐藏自定义 API Key" : "显示自定义 API Key"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-title cursor-pointer">
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>
      {showModel && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-model`} className="text-[10px] text-text-muted font-medium">模型名称</label>
          <input id={`${idPrefix}-model`} value={config.model} disabled={disabled}
            onChange={(event) => onChange({ ...config, model: event.target.value })}
            placeholder="填写接口实际支持的模型 ID" className={inputClass} autoComplete="off" />
        </div>
      )}
    </div>
  );
}
