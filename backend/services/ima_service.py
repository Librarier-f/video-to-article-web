import httpx
import logging

logger = logging.getLogger(__name__)

IMA_BASE_URL = "https://ima.qq.com"

async def get_knowledge_bases(client_id: str, api_key: str) -> list:
    """
    Fetches the list of knowledge bases the user can add content to.
    """
    if not client_id or not api_key:
        raise ValueError("缺少 IMA 凭证 (Client ID 或 API Key)")

    headers = {
        "ima-openapi-clientid": client_id,
        "ima-openapi-apikey": api_key,
        "Content-Type": "application/json"
    }

    api_url = f"{IMA_BASE_URL}/openapi/wiki/v1/get_addable_knowledge_base_list"
    payload = {"cursor": "", "limit": 50}

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(api_url, headers=headers, json=payload, timeout=30.0)
            if response.status_code != 200:
                logger.error(f"IMA API error (get_kbs): {response.text}")
                raise Exception(f"IMA 返回错误状态码: {response.status_code}")
                
            data = response.json()
            if data.get("code") != 0:
                raise Exception(f"IMA 返回错误: {data.get('msg', '未知错误')}")
                
            return data.get("data", {}).get("knowledge_base_infos", [])
    except Exception as e:
        logger.error(f"Failed to fetch IMA knowledge bases: {str(e)}")
        raise e

async def export_article_to_ima(client_id: str, api_key: str, title: str, markdown_content: str, kb_id: str = None) -> dict:
    """
    Exports an article to Tencent IMA as a Markdown note.
    """
    if not client_id or not api_key:
        raise ValueError("缺少 IMA 凭证 (Client ID 或 API Key)")

    headers = {
        "ima-openapi-clientid": client_id,
        "ima-openapi-apikey": api_key,
        "Content-Type": "application/json"
    }
    
    # We prefix the markdown content with the title as an H1,
    # just in case it doesn't already have one, but usually it does.
    # To be safe, if title is not in markdown, we could prepend it.
    if not markdown_content.startswith("#"):
        markdown_content = f"# {title}\n\n{markdown_content}"

    payload = {
        "content_format": 1,  # 1 means Markdown
        "content": markdown_content
    }

    api_url = f"{IMA_BASE_URL}/openapi/note/v1/import_doc"

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(api_url, headers=headers, json=payload, timeout=30.0)
            
            if response.status_code != 200:
                logger.error(f"IMA API error: {response.text}")
                raise Exception(f"IMA 返回错误状态码: {response.status_code}")
                
            data = response.json()
            
            # Usually IMA returns code == 0 for success
            if data.get("code") != 0:
                logger.error(f"IMA API error: {data}")
                raise Exception(f"IMA 返回错误: {data.get('msg', '未知错误')}")
                
            # data["data"]["note_id"] should exist
            note_id = data.get("data", {}).get("note_id")
            
            # If a knowledge base ID is provided, we associate the note to the KB
            if kb_id and note_id:
                kb_api_url = f"{IMA_BASE_URL}/openapi/wiki/v1/add_knowledge"
                kb_payload = {
                    "media_type": 11,
                    "note_info": { "content_id": note_id },
                    "title": title,
                    "knowledge_base_id": kb_id
                }
                kb_resp = await client.post(kb_api_url, headers=headers, json=kb_payload, timeout=30.0)
                if kb_resp.status_code == 200:
                    kb_data = kb_resp.json()
                    if kb_data.get("code") != 0:
                        logger.warning(f"Failed to add note to KB: {kb_data.get('msg')}")
            
            return data.get("data", {})
    except Exception as e:
        logger.error(f"Failed to export to IMA: {str(e)}")
        raise e
