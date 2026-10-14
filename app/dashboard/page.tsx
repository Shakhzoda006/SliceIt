"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Upload, Zap, TrendingUp, ChevronRight, Clock,
  BarChart2, AlertCircle, Target, ArrowUp, Loader2
} from "lucide-react";
import { fetchSessions, fetchHealth, SessionSummary, formatDate, formatDuration } from "@/lib/api";
import styles from "./page.module.css";

export default function DashboardPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [apiMsg, setApiMsg] = useState("");

  useEffect(() => {
    Promise.all([
      fetchHealth().then((h) => { setApiOk(h.status === "ok"); setApiMsg(h.message); }),
      fetchSessions().then(setSessions),
    ])
      .catch(() => setApiOk(false))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className="container" style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
          <Loader2 size={32} className={styles.spinner} color="var(--accent-lime)" />
        </div>
      </div>
    );
  }

  const latest = sessions[0];
  const readySessions = sessions.filter((s) => s.analysis_ready);
  const avgAccuracy = readySessions.length
    ? Math.round(readySessions.reduce((a, s) => a + (s.accuracy_pct ?? 0), 0) / readySessions.length)
    : null;
  const totalShots = sessions.reduce((a, s) => a + (s.total_shots ?? 0), 0);

  return (
    <div className={styles.page}>
      <div className="container">
        {/* API key warning */}
        {apiOk === false && (
          <div className={styles.warningBanner}>
            <AlertCircle size={18} color="var(--accent-orange)" />
            <div>
              <strong>Backend is not connected.</strong>
              <span> {apiMsg || "Make sure the backend service is running and reachable."}</span>
            </div>
          </div>
        )}

        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Dashboard</h1>
            <p className={styles.sub}>
              {sessions.length === 0
                ? "No sessions yet — upload your first practice video to get started."
                : `${sessions.length} session${sessions.length !== 1 ? "s" : ""} analyzed`}
            </p>
          </div>
          <Link href="/upload" className="btn-primary">
            <Upload size={15} />
            Analyze Video
          </Link>
        </div>

        {/* Empty state */}
        {sessions.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Upload size={32} color="var(--accent-lime)" />
            </div>
            <h2 className={styles.emptyTitle}>No sessions yet</h2>
            <p className={styles.emptySub}>
              Upload a practice video and SliceIt will run real pose estimation on it,
              then use GPT-4o to identify the single most important technique issue to fix.
            </p>
            <Link href="/upload" className="btn-primary">
              <Upload size={15} />
              Upload Your First Video
            </Link>
          </div>
        )}

        {/* Latest focus card */}
        {latest?.analysis_ready && (
          <div className={styles.focusCard}>
            <div className={styles.focusGlow} />
            <div className={styles.focusHeader}>
              <span className="tag tag-lime">
                <div className="status-dot" style={{ width: 6, height: 6 }} />
                Latest AI Focus
              </span>
              <span className={styles.focusDate}>{formatDate(latest.created_at)}</span>
            </div>
            <div className={styles.focusBody}>
              <div className={styles.focusIconWrap}>
                <Zap size={24} fill="currentColor" />
              </div>
              <div>
                <h2 className={styles.focusTitle}>{latest.focus_label ?? "—"}</h2>
                <p className={styles.focusSub}>From: {latest.video_name}</p>
              </div>
            </div>
            <div className={styles.focusStats}>
              <div className={styles.focusStat}>
                <span className={styles.focusStatVal}>{latest.avg_pose_score ?? "—"}</span>
                <span className={styles.focusStatLbl}>Pose score</span>
              </div>
              <div className={styles.focusDivider} />
              <div className={styles.focusStat}>
                <span className={styles.focusStatVal}>{latest.total_shots ?? "—"}</span>
                <span className={styles.focusStatLbl}>Shots detected</span>
              </div>
              <div className={styles.focusDivider} />
              <div className={styles.focusStat}>
                <span className={styles.focusStatVal}>{formatDuration(latest.duration_sec)}</span>
                <span className={styles.focusStatLbl}>Video length</span>
              </div>
            </div>
            <Link href={`/session/${latest.id}`} className={styles.focusViewBtn}>
              View full coaching report <ChevronRight size={16} />
            </Link>
          </div>
        )}

        {/* Stats row — only shown with real data */}
        {sessions.length > 0 && (
          <div className={styles.statsRow}>
            {[
              { icon: BarChart2, label: "Total Sessions", value: sessions.length.toString(), color: "lime" },
              { icon: Target, label: "Total Shots Analyzed", value: totalShots > 0 ? totalShots.toString() : "—", color: "teal" },
              { icon: TrendingUp, label: "Avg Pose Score", value: avgAccuracy !== null ? `${avgAccuracy}` : "—", color: "lime" },
              { icon: ArrowUp, label: "Sessions Ready", value: `${readySessions.length}/${sessions.length}`, color: "teal" },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles[`statIcon_${color}`]}`}><Icon size={18} /></div>
                <div>
                  <div className={styles.statVal}>{value}</div>
                  <div className={styles.statLbl}>{label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Session list */}
        {sessions.length > 0 && (
          <div className={styles.sessionList}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>All Sessions</h2>
              <Link href="/history" className="btn-ghost">History <ChevronRight size={14} /></Link>
            </div>
            {sessions.map((sess) => (
              <Link key={sess.id} href={`/session/${sess.id}`} className={styles.sessionRow}>
                <div className={styles.sessionRowLeft}>
                  <div className={styles.sessionDot} style={{
                    background: sess.analysis_ready ? "var(--accent-lime)" : "var(--text-dim)"
                  }} />
                  <div>
                    <div className={styles.sessionName}>{sess.video_name}</div>
                    <div className={styles.sessionMeta}>
                      <Clock size={11} />
                      {formatDate(sess.created_at)} · {formatDuration(sess.duration_sec)}
                      {!sess.analysis_ready && (
                        <span className={styles.pendingTag}>Processing…</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className={styles.sessionRowRight}>
                  {sess.analysis_ready ? (
                    <>
                      <span className={styles.sessionFocus}>{sess.focus_label}</span>
                      <span className={styles.sessionPose}>{sess.avg_pose_score ?? "—"} pose</span>
                    </>
                  ) : (
                    <Loader2 size={16} className={styles.spinner} color="var(--text-dim)" />
                  )}
                  <ChevronRight size={14} color="var(--text-dim)" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
