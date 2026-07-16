import httpx
from typing import Dict, Any, Optional, Tuple

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
    if provider == "gemini":
        api_key = keys.get("x-gemini-key") or keys.get("X-Gemini-Key") or ""
    elif provider == "claude":
        api_key = keys.get("x-claude-key") or keys.get("X-Claude-Key") or ""
    elif provider == "openai":
        api_key = keys.get("x-openai-key") or keys.get("X-OpenAI-Key") or ""
    elif provider == "deepseek":
        api_key = keys.get("x-deepseek-key") or keys.get("X-Deepseek-Key") or ""
    elif provider == "kimi":
        api_key = keys.get("x-kimi-key") or keys.get("X-Kimi-Key") or keys.get("x-moonshot-key") or keys.get("X-Moonshot-Key") or ""

    if not api_key:
        raise Exception(f"未提供 {provider.upper()} 的 API Key。请前往设置面板配置。")

    timeout = httpx.Timeout(180.0, connect=10.0) # Long timeout for writing large articles

    async with httpx.AsyncClient(timeout=timeout) as client:
        # 1. Google Gemini
        if provider == "gemini":
            base = api_base_url.rstrip('/') if api_base_url else "https://generativelanguage.googleapis.com/v1beta"
            url = f"{base}/models/{model}:generateContent?key={api_key}"
            payload: Dict[str, Any] = {
                "contents": [
                    {
                        "parts": [{"text": prompt}]
                    }
                ]
            }
            if system_prompt:
                payload["systemInstruction"] = {
                    "parts": [{"text": system_prompt}]
                }
                
            response = await client.post(url, json=payload)
            if response.status_code != 200:
                raise Exception(f"Gemini API 错误 ({response.status_code}): {response.text}")
            
            res_json = response.json()
            try:
                text = res_json['candidates'][0]['content']['parts'][0]['text']
                usage = res_json.get('usageMetadata', {})
                return text, usage
            except (KeyError, IndexError):
                raise Exception(f"解析 Gemini 响应失败: {response.text}")

        # 2. Anthropic Claude
        elif provider == "claude":
            base = api_base_url.rstrip('/') if api_base_url else "https://api.anthropic.com/v1"
            url = f"{base}/messages"
            headers = {
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            }
            payload = {
                "model": model,
                "max_tokens": 4000,
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            }
            if system_prompt:
                payload["system"] = system_prompt
                
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code != 200:
                raise Exception(f"Claude API 错误 ({response.status_code}): {response.text}")
                
            res_json = response.json()
            try:
                text = res_json['content'][0]['text']
                usage = res_json.get('usage', {})
                return text, usage
            except (KeyError, IndexError):
                raise Exception(f"解析 Claude 响应失败: {response.text}")

        # 3. OpenAI / DeepSeek / Kimi (Standard Chat Completions)
        elif provider in ["openai", "deepseek", "kimi"]:
            if api_base_url:
                url = f"{api_base_url.rstrip('/')}/chat/completions" if not api_base_url.endswith("/chat/completions") else api_base_url
            else:
                if provider == "openai":
                    url = "https://api.openai.com/v1/chat/completions"
                elif provider == "deepseek":
                    url = "https://api.deepseek.com/chat/completions"
                else: # kimi
                    url = "https://api.moonshot.cn/v1/chat/completions"
                
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
            
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code != 200:
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
