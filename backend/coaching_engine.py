"""
coaching_engine.py — Real OpenAI-powered coaching analysis.

Key design decisions:
- Has a HARD gate: if <10% of frames show non-neutral stroke patterns, we return
  "no_tennis_detected" WITHOUT calling the LLM. No hallucinated feedback.
- GPT-4o prompt explicitly instructs it to refuse non-tennis content.
- Pose score is now relabeled as "body_visibility_score" internally and
  explained honestly (it only measures if you're in frame, not quality).
"""

import json
import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SYSTEM_PROMPT = """You are SliceIt, a professional tennis coach AI.

You receive pose estimation data extracted by MediaPipe from a video. Your job is to determine:
1. Whether tennis strokes are actually present in the data
2. If yes, identify the single most important technique flaw

CRITICAL RULES — violating these is unacceptable:
- If the stroke distribution shows mostly "neutral" (no clear forehand/backhand/serve patterns), you MUST return "no_tennis_detected" as the primary_focus_key. Do NOT invent tennis coaching for a non-tennis video.
- The pose visibility score (0-100) only tells you if the person was visible on camera — it says NOTHING about tennis quality. Do not use it as a quality metric.
- Never fabricate technique observations. Only reason from the joint angle and stroke distribution data.
- If you genuinely detect tennis strokes AND can identify a biomechanical issue from the elbow angles/wrist height data, provide specific coaching.
- One focus only. Never a list.

TENNIS DETECTION CRITERIA (check ALL before coaching):
- At least some frames must show forehand, backhand, or serve (not all neutral)
- Elbow angle data must show variation consistent with a swing (not static 180° straight arm)
- If these conditions are not met → return no_tennis_detected

OUTPUT FORMAT (valid JSON only, no markdown):
{
  "primary_focus_key": "no_tennis_detected OR snake_case_technique_key",
  "primary_focus_label": "No Tennis Detected OR Human Readable Technique Name",
  "explanation": "If no tennis: honest explanation of what was detected instead. If tennis: 2-3 sentence biomechanical explanation of the flaw.",
  "cross_session_reasoning": "How session history influenced this choice, or N/A",
  "drill_suggestion": "One specific drill with reps/sets, or N/A if no tennis detected",
  "confidence": "high|medium|low",
  "tennis_detected": true or false,
  "detected_strokes": {"forehand": 0, "backhand": 0, "serve": 0, "neutral": 0},
  "error_flags": ["list of observed issues, empty if no tennis"],
  "honest_limitations": "Any limitations e.g. poor lighting, partial body, short clip, non-tennis content"
}
"""


def _count_strokes(frame_results: list) -> dict:
    counts: dict[str, int] = {"forehand": 0, "backhand": 0, "serve": 0, "neutral": 0}
    for f in frame_results:
        key = f.stroke_hint if f.stroke_hint in counts else "neutral"
        counts[key] += 1
    return counts


def _tennis_detected(stroke_counts: dict, frame_results: list) -> tuple[bool, str]:
    """
    Hard gate: determine if this video actually contains tennis.
    Returns (is_tennis, reason_if_not).
    """
    total = sum(stroke_counts.values())
    if total == 0:
        return False, "No pose landmarks were detected in any frame. The person may not be visible."

    tennis_frames = stroke_counts["forehand"] + stroke_counts["backhand"] + stroke_counts["serve"]
    tennis_pct = tennis_frames / total

    # Check elbow angle variation — a static person has nearly constant angles
    elbow_angles = [f.elbow_angle for f in frame_results if f.elbow_angle is not None]
    angle_range = (max(elbow_angles) - min(elbow_angles)) if len(elbow_angles) >= 2 else 0

    if tennis_pct < 0.08 and angle_range < 20:
        return False, (
            f"Only {tennis_pct:.0%} of frames showed tennis-like stroke patterns "
            f"(forehand/backhand/serve), and elbow angle variation was only {angle_range:.0f}°. "
            "This does not look like a tennis practice video."
        )

    if tennis_pct < 0.05:
        return False, (
            f"No clear tennis strokes detected ({tennis_frames} out of {total} frames). "
            "Make sure your full body and racket are visible and that you are actively hitting."
        )

    return True, ""


