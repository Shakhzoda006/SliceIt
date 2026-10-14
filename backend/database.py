"""
database.py — SQLAlchemy setup + models for SliceIt sessions.
All data is stored locally in sessions.db (SQLite).
"""

import os
from datetime import datetime
from sqlalchemy import (
    create_engine, Column, Integer, Float, String,
    DateTime, ForeignKey, Text, JSON
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

DB_PATH = os.path.join(os.path.dirname(__file__), "sessions.db")
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Session(Base):
    __tablename__ = "sessions"

    id            = Column(Integer, primary_key=True, index=True)
    created_at    = Column(DateTime, default=datetime.utcnow)
    video_name    = Column(String, nullable=False)
    duration_sec  = Column(Float, nullable=True)
    total_frames  = Column(Integer, nullable=True)
    fps           = Column(Float, nullable=True)

    # Aggregated metrics (filled after analysis)
    total_shots      = Column(Integer, nullable=True)
    accuracy_pct     = Column(Float, nullable=True)
    avg_pose_score   = Column(Float, nullable=True)

    # AI coaching output
    primary_focus       = Column(String, nullable=True)      # e.g. "late_unit_turn"
    focus_label         = Column(String, nullable=True)      # human label
    focus_explanation   = Column(Text, nullable=True)        # why it happened
    focus_context       = Column(Text, nullable=True)        # cross-session reasoning
    drill_suggestion    = Column(Text, nullable=True)        # next practice drill
    raw_llm_response    = Column(Text, nullable=True)        # full LLM JSON for debug

    # Per-shot breakdown (stored as JSON array)
    shots_json = Column(JSON, nullable=True)

    shots = relationship("Shot", back_populates="session", cascade="all, delete-orphan")


class Shot(Base):
    __tablename__ = "shots"

    id          = Column(Integer, primary_key=True, index=True)
    session_id  = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    frame_idx   = Column(Integer, nullable=False)
    timestamp   = Column(Float, nullable=False)   # seconds into video
    stroke_type = Column(String, nullable=True)   # forehand/backhand/serve/unknown
    result      = Column(String, nullable=True)   # in/miss/uncertain
    pose_score  = Column(Float, nullable=True)    # 0-100 quality score
    error_tags  = Column(JSON, nullable=True)     # list of string tags
    keypoints   = Column(JSON, nullable=True)     # raw landmark JSON (subset)

    session = relationship("Session", back_populates="shots")


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
