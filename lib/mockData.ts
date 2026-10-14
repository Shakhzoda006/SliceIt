// ─── Types ───────────────────────────────────────────────────────────────────

export type StrokeType = "forehand" | "backhand" | "serve" | "volley";

export type ErrorTag =
  | "contact_too_close"
  | "late_unit_turn"
  | "low_swing_path"
  | "open_stance_overuse"
  | "flat_follow_through"
  | "dropped_elbow"
  | "late_toss"
  | "early_shoulder_open"
  | "short_backswing"
  | "weight_transfer_missing";

export type MissType = "net" | "long" | "wide_left" | "wide_right" | "frame";

export interface ShotAnalysis {
  id: string;
  timestamp: number; // seconds into video
  stroke: StrokeType;
  result: "in" | "miss";
  missType?: MissType;
  errorTags: ErrorTag[];
  poseScore: number; // 0–100
  estimatedSpeed?: number; // km/h
}

export interface Session {
  id: string;
  date: string; // ISO
  videoName: string;
  durationSeconds: number;
  shots: ShotAnalysis[];
  primaryFocus: ErrorTag;
  focusExplanation: string;
  focusContext: string; // multi-session reasoning
  accuracyPct: number;
  avgPoseScore: number;
  avgEstimatedSpeed: number;
  improvementVsPrev: number | null; // % delta in accuracy vs last session
}

export interface TechniqueHistory {
  tag: ErrorTag;
  label: string;
  sessionsRecurring: number;
  trendData: { date: string; occurrences: number }[];
}

// ─── Human-readable labels ────────────────────────────────────────────────────

export const ERROR_TAG_LABELS: Record<ErrorTag, string> = {
  contact_too_close: "Contact Point Too Close",
  late_unit_turn: "Late Unit Turn",
  low_swing_path: "Low Swing Path",
  open_stance_overuse: "Open Stance Overuse",
  flat_follow_through: "Flat Follow-Through",
  dropped_elbow: "Dropped Elbow",
  late_toss: "Late Ball Toss",
  early_shoulder_open: "Early Shoulder Opening",
  short_backswing: "Short Backswing",
  weight_transfer_missing: "Missing Weight Transfer",
};

export const STROKE_LABELS: Record<StrokeType, string> = {
  forehand: "Forehand",
  backhand: "Backhand",
  serve: "Serve",
  volley: "Volley",
};

// ─── Mock Sessions ────────────────────────────────────────────────────────────

