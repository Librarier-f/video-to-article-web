from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional

class TaskCreate(BaseModel):
    video_url: str = Field(..., description="Bilibili or YouTube video URL")
    style: str = Field(default="notion_dark", description="Visual theme style of the output HTML")
    language: str = Field(default="zh", description="Output language (zh/en)")
    sessdata: Optional[str] = Field(default=None, description="Bilibili SESSDATA Cookie value")
    provider: str = Field(default="gemini", description="LLM Provider (gemini, claude, openai, deepseek, kimi)")
    model: str = Field(default="gemini-2.5-flash", description="Model name to write the article")
    api_base_url: Optional[str] = Field(default=None, description="Custom API base URL")

class TaskResponse(BaseModel):
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