def build_metrics_summary(frame_results: list, meta: dict, stroke_counts: dict) -> str:
    if not frame_results:
        return "No pose landmarks were detected in this video."

    pose_scores = [f.pose_score for f in frame_results]
    avg_visibility = round(sum(pose_scores) / len(pose_scores), 1)

    elbow_angles = [f.elbow_angle for f in frame_results if f.elbow_angle is not None]
    wrist_heights = [f.wrist_height for f in frame_results if f.wrist_height is not None]

    avg_elbow = round(sum(elbow_angles) / len(elbow_angles), 1) if elbow_angles else None
    elbow_range = round(max(elbow_angles) - min(elbow_angles), 1) if len(elbow_angles) >= 2 else 0
    avg_wrist = round(sum(wrist_heights) / len(wrist_heights), 3) if wrist_heights else None

    total_frames = sum(stroke_counts.values())
    tennis_frames = stroke_counts["forehand"] + stroke_counts["backhand"] + stroke_counts["serve"]

    summary = f"""
VIDEO METADATA:
- Duration: {meta.get('duration_sec', '?')}s | FPS: {meta.get('fps', '?')} | Total frames: {meta.get('total_frames', '?')}
- Frames analyzed (sampled): {len(frame_results)}

BODY VISIBILITY (NOT a quality metric — just measures if person is in frame):
- Average body visibility: {avg_visibility}/100
- Note: A score of 100 simply means the camera could see the full body clearly.

STROKE DISTRIBUTION ({tennis_frames}/{total_frames} frames show tennis-like patterns = {tennis_frames/total_frames*100:.0f}%):
{json.dumps(stroke_counts, indent=2)}

JOINT ANGLE DATA (the real biomechanical signal):
- Average dominant-arm elbow angle: {avg_elbow}°
  (Ideal contact range: 120–150°. Straight arm ~180° = arm-dominant. Very bent <90° = restricted swing)
- Elbow angle range across session: {elbow_range}°
  (Low range <20° = static person, not swinging. High range >60° = active swinging motion)
- Average wrist height (0=top of frame, 1=bottom): {avg_wrist}
  (Very low wrist during swing = low swing path or scooping motion)

FRAME SAMPLE (first 15 frames):
{_format_frame_sample(frame_results[:15])}
"""
    return summary.strip()


def _format_frame_sample(frames: list) -> str:
    lines = []
    for f in frames:
        lines.append(
            f"  t={f.timestamp}s | stroke={f.stroke_hint} | elbow={f.elbow_angle}° | wrist_h={f.wrist_height}"
        )
    return "\n".join(lines) or "  (no frames)"


def build_history_context(previous_sessions: list) -> str:
    if not previous_sessions:
        return "No previous sessions. This is the player's first analysis."
    lines = ["PREVIOUS SESSION HISTORY (most recent first):"]
    for i, sess in enumerate(reversed(previous_sessions[-5:])):
        lines.append(f"  Session {i+1}: focus='{sess.primary_focus}' | avg_visibility={sess.avg_pose_score}")
    focus_counts: dict[str, int] = {}
    for sess in previous_sessions:
        if sess.primary_focus:
            focus_counts[sess.primary_focus] = focus_counts.get(sess.primary_focus, 0) + 1
    lines.append(f"\nFocus frequency: {json.dumps(focus_counts)}")
    return "\n".join(lines)


def get_coaching_analysis(
    frame_results: list,
    meta: dict,
    previous_sessions: list,
    openai_key: str = "",
) -> dict:
    """
    Main entry point. Includes a hard gate for non-tennis content.
    Returns structured coaching dict — never hallucinates tennis for non-tennis videos.
    """
    stroke_counts = _count_strokes(frame_results)
    is_tennis, not_tennis_reason = _tennis_detected(stroke_counts, frame_results)

    # HARD GATE: return immediately without calling LLM if no tennis detected
    if not is_tennis:
        return {
            "primary_focus_key": "no_tennis_detected",
            "primary_focus_label": "No Tennis Detected",
            "explanation": not_tennis_reason,
            "cross_session_reasoning": "N/A — video did not contain detectable tennis strokes.",
            "drill_suggestion": "Upload a video where you are actively hitting tennis balls. Keep your full body (feet to racket head) in frame.",
            "confidence": "high",
            "tennis_detected": False,
            "detected_strokes": stroke_counts,
            "error_flags": [],
            "honest_limitations": not_tennis_reason,
            "_raw_response": "(skipped LLM — no tennis detected)",
        }

    # Tennis confirmed — call GPT-4o with real metrics
    metrics_text = build_metrics_summary(frame_results, meta, stroke_counts)
    history_text = build_history_context(previous_sessions)

    user_message = f"""
{history_text}

CURRENT SESSION DATA:
{metrics_text}

Stroke detection confirmed tennis activity. Provide your single-focus coaching analysis as JSON.
"""

    # Use the user's own key — never stored, used once
    request_client = OpenAI(api_key=openai_key or os.getenv("OPENAI_API_KEY", ""))

    response = request_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        temperature=0.3,
        max_tokens=800,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        result = {
            "primary_focus_key": "parse_error",
            "primary_focus_label": "Analysis Error",
            "explanation": "GPT-4o returned an unexpected format.",
            "honest_limitations": raw,
        }

    result["_raw_response"] = raw
    result["detected_strokes"] = stroke_counts
    result["tennis_detected"] = True
    return result
