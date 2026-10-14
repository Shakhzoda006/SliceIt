// lib/api.ts — Real API client talking to the FastAPI backend

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── API Key management (stored in localStorage, never sent to our server) ────
export const KEY_STORAGE = "sliceit_openai_key";

export function getStoredKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(KEY_STORAGE) || "";
}

export function saveKey(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY_STORAGE, key.trim());
}

export function clearKey(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY_STORAGE);
}

export function isKeyValid(key: string): boolean {
  return key.startsWith("sk-") && key.length > 20;
}

export interface SessionSummary {
  id: number;
  created_at: string;
  video_name: string;
  duration_sec: number | null;
  total_shots: number | null;
  accuracy_pct: number | null;
  avg_pose_score: number | null;
  primary_focus: string | null;
  focus_label: string | null;
  analysis_ready: boolean;
}

export interface Shot {
  id: number;
  frame_idx: number;
  timestamp: number;
  stroke_type: string | null;
  pose_score: number | null;
  error_tags: string[];
}

export interface SessionDetail extends SessionSummary {
  focus_explanation: string | null;
  focus_context: string | null;
  drill_suggestion: string | null;
  fps: number | null;
  total_frames: number | null;
  shots: Shot[];
}

export interface AnalyzeResponse {
  session_id: number;
  state: string;
  message: string;
}

export interface StatusResponse {
  state: "running" | "done" | "error" | "pending";
  session_id: number;
  step?: string;
  step_label?: string;
  error?: string;
  coaching?: Record<string, unknown>;
}

export interface HealthResponse {
  status: string;
  api_key_mode?: string;
  message: string;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error("Backend not reachable");
  return res.json();
}

export async function fetchSessions(): Promise<SessionSummary[]> {
  const res = await fetch(`${API_BASE}/api/sessions`);
  if (!res.ok) throw new Error("Failed to fetch sessions");
  return res.json();
}

export async function fetchSession(id: number): Promise<SessionDetail> {
  const res = await fetch(`${API_BASE}/api/sessions/${id}`);
  if (!res.ok) throw new Error("Session not found");
  return res.json();
}

export async function fetchAnalysisStatus(sessionId: number): Promise<StatusResponse> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/status`);
  if (!res.ok) throw new Error("Status check failed");
  return res.json();
}

export async function uploadAndAnalyze(
  file: File,
  isRightHanded: boolean,
): Promise<AnalyzeResponse> {
  const key = getStoredKey();
  if (!isKeyValid(key)) {
    throw new Error("No valid OpenAI API key set. Please enter your key in Settings first.");
  }

  const form = new FormData();
  form.append("file", file);
  form.append("is_right_handed", isRightHanded.toString());

  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    headers: {
      "X-OpenAI-Key": key,  // sent once, never stored by backend
    },
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail || "Upload failed");
  }

  return res.json();
}

export async function deleteSession(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/sessions/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Delete failed");
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

export function formatDuration(sec: number | null): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}
