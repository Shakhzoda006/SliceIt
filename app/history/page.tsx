"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChevronRight, Clock, Upload, Loader2, AlertCircle } from "lucide-react";
import { fetchSessions, SessionSummary, formatDate, formatDuration } from "@/lib/api";
import styles from "./page.module.css";

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSessions()
      .then((data) => setSessions(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const readySessions = [...sessions].reverse().filter((s) => s.analysis_ready);

  const chartData = readySessions.map((s, i) => ({
    label: `S${i + 1}`,
    date: new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    poseScore: s.avg_pose_score ?? 0,
  }));

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
          <div>
            <h1 className={styles.title}>Progress History</h1>
            <p className={styles.sub}>{sessions.length} session{sessions.length !== 1 ? "s" : ""} recorded</p>
          </div>
          <Link href="/upload" className="btn-primary" style={{ flexShrink:0 }}>
            <Upload size={14} /> New Session
          </Link>
        </div>

        {error && (
          <div className={styles.errorBox}>
            <AlertCircle size={18} /> {error} — make sure the backend is running on port 8000.
          </div>
        )}

        {sessions.length === 0 && !error && (
          <div className={styles.emptyState}>
            <Upload size={32} color="var(--accent-lime)" />
            <h2>No history yet</h2>
            <p>Upload and analyze your first practice video to start tracking your progress.</p>
            <Link href="/upload" className="btn-primary"><Upload size={14} /> Upload Video</Link>
          </div>
        )}

        {/* Pose Score Chart */}
        {chartData.length >= 2 && (
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h2 className={styles.chartTitle}>Pose Quality Score Over Time</h2>
              <span className={styles.chartNote}>Higher = MediaPipe detected better full-body visibility and landmark confidence</span>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="poseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c8f84c" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#c8f84c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(200,248,76,0.06)" />
                <XAxis dataKey="date" tick={{ fill:"#365e42", fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill:"#365e42", fontSize:11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background:"var(--bg-surface)", border:"1px solid var(--border-card)", borderRadius:"8px", color:"var(--text-primary)" }}
                  formatter={(v) => [`${Number(v).toFixed(1)}`, "Pose Score"]}
                />
                <Area type="monotone" dataKey="poseScore" stroke="#c8f84c" strokeWidth={2.5} fill="url(#poseGrad)"
                  dot={{ r:4, fill:"#c8f84c", strokeWidth:0 }} activeDot={{ r:6, fill:"#c8f84c" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Sessions list */}
        {sessions.length > 0 && (
          <>
            <h2 className={styles.sectionTitle}>All Sessions</h2>
            <div className={styles.sessionList}>
              {sessions.map((sess, i) => (
                <Link key={sess.id} href={`/session/${sess.id}`} className={styles.sessionCard}>
                  <div className={styles.sessionLeft}>
                    <div className={styles.sessionNum}>#{sessions.length - i}</div>
                    <div>
                      <div className={styles.sessionDate}>{formatDate(sess.created_at)}</div>
                      <div className={styles.sessionVideo}>
                        <Clock size={11} /> {formatDuration(sess.duration_sec)} · {sess.video_name}
                      </div>
                    </div>
                  </div>
                  <div className={styles.sessionCenter}>
                    {sess.analysis_ready ? (
                      <div className={styles.focusChip}>{sess.focus_label}</div>
                    ) : (
                      <div className={styles.pendingChip}><Loader2 size={11} style={{ animation:"spin 1s linear infinite" }} /> Processing…</div>
                    )}
                  </div>
                  <div className={styles.sessionRight}>
                    <span className={styles.sessionPose}>
                      {sess.avg_pose_score != null ? `${sess.avg_pose_score.toFixed(0)} pose` : "—"}
                    </span>
                    <ChevronRight size={16} color="var(--text-dim)" />
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