export const MOCK_SESSIONS: Session[] = [
  {
    id: "sess-001",
    date: "2026-09-18T10:30:00+09:00",
    videoName: "wall_practice_sep18.mp4",
    durationSeconds: 420,
    accuracyPct: 58,
    avgPoseScore: 61,
    avgEstimatedSpeed: 82,
    improvementVsPrev: null,
    primaryFocus: "late_unit_turn",
    focusExplanation:
      "Your hips and shoulders are rotating almost simultaneously with your swing rather than leading it. This robs the kinetic chain of its energy, resulting in arm-dominant shots that flatten out and clip the net.",
    focusContext:
      "This is your first analyzed session. Late unit turn was flagged in 9 of your 16 forehand attempts.",
    shots: [
      { id: "s1-01", timestamp: 12, stroke: "forehand", result: "miss", missType: "net", errorTags: ["late_unit_turn", "flat_follow_through"], poseScore: 52, estimatedSpeed: 79 },
      { id: "s1-02", timestamp: 28, stroke: "forehand", result: "in", errorTags: ["late_unit_turn"], poseScore: 67, estimatedSpeed: 88 },
      { id: "s1-03", timestamp: 41, stroke: "backhand", result: "in", errorTags: [], poseScore: 78, estimatedSpeed: 74 },
      { id: "s1-04", timestamp: 57, stroke: "forehand", result: "miss", missType: "net", errorTags: ["late_unit_turn", "contact_too_close"], poseScore: 49, estimatedSpeed: 71 },
      { id: "s1-05", timestamp: 72, stroke: "serve", result: "in", errorTags: ["late_toss"], poseScore: 63, estimatedSpeed: 128 },
      { id: "s1-06", timestamp: 88, stroke: "forehand", result: "miss", missType: "wide_right", errorTags: ["late_unit_turn"], poseScore: 55, estimatedSpeed: 85 },
      { id: "s1-07", timestamp: 102, stroke: "backhand", result: "in", errorTags: ["short_backswing"], poseScore: 71, estimatedSpeed: 68 },
      { id: "s1-08", timestamp: 118, stroke: "forehand", result: "in", errorTags: ["late_unit_turn"], poseScore: 64, estimatedSpeed: 90 },
    ],
  },
  {
    id: "sess-002",
    date: "2026-09-25T09:00:00+09:00",
    videoName: "ball_machine_sep25.mp4",
    durationSeconds: 540,
    accuracyPct: 63,
    avgPoseScore: 66,
    avgEstimatedSpeed: 86,
    improvementVsPrev: +5,
    primaryFocus: "late_unit_turn",
    focusExplanation:
      "Good progress — your unit turn is initiating slightly earlier, but still lacks full commitment on wide balls. Your accuracy is up 5%, but the improvement isn't consistent: it drops off when you're pulled off-balance.",
    focusContext:
      "Late unit turn appeared in 6 of 18 forehands (down from 9/16). Keeping the same focus for another session as the pattern persists under pressure.",
    shots: [
      { id: "s2-01", timestamp: 14, stroke: "forehand", result: "in", errorTags: ["late_unit_turn"], poseScore: 70, estimatedSpeed: 91 },
      { id: "s2-02", timestamp: 30, stroke: "forehand", result: "in", errorTags: [], poseScore: 82, estimatedSpeed: 95 },
      { id: "s2-03", timestamp: 46, stroke: "backhand", result: "miss", missType: "long", errorTags: ["open_stance_overuse"], poseScore: 58, estimatedSpeed: 77 },
      { id: "s2-04", timestamp: 62, stroke: "forehand", result: "in", errorTags: ["late_unit_turn"], poseScore: 69, estimatedSpeed: 88 },
      { id: "s2-05", timestamp: 80, stroke: "serve", result: "in", errorTags: [], poseScore: 76, estimatedSpeed: 134 },
      { id: "s2-06", timestamp: 96, stroke: "forehand", result: "miss", missType: "net", errorTags: ["late_unit_turn", "low_swing_path"], poseScore: 55, estimatedSpeed: 82 },
      { id: "s2-07", timestamp: 114, stroke: "volley", result: "in", errorTags: [], poseScore: 80, estimatedSpeed: 58 },
      { id: "s2-08", timestamp: 130, stroke: "forehand", result: "in", errorTags: [], poseScore: 85, estimatedSpeed: 98 },
    ],
  },
  {
    id: "sess-003",
    date: "2026-10-02T11:00:00+09:00",
    videoName: "self_feed_oct02.mp4",
    durationSeconds: 480,
    accuracyPct: 71,
    avgPoseScore: 74,
    avgEstimatedSpeed: 91,
    improvementVsPrev: +8,
    primaryFocus: "contact_too_close",
    focusExplanation:
      "Your unit turn is now solid — congrats! The next limiting factor is your contact point. You're letting the ball crowd your body, forcing a restricted arm swing. You need to strike the ball further out in front, at full arm extension.",
    focusContext:
      "Late unit turn dropped below threshold (only 2 flags in 20 shots). Contact too close now leads with 8 flags across forehand and backhand.",
    shots: [
      { id: "s3-01", timestamp: 10, stroke: "forehand", result: "in", errorTags: [], poseScore: 82, estimatedSpeed: 97 },
      { id: "s3-02", timestamp: 26, stroke: "forehand", result: "miss", missType: "frame", errorTags: ["contact_too_close"], poseScore: 60, estimatedSpeed: 84 },
      { id: "s3-03", timestamp: 42, stroke: "backhand", result: "in", errorTags: ["contact_too_close"], poseScore: 71, estimatedSpeed: 79 },
      { id: "s3-04", timestamp: 58, stroke: "forehand", result: "in", errorTags: [], poseScore: 88, estimatedSpeed: 102 },
      { id: "s3-05", timestamp: 74, stroke: "serve", result: "in", errorTags: ["late_toss"], poseScore: 72, estimatedSpeed: 138 },
      { id: "s3-06", timestamp: 90, stroke: "forehand", result: "miss", missType: "wide_left", errorTags: ["contact_too_close", "early_shoulder_open"], poseScore: 56, estimatedSpeed: 88 },
      { id: "s3-07", timestamp: 108, stroke: "backhand", result: "in", errorTags: [], poseScore: 84, estimatedSpeed: 82 },
      { id: "s3-08", timestamp: 124, stroke: "forehand", result: "in", errorTags: ["contact_too_close"], poseScore: 75, estimatedSpeed: 94 },
    ],
  },
  {
    id: "sess-004",
    date: "2026-10-09T09:30:00+09:00",
    videoName: "wall_practice_oct09.mp4",
    durationSeconds: 510,
    accuracyPct: 76,
    avgPoseScore: 79,
    avgEstimatedSpeed: 94,
    improvementVsPrev: +5,
    primaryFocus: "contact_too_close",
    focusExplanation:
      "You're making great strides. Contact point improved on forehands, but backhand still shows crowding — especially on low balls where you tend to 'scoop' rather than drive through.",
    focusContext:
      "Contact too close still appearing in 5 of 22 shots, predominantly backhand. Accuracy jumped +5%. Maintaining focus one more session to solidify muscle memory.",
    shots: [
      { id: "s4-01", timestamp: 8, stroke: "forehand", result: "in", errorTags: [], poseScore: 88, estimatedSpeed: 99 },
      { id: "s4-02", timestamp: 24, stroke: "backhand", result: "miss", missType: "net", errorTags: ["contact_too_close", "low_swing_path"], poseScore: 62, estimatedSpeed: 76 },
      { id: "s4-03", timestamp: 40, stroke: "forehand", result: "in", errorTags: [], poseScore: 92, estimatedSpeed: 104 },
      { id: "s4-04", timestamp: 56, stroke: "forehand", result: "in", errorTags: [], poseScore: 90, estimatedSpeed: 101 },
      { id: "s4-05", timestamp: 72, stroke: "serve", result: "in", errorTags: [], poseScore: 81, estimatedSpeed: 141 },
      { id: "s4-06", timestamp: 90, stroke: "backhand", result: "in", errorTags: ["contact_too_close"], poseScore: 70, estimatedSpeed: 82 },
      { id: "s4-07", timestamp: 108, stroke: "forehand", result: "in", errorTags: [], poseScore: 93, estimatedSpeed: 107 },
      { id: "s4-08", timestamp: 124, stroke: "backhand", result: "miss", missType: "long", errorTags: ["contact_too_close"], poseScore: 65, estimatedSpeed: 87 },
    ],
  },
  {
    id: "sess-005",
    date: "2026-10-14T10:00:00+09:00",
    videoName: "ball_machine_oct14.mp4",
    durationSeconds: 560,
    accuracyPct: 81,
    avgPoseScore: 83,
    avgEstimatedSpeed: 97,
    improvementVsPrev: +5,
    primaryFocus: "weight_transfer_missing",
    focusExplanation:
      "Your contact point is now consistently excellent — great work locking that in over 3 sessions. The next ceiling is your weight transfer: you're frequently finishing your shots with weight on the back foot, capping your power potential.",
    focusContext:
      "Contact too close reduced to 2 flags in 24 shots — graduated! Weight transfer missing now leads at 10 flags. Your serve speed trend confirms this: 141 → 147 km/h plateau despite improving mechanics elsewhere.",
    shots: [
      { id: "s5-01", timestamp: 12, stroke: "forehand", result: "in", errorTags: [], poseScore: 90, estimatedSpeed: 106 },
      { id: "s5-02", timestamp: 28, stroke: "forehand", result: "in", errorTags: ["weight_transfer_missing"], poseScore: 78, estimatedSpeed: 96 },
      { id: "s5-03", timestamp: 44, stroke: "backhand", result: "in", errorTags: [], poseScore: 88, estimatedSpeed: 85 },
      { id: "s5-04", timestamp: 60, stroke: "forehand", result: "in", errorTags: ["weight_transfer_missing"], poseScore: 76, estimatedSpeed: 93 },
      { id: "s5-05", timestamp: 76, stroke: "serve", result: "in", errorTags: ["weight_transfer_missing"], poseScore: 75, estimatedSpeed: 147 },
      { id: "s5-06", timestamp: 92, stroke: "forehand", result: "miss", missType: "long", errorTags: ["weight_transfer_missing"], poseScore: 71, estimatedSpeed: 102 },
      { id: "s5-07", timestamp: 110, stroke: "backhand", result: "in", errorTags: [], poseScore: 91, estimatedSpeed: 88 },
      { id: "s5-08", timestamp: 128, stroke: "forehand", result: "in", errorTags: [], poseScore: 94, estimatedSpeed: 109 },
    ],
  },
];

