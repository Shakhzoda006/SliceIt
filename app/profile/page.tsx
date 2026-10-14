"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Upload, Loader2, Clock, ChevronRight, AlertCircle, Settings } from "lucide-react";
import { fetchSessions, fetchHealth, SessionSummary, formatDate, formatDuration } from "@/lib/api";
import styles from "./page.module.css";

export default function ProfilePage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [health, setHealth] = useState<{ api_key_configured: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchSessions().then(setSessions),
      fetchHealth().then(setHealth),
    ]).finally(() => setLoading(false));
  }, []);

  const readySessions = sessions.filter((s) => s.analysis_ready);
  const totalDuration = sessions.reduce((a, s) => a + (s.duration_sec ?? 0), 0);
  const avgPose = readySessions.length
    ? (readySessions.reduce((a, s) => a + (s.avg_pose_score ?? 0), 0) / readySessions.length).toFixed(1)
    : null;

  // Count how many times each focus appeared
  const focusCounts: Record<string, { label: string; count: number }> = {};
  for (const s of readySessions) {
    if (s.primary_focus && s.focus_label) {
      if (!focusCounts[s.primary_focus]) focusCounts[s.primary_focus] = { label: s.focus_label, count: 0 };
      focusCounts[s.primary_focus].count++;
    }
  }
  const focusHistory = Object.values(focusCounts).sort((a, b) => b.count - a.count);

  if (loading) return (
    <div className={styles.page}>
      <div className="container" style={{ display:"flex", justifyContent:"center", paddingTop:80 }}>
        <Loader2 size={32} style={{ animation:"spin 1s linear infinite" }} color="var(--accent-lime)" />
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.title}>Profile & Settings</h1>
          <Link href="/upload" className="btn-primary" style={{ flexShrink:0 }}>
            <Upload size={14} /> Analyze Video
          </Link>
        </div>

        {/* API Status */}
        <div className={`${styles.statusCard} ${health?.api_key_configured ? styles.statusOk : styles.statusWarn}`}>
          <div className={styles.statusIcon}>
            {health?.api_key_configured
              ? <div className="status-dot" />
              : <AlertCircle size={16} color="var(--accent-orange)" />}
          </div>
          <div>
            <div className={styles.statusTitle}>
              {health?.api_key_configured ? "OpenAI API Connected" : "OpenAI API Key Missing"}
            </div>
            <div className={styles.statusMsg}>{health?.message}</div>
          </div>
        </div>

        {/* Stats from real sessions */}
        <div className={styles.statsGrid}>
          {[
            { label: "Total Sessions", value: sessions.length.toString() },
            { label: "Analyzed Sessions", value: readySessions.length.toString() },
            { label: "Practice Time", value: totalDuration > 0 ? `${Math.round(totalDuration / 60)}m` : "—" },
            { label: "Avg Pose Score", value: avgPose ?? "—" },
          ].map(({ label, value }) => (
            <div key={label} className={styles.statCard}>
              <div className={styles.statVal}>{value}</div>
              <div className={styles.statLbl}>{label}</div>
            </div>
          ))}
        </div>

        <div className={styles.mainGrid}>
          {/* Focus history */}
          <div className={styles.focusHistoryCard}>
            <h2 className={styles.cardTitle}>AI Focus History</h2>
            <p className={styles.cardSub}>Technique issues the AI has identified across your sessions, ranked by frequency.</p>
            {focusHistory.length === 0 ? (
              <div className={styles.emptyNote}>No sessions analyzed yet. Upload a video to get started.</div>
            ) : (
              <div className={styles.focusList}>
                {focusHistory.map(({ label, count }) => (
                  <div key={label} className={styles.focusItem}>
                    <div className={styles.focusItemLabel}>{label}</div>
                    <div className={styles.focusItemBar}>
                      <div className="progress-track" style={{ flex:1 }}>
                        <div className="progress-fill" style={{ width:`${Math.min((count / sessions.length) * 100, 100)}%` }} />
                      </div>
                      <span className={styles.focusCount}>{count}×</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Setup guide */}
          <div className={styles.setupCard}>
            <h2 className={styles.cardTitle}><Settings size={15} /> Setup</h2>

            <div className={styles.setupSteps}>
              <div className={`${styles.setupStep} ${health?.api_key_configured ? styles.setupDone : styles.setupPending}`}>
                <div className={styles.setupStepNum}>{health?.api_key_configured ? "✓" : "1"}</div>
                <div>
                  <div className={styles.setupStepTitle}>Add your OpenAI API key</div>
                  <div className={styles.setupStepDesc}>
                    Create <code>backend/.env</code> and add:<br />
                    <code>OPENAI_API_KEY=sk-your-key-here</code>
                  </div>
                </div>
              </div>
              <div className={styles.setupStep}>
                <div className={styles.setupStepNum}>2</div>
                <div>
                  <div className={styles.setupStepTitle}>Start the backend</div>
                  <div className={styles.setupStepDesc}>
                    In a terminal, from the <code>backend/</code> folder:<br />
                    <code>py -m uvicorn main:app --reload</code>
                  </div>
                </div>
              </div>
              <div className={styles.setupStep}>
                <div className={styles.setupStepNum}>3</div>
                <div>
                  <div className={styles.setupStepTitle}>Upload a practice video</div>
                  <div className={styles.setupStepDesc}>
                    Go to Analyze, drop in your video, and get real AI coaching based on actual pose data.
                  </div>
                </div>
              </div>
            </div>

            <Link href="/upload" className="btn-primary" style={{ width:"100%", justifyContent:"center", marginTop:20 }}>
              <Upload size={14} /> Upload Video Now
            </Link>
          </div>
        </div>

        {/* Recent sessions */}
        {sessions.length > 0 && (
          <div className={styles.recentCard}>
            <div className={styles.recentHead}>
              <h2 className={styles.cardTitle}>Recent Sessions</h2>
              <Link href="/history" className="btn-ghost">All <ChevronRight size={14} /></Link>
            </div>
            {sessions.slice(0, 5).map((s) => (
              <Link key={s.id} href={`/session/${s.id}`} className={styles.recentRow}>
                <div className={styles.recentInfo}>
                  <div className={styles.recentDate}>{formatDate(s.created_at)}</div>
                  <div className={styles.recentVideo}><Clock size={11} /> {formatDuration(s.duration_sec)} · {s.video_name}</div>
                </div>
                <div className={styles.recentRight}>
                  {s.analysis_ready
                    ? <span className={styles.recentFocus}>{s.focus_label}</span>
                    : <span className={styles.recentPending}>Processing…</span>}
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
