import { useState, useEffect, useRef, useMemo } from "react";
import { Key, Eye, EyeOff, Save, Check, X, Link, RefreshCw, UploadCloud } from "lucide-react";
import { fetchImaKnowledgeBases } from "../utils/api";
import CustomApiFields from "./CustomApiFields";
import { CUSTOM_API_SETTINGS_EVENT, loadCustomApiConfig, saveCustomApiConfig, validateCustomApiConfig } from "../utils/customApiConfig";

interface SettingsPanelProps {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [customConfig, setCustomConfig] = useState(loadCustomApiConfig);
  const [customError, setCustomError] = useState("");
  const [minimaxKey, setMinimaxKey] = useState("");
  const [glmKey, setGlmKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [deepseekKey, setDeepseekKey] = useState("");
  const [kimiKey, setKimiKey] = useState("");
  const [imaClientId, setImaClientId] = useState("");
  const [imaKey, setImaKey] = useState("");
  const [imaKbId, setImaKbId] = useState("");
  const [kbList, setKbList] = useState<{ knowledge_base_id: string; name: string }[]>([]);
  const [isFetchingKbs, setIsFetchingKbs] = useState(false);

  // YouTube Cookies State
  const [youtubeCookies, setYoutubeCookies] = useState("");
  const [youtubeCookieFilename, setYoutubeCookieFilename] = useState("");
  const ytFileInputRef = useRef<HTMLInputElement>(null);

  const hasYoutubeAuthToken = useMemo(() => {
    if (!youtubeCookies) return false;
    return /SID|LOGIN_INFO|SAPISID|__Secure/i.test(youtubeCookies);
  }, [youtubeCookies]);

  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({
    minimax: false,
    glm: false,
    openai: false,
    deepseek: false,
    kimi: false,
    ima: false,
  });

  const [saved, setSaved] = useState(false);
  const [siliconflowKey, setSiliconflowKey] = useState('');

  useEffect(() => {
    setSiliconflowKey(localStorage.getItem('byok_siliconflow_key') || '');
    setMinimaxKey(localStorage.getItem("byok_minimax_key") || "");
    setGlmKey(localStorage.getItem("byok_glm_key") || "");
    setOpenaiKey(localStorage.getItem("byok_openai_key") || "");
    setDeepseekKey(localStorage.getItem("byok_deepseek_key") || "");
    setKimiKey(localStorage.getItem("byok_kimi_key") || "");
    setImaClientId(localStorage.getItem("byok_ima_client_id") || "");
    setImaKey(localStorage.getItem("byok_ima_key") || "");
    setImaKbId(localStorage.getItem("byok_ima_kb_id") || "");
    setYoutubeCookies(localStorage.getItem("byok_youtube_cookies") || "");
    setYoutubeCookieFilename(localStorage.getItem("byok_youtube_cookie_filename") || "");
  }, []);

  const handleYtFileUpload = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        setYoutubeCookies(text);
        setYoutubeCookieFilename(file.name);
      }
    };
    reader.readAsText(file);
  };

  const handleSave = () => {
    if (Object.values(customConfig).some((value) => value.trim())) {
      const error = validateCustomApiConfig(customConfig);
      if (error) { setCustomError(error); return; }
    }
    setCustomError("");
    saveCustomApiConfig(customConfig);
    window.dispatchEvent(new Event(CUSTOM_API_SETTINGS_EVENT));
    localStorage.setItem("byok_minimax_key", minimaxKey.trim());
    localStorage.setItem("byok_glm_key", glmKey.trim());
    localStorage.setItem("byok_openai_key", openaiKey.trim());
    localStorage.setItem("byok_deepseek_key", deepseekKey.trim());
    localStorage.setItem("byok_kimi_key", kimiKey.trim());
    localStorage.setItem('byok_siliconflow_key', siliconflowKey.trim());
    localStorage.setItem("byok_ima_client_id", imaClientId.trim());
    localStorage.setItem("byok_ima_key", imaKey.trim());
    localStorage.setItem("byok_ima_kb_id", imaKbId);

    if (youtubeCookies) {
      localStorage.setItem("byok_youtube_cookies", youtubeCookies);
      localStorage.setItem("byok_youtube_cookie_filename", youtubeCookieFilename || "cookies.txt");
    } else {
      localStorage.removeItem("byok_youtube_cookies");
      localStorage.removeItem("byok_youtube_cookie_filename");
    }

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
    { id: 'siliconflow', label: '硅基流动 API Key', val: siliconflowKey, setVal: setSiliconflowKey },
    { id: "minimax", label: "MiniMax API Key", val: minimaxKey, setVal: setMinimaxKey },
    { id: "glm", label: "智谱 GLM API Key", val: glmKey, setVal: setGlmKey },
    { id: "openai", label: "OpenAI API Key", val: openaiKey, setVal: setOpenaiKey },
    { id: "deepseek", label: "DeepSeek API Key", val: deepseekKey, setVal: setDeepseekKey },
    { id: "kimi", label: "月之暗面 Kimi API Key", val: kimiKey, setVal: setKimiKey },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all duration-300">
      <div className="p-[6px] rounded-[24px] bg-bg-bezel border border-border-bezel shadow-[0_24px_64px_rgba(0,0,0,0.4)] w-full max-w-xl animate-fade-up">
        <div className="bg-bg-card rounded-[18px] p-6 border border-border-card backdrop-blur-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] relative">
          
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
            配置您的模型接口。保存的密钥<strong>仅存于当前浏览器</strong>，生成时临时发送给后端，后端不保存 API Key。
          </p>

          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <section className="space-y-3 rounded-xl border border-accent-border bg-accent-light p-4">
              <h4 className="text-xs font-semibold text-text-title">自定义模型接口</h4>
              <CustomApiFields config={customConfig} onChange={(config) => { setCustomConfig(config); setCustomError(""); }} idPrefix="settings-custom" />
              {customError && <p role="alert" className="text-xs text-red-400">{customError}</p>}
              <p className="text-[10px] text-text-muted">保存后，生成页面会自动使用此自定义配置。清空以上三项并保存可删除配置。</p>
            </section>
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
            
            <div className="pt-4 mt-2 border-t border-border-card">
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[10px] text-text-muted font-semibold tracking-wide">IMA Client ID</label>
                <a href="https://ima.qq.com/agent-interface" target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent-text hover:underline flex items-center">
                  <Link size={10} className="mr-1" /> 获取凭证
                </a>
              </div>
              <input
                type="text"
                value={imaClientId}
                onChange={(e) => setImaClientId(e.target.value)}
                className="w-full bg-bg-bezel border border-border-bezel rounded-xl px-3 py-2 text-xs text-text-title placeholder:text-text-muted/60 focus:outline-none focus:border-accent-border transition-spring shadow-inner"
                placeholder="您的 IMA Client ID"
              />
            </div>

            <div>
              <label className="text-[10px] text-text-muted font-semibold tracking-wide mb-1.5 block">IMA API Key</label>
              <input
                type={showKeys.ima ? "text" : "password"}
                value={imaKey}
                onChange={(e) => setImaKey(e.target.value)}
                className="w-full bg-bg-bezel border border-border-bezel rounded-xl px-3 py-2 text-xs text-text-title placeholder:text-text-muted/60 focus:outline-none focus:border-accent-border transition-spring shadow-inner"
                placeholder="您的 IMA API Key"
              />
            </div>
            
            {(imaClientId && imaKey) ? (
              <div className="pt-2">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[10px] text-text-muted font-semibold tracking-wide">默认保存到的知识库</label>
                  <button 
                    onClick={async () => {
                      setIsFetchingKbs(true);
                      try {
                        const kbs = await fetchImaKnowledgeBases();
                        setKbList(kbs);
                      } catch (err: any) {
                        const errMsg = err.message || "";
                        if (errMsg.includes("skill auth failed") || errMsg.includes("200002")) {
                          alert("当前 API 密钥不支持获取知识库列表（缺少开放权限）。\n但这不影响将文章直接保存到「个人笔记」，您可以直接保存！");
                        } else {
                          alert(errMsg || "获取知识库失败");
                        }
                      } finally {
                        setIsFetchingKbs(false);
                      }
                    }}
                    className="text-[10px] text-accent-text hover:underline flex items-center cursor-pointer"
                  >
                    <RefreshCw size={10} className={`mr-1 ${isFetchingKbs ? "animate-spin" : ""}`} /> 刷新列表
                  </button>
                </div>
                <select
                  value={imaKbId}
                  onChange={(e) => setImaKbId(e.target.value)}
                  onClick={async () => {
                     if (kbList.length === 0 && !isFetchingKbs) {
                         setIsFetchingKbs(true);
                         try {
                           const kbs = await fetchImaKnowledgeBases();
                           setKbList(kbs);
                         } catch (err: any) {
                           const errMsg = err.message || "";
                           if (errMsg.includes("skill auth failed") || errMsg.includes("200002")) {
                             alert("当前 API 密钥不支持获取知识库列表（缺少开放权限）。\n但这不影响将文章直接保存到「个人笔记」，您可以直接保存！");
                           } else {
                             alert(errMsg || "获取知识库失败");
                           }
                         }
                         setIsFetchingKbs(false);
                     }
                  }}
                  className="w-full bg-bg-bezel border border-border-bezel rounded-xl px-3 py-2 text-xs text-text-title focus:outline-none focus:border-accent-border transition-spring shadow-inner appearance-none cursor-pointer"
                >
                  <option value="">(不关联知识库，仅存为笔记)</option>
                  {kbList.map(kb => (
                    <option key={kb.knowledge_base_id} value={kb.knowledge_base_id}>{kb.name}</option>
                  ))}
                  {imaKbId && !kbList.find(k => k.knowledge_base_id === imaKbId) && (
                    <option value={imaKbId}>已保存的知识库 ({imaKbId})</option>
                  )}
                </select>
              </div>
            ) : null}

            {/* Global YouTube Cookies Config */}
            <div className="flex flex-col gap-2 pt-3 border-t border-border-card">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-text-title font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                  YouTube 默认 Cookies (Netscape cookies.txt)
                </label>
                <span className="text-[9px] text-text-muted">保存在本地 LocalStorage</span>
              </div>
              <input
                type="file"
                ref={ytFileInputRef}
                accept=".txt"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleYtFileUpload(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              {youtubeCookies ? (
                <div className={`flex items-center justify-between bg-bg-bezel border rounded-xl px-3 py-2 transition-all ${
                  hasYoutubeAuthToken ? "border-emerald-500/30" : "border-amber-500/40 bg-amber-500/[0.03]"
                }`}>
                  <div className="flex items-center gap-2 text-xs text-text-title truncate">
                    <Check size={14} className={hasYoutubeAuthToken ? "text-emerald-400 shrink-0" : "text-amber-400 shrink-0"} />
                    <span className="truncate">{youtubeCookieFilename || "cookies.txt (已存储)"}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                      hasYoutubeAuthToken ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400 font-medium"
                    }`}>
                      {hasYoutubeAuthToken ? "登录态有效" : "⚠️ 未检测到账号登录态"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => ytFileInputRef.current?.click()}
                      className="text-[11px] text-text-muted hover:text-text-title px-2 py-1 rounded hover:bg-bg-card transition-spring cursor-pointer"
                    >
                      重新选择
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setYoutubeCookies("");
                        setYoutubeCookieFilename("");
                        if (ytFileInputRef.current) ytFileInputRef.current.value = "";
                      }}
                      className="text-[11px] text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-spring cursor-pointer"
                    >
                      清除
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => ytFileInputRef.current?.click()}
                  className="w-full py-2.5 border border-dashed border-border-bezel hover:border-accent-border rounded-xl bg-bg-bezel/40 hover:bg-bg-bezel flex items-center justify-center gap-2 text-xs text-text-muted hover:text-text-title transition-spring cursor-pointer"
                >
                  <UploadCloud size={14} className="text-accent-text" />
                  <span>上传 YouTube cookies.txt 文件</span>
                </button>
              )}
              <span className="text-[10px] text-text-muted">
                在解析限制级或需要人机验证的 YouTube 视频时自动生效。
              </span>
            </div>
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
