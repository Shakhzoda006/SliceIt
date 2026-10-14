"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Zap, Target, Clock, Film,
  CheckCircle2, XCircle, ChevronRight, Activity, AlertCircle, Loader2
} from "lucide-react";
import { fetchSession, fetchSessions, SessionDetail, SessionSummary, formatDate, formatDuration } from "@/lib/api";
import styles from "./page.module.css";

const STROKE_COLORS: Record<string, string> = {
  forehand: "var(--accent-lime)",
  backhand: "var(--accent-teal)",
  serve: "var(--accent-orange)",
  neutral: "var(--text-dim)",
};

export function SessionClient() {
  const params = useParams();
  const id = Number(params.id);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [allSessions, setAllSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetchSession(id).then(setSession),
      fetchSessions().then(setAllSessions),
    ])
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className={styles.page}>
      <div className="container" style={{ display:"flex", justifyContent:"center", paddingTop:80 }}>
        <Loader2 size={32} style={{ animation:"spin 1s linear infinite" }} color="var(--accent-lime)" />
      </div>
    </div>
  );

  if (error || !session) return (
    <div className={styles.page}>
      <div className="container">
        <Link href="/dashboard" className={styles.backBtn}><ArrowLeft size={16} /> Dashboard</Link>
        <div className={styles.errorBox}>
          <AlertCircle size={24} color="var(--accent-red)" />
          <div>{error || "Session not found"}</div>
        </div>
      </div>
    </div>
  );

  const otherSessions = allSessions.filter((s) => s.id !== session.id && s.analysis_ready);

  return (
    <div className={styles.page}>
      <div className="container">
        <Link href="/dashboard" className={styles.backBtn}><ArrowLeft size={16} /> Dashboard</Link>

        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>{formatDate(session.created_at)}</h1>
            <div className={styles.meta}>
              <Film size={13} /> {session.video_name}
              <span className={styles.metaDot}>·</span>
              <Clock size={13} /> {formatDuration(session.duration_sec)}
              {session.total_shots != null && <><span className={styles.metaDot}>·</span> {session.total_shots} frames analyzed</>}
            </div>
          </div>
          {!session.analysis_ready && (
            <div className={styles.pendingBadge}><Loader2 size={14} style={{ animation:"spin 1s linear infinite" }} /> Analysis in progress…</div>
          )}
        </div>

        {!session.analysis_ready ? (
          <div className={styles.pendingCard}>
            <Loader2 size={32} style={{ animation:"spin 1s linear infinite" }} color="var(--accent-lime)" />
            <h2>Analysis running</h2>
            <p>MediaPipe is processing your video. Refresh in a moment.</p>
          </div>
        ) : (
          <div className={styles.mainGrid}>
            <div className={styles.leftCol}>
              {session.primary_focus === "no_tennis_detected" && (
                <div className={styles.noTennisCard}>
                  <div className={styles.noTennisIcon}>🎾</div>
                  <h2 className={styles.noTennisTitle}>No Tennis Detected</h2>
                  <p className={styles.noTennisDesc}>{session.focus_explanation}</p>
                  <p className={styles.noTennisDrill}><strong>Tip:</strong> {session.drill_suggestion}</p>
                </div>
              )}

              {session.primary_focus !== "no_tennis_detected" && (
                <div className={styles.coachingCard}>
                  <div className={styles.coachingGlow} />
                  <div className={styles.coachingHeader}>
                    <span className="tag tag-lime"><Zap size={11} fill="currentColor" /> AI Coaching Focus</span>
                  </div>
                  <div className={styles.focusTitleRow}>
                    <div className={styles.focusIconBox}><Zap size={20} fill="currentColor" /></div>
                    <h2 className={styles.focusTitle}>{session.focus_label ?? "—"}</h2>
                  </div>
                  <p className={styles.focusExplanation}>{session.focus_explanation}</p>

                  {session.focus_context && (
                    <div className={styles.reasoningBox}>
                      <div className={styles.reasoningLabel}><Target size={13} /> Why this focus was chosen</div>
                      <p className={styles.reasoningText}>{session.focus_context}</p>
                    </div>
                  )}

                  {session.drill_suggestion && (
                    <div className={styles.drillBox}>
                      <div className={styles.drillLabel}><Activity size={13} /> Drill for next session</div>
                      <p className={styles.drillText}>{session.drill_suggestion}</p>
                    </div>
                  )}
                </div>
              )}

              {session.shots.length > 0 && (
                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>Body Detection Frames ({session.shots.length})</h2>
                  <p className={styles.sectionNote}>Each row is a video frame where MediaPipe detected a human body. <strong>"Pose score"</strong> only means how visible your body was on camera (100 = fully in frame) — it does not measure tennis quality.</p>
                  <div className={styles.timeline}>
                    {session.shots.slice(0, 50).map((shot) => (
                      <div key={shot.id} className={styles.shotRow}>
                        <div className={styles.shotTime}>{shot.timestamp.toFixed(1)}s</div>
                        <div className={styles.shotInfo}>
                          <span className={styles.shotStroke} style={{ color: STROKE_COLORS[shot.stroke_type ?? "neutral"] ?? "var(--text-dim)" }}>
                            {shot.stroke_type ?? "unknown"}
                          </span>
                          {(shot.error_tags ?? []).map((tag) => (
                            <span key={tag} className="tag tag-orange" style={{ fontSize: 10 }}>{tag}</span>
                          ))}
                        </div>
                        <div className={styles.shotPose}>
                          <span className={styles.shotPoseVal}>{shot.pose_score?.toFixed(0) ?? "—"}</span>
                          <span className={styles.shotPoseLbl}>pose</span>
                        </div>
                      </div>
                    ))}
                    {session.shots.length > 50 && (
                      <div className={styles.shotMore}>… and {session.shots.length - 50} more frames</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.rightCol}>
              <div className={styles.statsCard}>
                <h3 className={styles.cardTitle}>Session Stats</h3>
                <div className={styles.statsList}>
                  {[
                    { label: "Body Visibility Score", value: session.avg_pose_score?.toFixed(1) ?? "—" },
                    { label: "Frames analyzed", value: session.shots.length.toString() },
                    { label: "Video duration", value: formatDuration(session.duration_sec) },
                    { label: "Total frames", value: session.total_frames?.toString() ?? "—" },
                    { label: "FPS", value: session.fps?.toFixed(1) ?? "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className={styles.statsRow}>
                      <span className={styles.statsLabel}>{label}</span>
                      <span className={styles.statsValue}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {otherSessions.length > 0 && (
                <div className={styles.navCard}>
                  <h3 className={styles.cardTitle}>Other Sessions</h3>
                  <div className={styles.navList}>
                    {otherSessions.slice(0, 5).map((s) => (
                      <Link key={s.id} href={`/session/${s.id}`} className={styles.navItem}>
                        <div>
                          <div className={styles.navDate}>{formatDate(s.created_at)}</div>
                          <div className={styles.navFocus}>{s.focus_label ?? "Pending"}</div>
                        </div>
                        <ChevronRight size={14} color="var(--text-dim)" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
