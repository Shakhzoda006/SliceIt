"""
main.py — SliceIt FastAPI backend

Endpoints:
  POST /api/analyze       — upload video + user's OpenAI key, run MediaPipe + GPT-4o
  GET  /api/sessions      — list all past sessions
  GET  /api/sessions/{id} — get one session detail
  GET  /api/health        — server health check

API Key design:
  - Users provide their own OpenAI key via the X-OpenAI-Key HTTP header
  - The key is used for that single request only and NEVER stored
  - The backend has no master API key

Run with:  py -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

import os
import uuid
import shutil
import threading
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session as DBSession
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from database import init_db, get_db, Session as SessionModel, Shot as ShotModel
from pose_pipeline import analyze_video
from coaching_engine import get_coaching_analysis

# ── App setup ────────────────────────────────────────────────────────────────

app = FastAPI(title="SliceIt API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for public deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Track in-progress analyses {session_id: status}
_analysis_status: dict[int, dict] = {}

@app.on_event("startup")
def startup():
    init_db()


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "api_key_mode": "user_provided",
        "message": "Backend is running. Users provide their own OpenAI API key per request via X-OpenAI-Key header."
    }


# ── Sessions list ─────────────────────────────────────────────────────────────

@app.get("/api/sessions")
def list_sessions(db: DBSession = Depends(get_db)):
    sessions = db.query(SessionModel).order_by(SessionModel.created_at.desc()).all()
    return [_serialize_session_summary(s) for s in sessions]


# ── Session detail ────────────────────────────────────────────────────────────

@app.get("/api/sessions/{session_id}")
def get_session(session_id: int, db: DBSession = Depends(get_db)):
    sess = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    return _serialize_session_detail(sess)


# ── Analysis status ───────────────────────────────────────────────────────────

@app.get("/api/sessions/{session_id}/status")
def analysis_status(session_id: int, db: DBSession = Depends(get_db)):
    status = _analysis_status.get(session_id)
    if status:
        return status
    # Check DB
    sess = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    if sess.primary_focus is not None:
        return {"state": "done", "session_id": session_id}
    return {"state": "pending", "session_id": session_id}


# ── Upload + Analyze ──────────────────────────────────────────────────────────

@app.post("/api/analyze")
async def analyze(
    file: UploadFile = File(...),
    is_right_handed: bool = Form(default=True),
    db: DBSession = Depends(get_db),
    x_openai_key: str = Header(default="", alias="X-OpenAI-Key"),
):
    # Validate file type
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(
            status_code=400,
            detail=f"File must be a video. Received: {file.content_type}"
        )

    # Require the user's OpenAI key sent in the request header
    openai_key = x_openai_key.strip()
    if not openai_key or not openai_key.startswith("sk-") or len(openai_key) < 20:
        raise HTTPException(
            status_code=401,
            detail="No valid OpenAI API key provided. Send your key in the X-OpenAI-Key header."
        )

    # Save uploaded file
    ext = os.path.splitext(file.filename or "video.mp4")[1] or ".mp4"
    unique_name = f"{uuid.uuid4().hex}{ext}"
    video_path = os.path.join(UPLOAD_DIR, unique_name)

    with open(video_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Create a pending session record
    sess = SessionModel(
        video_name=file.filename or unique_name,
        created_at=datetime.utcnow(),
    )
    db.add(sess)
    db.commit()
    db.refresh(sess)
    session_id = sess.id

    _analysis_status[session_id] = {
        "state": "running",
        "openai_key": openai_key,  # held in memory only for this request lifecycle
        "step": "pose_extraction",
        "step_label": "Extracting pose landmarks with MediaPipe…",
        "session_id": session_id,
    }

    # Run analysis in a background thread so we can return session_id immediately
    def run_analysis(user_openai_key: str = openai_key):
        # Need a new DB session in the thread
        from database import SessionLocal
        thread_db = SessionLocal()
        try:
            _analysis_status[session_id]["step"] = "pose_extraction"
            _analysis_status[session_id]["step_label"] = "Running MediaPipe pose detection…"

            frame_results, meta = analyze_video(
                video_path,
                sample_every_n_frames=5,
                is_right_handed=is_right_handed,
            )

            _analysis_status[session_id]["step"] = "coaching_ai"
            _analysis_status[session_id]["step_label"] = "Sending pose data to GPT-4o for coaching analysis…"

            # Get all previous sessions for history context
            prev_sessions = (
                thread_db.query(SessionModel)  # type: ignore
                .filter(SessionModel.id != session_id)
                .filter(SessionModel.primary_focus.isnot(None))
                .order_by(SessionModel.created_at.asc())
                .all()
            )

            coaching = get_coaching_analysis(frame_results, meta, prev_sessions, openai_key=user_openai_key)

            # Compute aggregate metrics
            pose_scores = [f.pose_score for f in frame_results]
            avg_pose = round(sum(pose_scores) / len(pose_scores), 1) if pose_scores else None

            stroke_counts = coaching.get("detected_strokes", {})
            total_shots = sum(stroke_counts.values())

            # Update session record
            db_sess = thread_db.query(SessionModel).filter(SessionModel.id == session_id).first()
            db_sess.duration_sec   = meta.get("duration_sec")
            db_sess.total_frames   = meta.get("total_frames")
            db_sess.fps            = meta.get("fps")
            db_sess.total_shots    = total_shots
            db_sess.avg_pose_score = avg_pose
            db_sess.primary_focus      = coaching.get("primary_focus_key")
            db_sess.focus_label        = coaching.get("primary_focus_label")
            db_sess.focus_explanation  = coaching.get("explanation")
            db_sess.focus_context      = coaching.get("cross_session_reasoning")
            db_sess.drill_suggestion   = coaching.get("drill_suggestion")
            db_sess.raw_llm_response   = coaching.get("_raw_response")

            # Save frame-level data as shots
            for fr in frame_results[:100]:  # cap at 100 to avoid huge DB rows
                shot = ShotModel(
                    session_id  = session_id,
                    frame_idx   = fr.frame_idx,
                    timestamp   = fr.timestamp,
                    stroke_type = fr.stroke_hint,
                    pose_score  = fr.pose_score,
                    error_tags  = coaching.get("error_flags", []),
                    keypoints   = fr.landmarks,
                )
                thread_db.add(shot)

            thread_db.commit()

            _analysis_status[session_id] = {
                "state": "done",
                "session_id": session_id,
                "coaching": coaching,
            }

        except Exception as e:
            _analysis_status[session_id] = {
                "state": "error",
                "session_id": session_id,
                "error": str(e),
            }
            # Mark session as failed
            try:
                db_sess = thread_db.query(SessionModel).filter(SessionModel.id == session_id).first()
                if db_sess:
                    db_sess.focus_label = "Analysis failed"
                    db_sess.focus_explanation = str(e)
                    thread_db.commit()
            except Exception:
                pass
        finally:
            thread_db.close()
            # Clean up uploaded file after analysis
            try:
                os.remove(video_path)
            except Exception:
                pass

    thread = threading.Thread(target=run_analysis, daemon=True)
    thread.start()

    return {
        "session_id": session_id,
        "state": "running",
        "message": "Video uploaded. Analysis started. Poll /api/sessions/{session_id}/status for progress.",
    }


# ── Delete session ─────────────────────────────────────────────────────────────

@app.delete("/api/sessions/{session_id}")
def delete_session(session_id: int, db: DBSession = Depends(get_db)):
    sess = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(sess)
    db.commit()
    return {"deleted": session_id}


# ── Serializers ───────────────────────────────────────────────────────────────

def _serialize_session_summary(s: SessionModel) -> dict:
    return {
        "id": s.id,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "video_name": s.video_name,
        "duration_sec": s.duration_sec,
        "total_shots": s.total_shots,
        "accuracy_pct": s.accuracy_pct,
        "avg_pose_score": s.avg_pose_score,
        "primary_focus": s.primary_focus,
        "focus_label": s.focus_label,
        "analysis_ready": s.primary_focus is not None,
    }


def _serialize_session_detail(s: SessionModel) -> dict:
    base = _serialize_session_summary(s)
    base.update({
        "focus_explanation": s.focus_explanation,
        "focus_context": s.focus_context,
        "drill_suggestion": s.drill_suggestion,
        "fps": s.fps,
        "total_frames": s.total_frames,
        "shots": [
            {
                "id": shot.id,
                "frame_idx": shot.frame_idx,
                "timestamp": shot.timestamp,
                "stroke_type": shot.stroke_type,
                "pose_score": shot.pose_score,
                "error_tags": shot.error_tags,
            }
            for shot in (s.shots or [])
        ],
    })
    return base
