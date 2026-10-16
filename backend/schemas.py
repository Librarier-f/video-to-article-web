from pydantic import BaseModel, Field, model_validator
from services.llm_service import build_chat_completions_url
from datetime import datetime
from typing import List, Optional, Literal

class TaskCreate(BaseModel):
    video_url: str = Field(..., description="Bilibili or YouTube video URL")
    style: str = Field(default="notion_dark", description="Visual theme style of the output HTML")
    language: str = Field(default="zh", description="Output language (zh/en)")
    sessdata: Optional[str] = Field(default=None, description="Bilibili SESSDATA Cookie value")
    youtube_cookies: Optional[str] = Field(default=None, description="YouTube Netscape formatted cookies content")
    provider: str = Field(default="gemini", description="LLM Provider (gemini, claude, openai, deepseek, kimi)")
    model: str = Field(default="gemini-2.5-flash", description="Model name to write the article")
    api_base_url: Optional[str] = Field(default=None, description="Custom API base URL")
    custom_api_key: Optional[str] = Field(default=None, description="Custom provider API Key")
    generation_mode: Literal["fast", "deep"] = "fast"
    include_visuals: bool = True

    @model_validator(mode="after")
    def validate_custom_configuration(self):
        if self.provider.lower() == "custom":
            build_chat_completions_url(self.api_base_url or "")
            self.api_base_url = self.api_base_url.strip().rstrip("/")
            self.model = self.model.strip()
            if not self.model:
                raise ValueError("请填写自定义模型名称。")
            if self.custom_api_key is not None:
                self.custom_api_key = self.custom_api_key.strip()
        return self

class TaskResponse(BaseModel):
    article_id: Optional[int] = None
    generation_mode: str = "fast"
    id: str
    video_url: str
    platform: str
    style: str
    language: str
    status: str
    progress: float
    current_step: str
    logs: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ArticleResponse(BaseModel):
    id: int
    task_id: str
    title: str
    author: str
    duration: float
    publish_date: str
    thumbnail_url: str
    video_url: str
    created_at: datetime

    class Config:
        from_attributes = True

class ArticleDetailResponse(ArticleResponse):
    html_content: str
    markdown_content: Optional[str] = None
    anki_csv: Optional[str] = None
    mermaid_code: Optional[str] = None