// ─── Technique trends ─────────────────────────────────────────────────────────

export const TECHNIQUE_TRENDS: TechniqueHistory[] = [
  {
    tag: "late_unit_turn",
    label: ERROR_TAG_LABELS["late_unit_turn"],
    sessionsRecurring: 2,
    trendData: [
      { date: "Sep 18", occurrences: 9 },
      { date: "Sep 25", occurrences: 6 },
      { date: "Oct 02", occurrences: 2 },
      { date: "Oct 09", occurrences: 1 },
      { date: "Oct 14", occurrences: 0 },
    ],
  },
  {
    tag: "contact_too_close",
    label: ERROR_TAG_LABELS["contact_too_close"],
    sessionsRecurring: 2,
    trendData: [
      { date: "Sep 18", occurrences: 1 },
      { date: "Sep 25", occurrences: 0 },
      { date: "Oct 02", occurrences: 8 },
      { date: "Oct 09", occurrences: 5 },
      { date: "Oct 14", occurrences: 2 },
    ],
  },
  {
    tag: "weight_transfer_missing",
    label: ERROR_TAG_LABELS["weight_transfer_missing"],
    sessionsRecurring: 1,
    trendData: [
      { date: "Sep 18", occurrences: 2 },
      { date: "Sep 25", occurrences: 3 },
      { date: "Oct 02", occurrences: 4 },
      { date: "Oct 09", occurrences: 6 },
      { date: "Oct 14", occurrences: 10 },
    ],
  },
  {
    tag: "flat_follow_through",
    label: ERROR_TAG_LABELS["flat_follow_through"],
    sessionsRecurring: 1,
    trendData: [
      { date: "Sep 18", occurrences: 4 },
      { date: "Sep 25", occurrences: 2 },
      { date: "Oct 02", occurrences: 1 },
      { date: "Oct 09", occurrences: 1 },
      { date: "Oct 14", occurrences: 0 },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getLatestSession(): Session {
  return MOCK_SESSIONS[MOCK_SESSIONS.length - 1];
}

export function getSessionById(id: string): Session | undefined {
  return MOCK_SESSIONS.find((s) => s.id === id);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}
