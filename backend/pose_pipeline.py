"""
pose_pipeline.py — Real pose extraction using MediaPipe Tasks API (v1.x).

MediaPipe 1.x replaced mp.solutions.pose with mp.tasks.vision.PoseLandmarker.
This module uses the new Tasks API with the lite pose landmarker model.

What it does:
  1. Opens the video with OpenCV
  2. Samples frames at a configured interval (every N frames)
  3. Runs PoseLandmarker on each sampled frame → 33 3D landmarks per person
  4. Computes a pose quality score from landmark visibility/presence
  5. Heuristically detects stroke type from joint angles
  6. Returns structured FrameResult objects + video metadata
"""

import os
import math
import cv2
from dataclasses import dataclass
from typing import Optional

import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision
from mediapipe.tasks.python.vision import PoseLandmarker, PoseLandmarkerOptions, RunningMode
from mediapipe.tasks.python.core.base_options import BaseOptions

MODEL_PATH = os.path.join(os.path.dirname(__file__), "pose_landmarker.task")

# Landmark indices (same as before, PoseLandmark enum)
PL = mp_vision.PoseLandmark

RELEVANT_INDICES = [
    PL.LEFT_SHOULDER.value,  PL.RIGHT_SHOULDER.value,
    PL.LEFT_ELBOW.value,     PL.RIGHT_ELBOW.value,
    PL.LEFT_WRIST.value,     PL.RIGHT_WRIST.value,
    PL.LEFT_HIP.value,       PL.RIGHT_HIP.value,
    PL.LEFT_KNEE.value,      PL.RIGHT_KNEE.value,
    PL.LEFT_ANKLE.value,     PL.RIGHT_ANKLE.value,
]

LANDMARK_NAMES = [
    "LEFT_SHOULDER",  "RIGHT_SHOULDER",
    "LEFT_ELBOW",     "RIGHT_ELBOW",
    "LEFT_WRIST",     "RIGHT_WRIST",
    "LEFT_HIP",       "RIGHT_HIP",
    "LEFT_KNEE",      "RIGHT_KNEE",
    "LEFT_ANKLE",     "RIGHT_ANKLE",
]


@dataclass
class FrameResult:
    frame_idx:    int
    timestamp:    float
    pose_score:   float          # 0–100
    landmarks:    dict           # {name: {x,y,z,visibility}}
    stroke_hint:  Optional[str]  # forehand|backhand|serve|neutral
    wrist_height: Optional[float]
    elbow_angle:  Optional[float]


def _angle_between(ax, ay, bx, by, cx, cy) -> float:
    """Angle at B in triangle ABC."""
    vax, vay = ax - bx, ay - by
    vcx, vcy = cx - bx, cy - by
    dot = vax * vcx + vay * vcy
    mag = math.hypot(vax, vay) * math.hypot(vcx, vcy)
    if mag == 0:
        return 0.0
    return math.degrees(math.acos(max(-1.0, min(1.0, dot / mag))))


def _pose_score(landmarks: list) -> float:
    """Average presence score of key landmarks × 100."""
    scores = []
    for idx in RELEVANT_INDICES:
        lm = landmarks[idx]
        # Tasks API uses 'presence' (0–1); fall back to visibility
        val = getattr(lm, "presence", None) or getattr(lm, "visibility", 0)
        scores.append(val)
    return round(sum(scores) / len(scores) * 100, 1) if scores else 0.0


def _extract_landmarks(landmarks: list) -> dict:
    result = {}
    for idx, name in zip(RELEVANT_INDICES, LANDMARK_NAMES):
        lm = landmarks[idx]
        result[name] = {
            "x": round(lm.x, 4),
            "y": round(lm.y, 4),
            "z": round(lm.z, 4),
            "visibility": round(getattr(lm, "presence", getattr(lm, "visibility", 0)), 3),
        }
    return result


def _detect_stroke(
    landmarks: list,
    is_right_handed: bool = True
) -> tuple[Optional[str], Optional[float], Optional[float]]:
    try:
        if is_right_handed:
            sh = landmarks[PL.RIGHT_SHOULDER.value]
            el = landmarks[PL.RIGHT_ELBOW.value]
            wr = landmarks[PL.RIGHT_WRIST.value]
        else:
            sh = landmarks[PL.LEFT_SHOULDER.value]
            el = landmarks[PL.LEFT_ELBOW.value]
            wr = landmarks[PL.LEFT_WRIST.value]

        hl = landmarks[PL.LEFT_HIP.value]
        hr = landmarks[PL.RIGHT_HIP.value]
        hip_mid_x = (hl.x + hr.x) / 2

        elbow_angle = _angle_between(sh.x, sh.y, el.x, el.y, wr.x, wr.y)
        wrist_height = wr.y  # lower value = higher in image

        # Serve: wrist clearly above shoulder
        if wr.y < sh.y - 0.06:
            return "serve", wrist_height, elbow_angle

        # Forehand / backhand by wrist position vs hip midpoint
        if is_right_handed:
            if wr.x > hip_mid_x + 0.04:
                return "forehand", wrist_height, elbow_angle
            elif wr.x < hip_mid_x - 0.04:
                return "backhand", wrist_height, elbow_angle
        else:
            if wr.x < hip_mid_x - 0.04:
                return "forehand", wrist_height, elbow_angle
            elif wr.x > hip_mid_x + 0.04:
                return "backhand", wrist_height, elbow_angle

        return "neutral", wrist_height, elbow_angle

    except Exception:
        return None, None, None


def analyze_video(
    video_path: str,
    sample_every_n_frames: int = 5,
    is_right_handed: bool = True,
) -> tuple[list[FrameResult], dict]:
    """
    Run the full pose pipeline on a video file using MediaPipe Tasks API.
    Returns (list[FrameResult], meta_dict).
    """
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"Pose model not found at {MODEL_PATH}. "
            "Download it from: https://storage.googleapis.com/mediapipe-models/"
            "pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
        )

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    fps          = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration     = total_frames / fps

    meta = {
        "fps": round(fps, 2),
        "total_frames": total_frames,
        "duration_sec": round(duration, 2),
        "sampled_every": sample_every_n_frames,
    }

    results: list[FrameResult] = []
    frame_idx = 0

    options = PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=MODEL_PATH),
        running_mode=RunningMode.IMAGE,
        num_poses=1,
        min_pose_detection_confidence=0.4,
        min_pose_presence_confidence=0.4,
        min_tracking_confidence=0.4,
    )

    with PoseLandmarker.create_from_options(options) as landmarker:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % sample_every_n_frames == 0:
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(
                    image_format=mp.ImageFormat.SRGB,
                    data=rgb,
                )
                detection = landmarker.detect(mp_image)

                if detection.pose_landmarks:
                    lms = detection.pose_landmarks[0]  # first (only) pose
                    score = _pose_score(lms)
                    lm_dict = _extract_landmarks(lms)
                    stroke, wrist_h, elbow_a = _detect_stroke(lms, is_right_handed)

                    results.append(FrameResult(
                        frame_idx   = frame_idx,
                        timestamp   = round(frame_idx / fps, 2),
                        pose_score  = score,
                        landmarks   = lm_dict,
                        stroke_hint = stroke,
                        wrist_height = wrist_h,
                        elbow_angle  = elbow_a,
                    ))

            frame_idx += 1

    cap.release()
    return results, meta
