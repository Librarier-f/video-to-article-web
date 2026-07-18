from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from database import Base

class Task(Base):
    __tablename__ = "tasks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    video_url = Column(String(500), nullable=False)
    platform = Column(String(50), nullable=False)
    style = Column(String(50), nullable=False)
    language = Column(String(50), nullable=False)
    status = Column(String(50), default="pending")  # pending, downloading, summarizing, outlining, writing, completed, failed
    progress = Column(Float, default=0.0)
    current_step = Column(String(200), default="初始化任务")
    logs = Column(Text, default="[]")  # Store JSON array of logs
    api_base_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship to article
    article = relationship("Article", back_populates="task", uselist=False, cascade="all, delete-orphan")


class Article(Base):
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    task_id = Column(String(36), ForeignKey("tasks.id"), unique=True)
    title = Column(String(300), nullable=False)
    author = Column(String(200), default="未知")
    duration = Column(Float, default=0.0)
    publish_date = Column(String(100), default="")
    thumbnail_url = Column(Text, default="")
    video_url = Column(String(500), nullable=False)
    html_content = Column(Text, nullable=False)
    markdown_content = Column(Text, nullable=True)
    anki_csv = Column(Text, nullable=True)
    mermaid_code = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship back to task
    task = relationship("Task", back_populates="article")
