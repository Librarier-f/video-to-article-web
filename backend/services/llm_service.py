import asyncio
import httpx
from typing import Dict, Any, Optional, Tuple
from urllib.parse import urlsplit
from contextlib import asynccontextmanager
from contextvars import ContextVar

_task_client = ContextVar("task_llm_client", default=None)


@asynccontextmanager
async def llm_session():
    """Reuse connections within one task; credentials remain per request."""
    scope = {"client": None, "lock": asyncio.Lock()}
    token = _task_client.set(scope)
    try:
        yield
    finally:
        _task_client.reset(token)
        if scope["client"] is not None:
            await scope["client"].aclose()


@asynccontextmanager
async def request_client(timeout):
    scope = _task_client.get()
    if scope is not None:
        async with scope["lock"]:
            if scope["client"] is None:
                # SSL context initialization can be expensive on Windows.
                scope["client"] = await asyncio.to_thread(
                    httpx.AsyncClient, timeout=httpx.Timeout(180.0, connect=10.0),
                    limits=httpx.Limits(max_connections=8, max_keepalive_connections=8)
                )
        yield scope["client"]
    else:
        async with httpx.AsyncClient(timeout=timeout) as client:
            yield client


def build_chat_completions_url(base_url: str) -> str:
    base_url = (base_url or "").strip().rstrip("/")
    parsed = urlsplit(base_url)
    if (parsed.scheme not in ("http", "https") or not parsed.hostname
            or parsed.username or parsed.password or parsed.query or parsed.fragment):
        raise ValueError("Base URL 必须是 HTTP/HTTPS 接口地址，不包含账号、查询参数或片段。")
    if parsed.path.endswith("/chat/completions"):
        return base_url
    return f"{base_url}/chat/completions"

async def call_llm_api(
    provider: str,
    model: str,
    prompt: str,
    system_prompt: Optional[str] = None,
    keys: Dict[str, str] = None,
    api_base_url: Optional[str] = None
) -> Tuple[str, dict]:
    """
    Asynchronously calls the specified LLM API provider using the API key provided in the keys dict.
    Returns a tuple of (generated_text, usage_dict).
    """
    keys = keys or {}
    provider = provider.lower()
    
    # Select API Key
    api_key = ""
    if provider == "minimax":
        api_key = keys.get("x-minimax-key") or keys.get("X-Minimax-Key") or ""
    elif provider == "glm":
        api_key = keys.get("x-glm-key") or keys.get("X-Glm-Key") or ""
    elif provider == "kimi":
        api_key = keys.get("x-kimi-key") or keys.get("X-Kimi-Key") or ""
    elif provider == "deepseek":
        api_key = keys.get("x-deepseek-key") or keys.get("X-Deepseek-Key") or ""
    elif provider == "siliconflow":
        api_key = keys.get("x-siliconflow-key") or keys.get("X-Siliconflow-Key") or ""
    elif provider == "custom":
        api_key = keys.get("x-custom-key") or keys.get("X-Custom-Key") or ""

    if not api_key:
        raise Exception(f"未提供 {provider.upper()} 的 API Key。请前往设置面板配置。")

    timeout = httpx.Timeout(180.0, connect=10.0) # Long timeout for writing large articles

    async with request_client(timeout) as client:
        # 1. Standard Chat Completions (MiniMax, GLM, Kimi, DeepSeek, SiliconFlow, Custom)
        if provider in ["minimax", "glm", "kimi", "deepseek", "siliconflow", "custom"]:
            if api_base_url:
                url = build_chat_completions_url(api_base_url)
            else:
                if provider == "minimax":
                    url = "https://api.minimax.chat/v1/chat/completions"
                elif provider == "glm":
                    url = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
                elif provider == "kimi":
                    url = "https://api.moonshot.cn/v1/chat/completions"
                elif provider == "deepseek":
                    url = "https://api.deepseek.com/chat/completions"
                elif provider == "siliconflow":
                    url = "https://api.siliconflow.cn/v1/chat/completions"
                else:
                    url = ""
                
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})
            
            payload = {
                "model": model,
                "messages": messages,
                "temperature": 0.5
            }
            
            try:
                response = await client.post(url, headers=headers, json=payload)
            except httpx.RequestError as exc:
                raise Exception(f"{provider.upper()} API 错误：自定义 API 地址无法访问或网络超时。({str(exc)})")

            if response.status_code != 200:
                if response.status_code == 401:
                    raise Exception(f"{provider.upper()} API 错误 (401)：API 密钥无效或未授权，请检查密钥是否正确。")
                elif response.status_code == 404:
                    raise Exception(f"{provider.upper()} API 错误 (404)：模型名称无效或接口地址路径（如 /v1/chat/completions）有误。")
                elif response.status_code == 429:
                    raise Exception(f"{provider.upper()} API 错误 (429)：请求过于频繁或额度已耗尽。")
                else:
                    raise Exception(f"{provider.upper()} API 错误 ({response.status_code}): {response.text}")
                
            res_json = response.json()
            try:
                text = res_json['choices'][0]['message']['content']
                usage = res_json.get('usage', {})
                return text, usage
            except (KeyError, IndexError):
                raise Exception(f"解析 {provider.upper()} 响应失败: {response.text}")

        else:
            raise Exception(f"不支持的 LLM 提供商: {provider}")
