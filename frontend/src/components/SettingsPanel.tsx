import { useState, useEffect } from "react";
import { Key, Eye, EyeOff, Save, Check, X } from "lucide-react";

interface SettingsPanelProps {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [minimaxKey, setMinimaxKey] = useState("");
  const [glmKey, setGlmKey] = useState("");
  const [kimiKey, setKimiKey] = useState("");
  const [deepseekKey, setDeepseekKey] = useState("");
  const [siliconflowKey, setSiliconflowKey] = useState("");

  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({
    minimax: false,
    glm: false,
    kimi: false,
    deepseek: false,
    siliconflow: false,
  });

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setMinimaxKey(localStorage.getItem("byok_minimax_key") || "");
    setGlmKey(localStorage.getItem("byok_glm_key") || "");
    setKimiKey(localStorage.getItem("byok_kimi_key") || "");
    setDeepseekKey(localStorage.getItem("byok_deepseek_key") || "");
    setSiliconflowKey(localStorage.getItem("byok_siliconflow_key") || "");
  }, []);

  const handleSave = () => {
    localStorage.setItem("byok_minimax_key", minimaxKey.trim());
    localStorage.setItem("byok_glm_key", glmKey.trim());
    localStorage.setItem("byok_kimi_key", kimiKey.trim());
    localStorage.setItem("byok_deepseek_key", deepseekKey.trim());
    localStorage.setItem("byok_siliconflow_key", siliconflowKey.trim());

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1200);
  };

  const toggleShowKey = (provider: string) => {
    setShowKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  const providers = [
    { id: "minimax", label: "MiniMax API Key", val: minimaxKey, setVal: setMinimaxKey },
    { id: "glm", label: "智谱 GLM API Key", val: glmKey, setVal: setGlmKey },
    { id: "kimi", label: "月之暗面 Kimi API Key", val: kimiKey, setVal: setKimiKey },
    { id: "deepseek", label: "DeepSeek API Key", val: deepseekKey, setVal: setDeepseekKey },
    { id: "siliconflow", label: "硅基流动 API Key", val: siliconflowKey, setVal: setSiliconflowKey },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all duration-300">
      <div className="p-[6px] rounded-[24px] bg-bg-bezel border border-border-bezel shadow-[0_24px_64px_rgba(0,0,0,0.4)] w-full max-w-md animate-fade-up">
        <div className="bg-bg-card rounded-[18px] p-6 border border-border-card backdrop-blur-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] relative">
          
          {/* Close Button on top-right */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1.5 text-text-muted hover:text-text-title rounded-full hover:bg-bg-bezel transition-spring focus:outline-none cursor-pointer"
            title="关闭"
          >
            <X size={15} strokeWidth={1.5} />
          </button>

          <h3 className="text-sm font-semibold mb-2 text-text-title flex items-center gap-2">
            <Key size={16} strokeWidth={1.5} className="text-accent-text" />
            <span>API 密钥设置 (BYOK)</span>
          </h3>
          
          <p className="text-[10px] text-text-muted mb-5 leading-relaxed">
            请输入您的个人大模型 API Key。这些密钥将<strong>仅存在您的浏览器本地 (LocalStorage) </strong>。每次发起任务时仅在 Header 中临时传输给后端，后端服务器不保存任何 Key，保证隐私安全。
          </p>

          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
            {providers.map((p) => (
              <div key={p.id} className="flex flex-col gap-1.5">
                <label className="text-[10px] text-text-muted font-semibold tracking-wide">
                  {p.label}
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showKeys[p.id] ? "text" : "password"}
                    value={p.val}
                    onChange={(e) => p.setVal(e.target.value)}
                    placeholder={`输入 ${p.id.toUpperCase()} 密钥`}
                    className="w-full bg-bg-bezel border border-border-bezel rounded-xl px-3 py-2 text-xs text-text-title placeholder:text-text-muted/60 focus:outline-none focus:border-accent-border pr-10 transition-spring shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey(p.id)}
                    className="absolute right-3 text-text-muted hover:text-text-title focus:outline-none transition-colors cursor-pointer"
                  >
                    {showKeys[p.id] ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border-card">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-title rounded-full hover:bg-bg-bezel transition-spring focus:outline-none cursor-pointer"
            >
              取消
            </button>
            
            <button
              onClick={handleSave}
              className="px-4 py-2 text-xs font-semibold bg-accent-light border border-accent-border text-accent-text hover:bg-accent-light/80 hover:border-accent-border/80 rounded-full flex items-center gap-1.5 transition-spring focus:outline-none active:scale-[0.97] shadow-sm cursor-pointer"
            >
              {saved ? (
                <>
                  <Check size={14} strokeWidth={1.5} className="text-emerald-500 animate-bounce" />
                  <span>已保存</span>
                </>
              ) : (
                <>
                  <Save size={14} strokeWidth={1.5} />
                  <span>保存配置</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
