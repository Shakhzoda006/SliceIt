"use client";

import Link from "next/link";
import { ArrowRight, Zap, Brain, TrendingUp, Video, ChevronRight, Play } from "lucide-react";
import styles from "./page.module.css";

const features = [
  {
    icon: Video,
    title: "Upload & Analyze",
    desc: "Drop in any single-camera practice video — wall sessions, ball machine, self-feed. No special setup required.",
  },
  {
    icon: Brain,
    title: "AI Pose Pipeline",
    desc: "MediaPipe-powered 2D/3D landmark extraction identifies stroke mechanics, joint angles, and timing across every shot.",
  },
  {
    icon: Zap,
    title: "One Focus. Always.",
    desc: "SliceIt never overwhelms you with a list. Cross-session AI logic surfaces the single most impactful thing to fix next.",
  },
  {
    icon: TrendingUp,
    title: "Track Real Progress",
    desc: "Session-over-session trend charts show how each technique flaw is responding to your practice focus.",
  },
];

const stats = [
  { value: "1", label: "Focus per session" },
  { value: "97%", label: "Pose detection accuracy" },
  { value: "3×", label: "Faster improvement" },
  { value: "5 sec", label: "Analysis turnaround" },
];

export default function LandingPage() {
  return (
    <div className={styles.page}>
      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroBadge}>
          <div className="status-dot" />
          AI Coaching Engine — Active
        </div>

        <h1 className={styles.heroTitle}>
          Stop drowning in
          <br />
          <span className={styles.heroAccent}>coaching noise.</span>
        </h1>

        <p className={styles.heroSub}>
          SliceIt analyzes your tennis practice videos and gives you{" "}
          <strong>exactly one thing</strong> to fix — the one that unlocks everything else.
          Backed by pose estimation AI and multi-session learning.
        </p>

        <div className={styles.heroCtas}>
          <Link href="/upload" className="btn-primary">
            <Video size={16} />
            Analyze Your First Video
          </Link>
          <Link href="/dashboard" className="btn-secondary">
            View Demo Dashboard
            <ArrowRight size={16} />
          </Link>
        </div>

        {/* Floating demo card */}
        <div className={styles.heroCard}>
          <div className={styles.heroCardHeader}>
            <div className={styles.heroCardDot} />
            <span>Session #5 · Oct 14</span>
            <span className={styles.heroCardBadge}>Today&apos;s Focus</span>
          </div>
          <div className={styles.heroCardFocus}>
            <div className={styles.heroFocusIcon}>
              <Zap size={18} fill="currentColor" />
            </div>
            <div>
              <div className={styles.heroFocusLabel}>WEIGHT TRANSFER</div>
              <p className={styles.heroFocusDesc}>
                You&apos;re finishing shots with weight on the back foot, capping your power potential.
                Drive through the ball and let your momentum carry forward.
              </p>
            </div>
          </div>
          <div className={styles.heroCardStats}>
            <div className={styles.heroStat}>
              <span className={styles.heroStatVal}>81%</span>
              <span className={styles.heroStatLbl}>Accuracy</span>
            </div>
            <div className={styles.heroStat}>
              <span className={styles.heroStatVal}>+5%</span>
              <span className={styles.heroStatLbl}>vs last session</span>
            </div>
            <div className={styles.heroStat}>
              <span className={styles.heroStatVal}>97 km/h</span>
              <span className={styles.heroStatLbl}>Avg ball speed</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className={styles.statsBar}>
        <div className="container">
          <div className={styles.statsGrid}>
            {stats.map((s) => (
              <div key={s.label} className={styles.statItem}>
                <span className={styles.statValue}>{s.value}</span>
                <span className={styles.statLabel}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className={styles.section}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className="tag tag-lime">How It Works</span>
            <h2 className={styles.sectionTitle}>From video to breakthrough in minutes</h2>
          </div>

          <div className={styles.steps}>
            {[
              { n: "01", title: "Upload your practice video", desc: "Any angle, any lighting. Wall rallies, ball machine, self-feed. MP4 or MOV under 2GB." },
              { n: "02", title: "AI extracts every shot", desc: "Pose landmarks tracked at 30fps. Stroke type auto-detected. Ball trajectory estimated from physics." },
              { n: "03", title: "Cross-session analysis runs", desc: "Your current errors are ranked against your history. Recurring patterns get weighted higher." },
              { n: "04", title: "One focus point delivered", desc: "A coaching card explains what to fix, why it matters, and how to practice it next time." },
            ].map((step, i) => (
              <div key={i} className={styles.step}>
                <div className={styles.stepNum}>{step.n}</div>
                <div className={styles.stepContent}>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepDesc}>{step.desc}</p>
                </div>
                {i < 3 && <ChevronRight className={styles.stepArrow} size={20} />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className={styles.section}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className="tag tag-teal">Features</span>
            <h2 className={styles.sectionTitle}>Everything a personal coach sees</h2>
            <p className={styles.sectionSub}>
              Built around the same principles elite coaches use — only visible to you, on-demand, after every practice.
            </p>
          </div>

          <div className={styles.featuresGrid}>
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className={styles.featureCard}>
                <div className={styles.featureIcon}>
                  <Icon size={20} />
                </div>
                <h3 className={styles.featureTitle}>{title}</h3>
                <p className={styles.featureDesc}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA bottom */}
      <section className={styles.ctaSection}>
        <div className="container">
          <div className={styles.ctaInner}>
            <div className={styles.ctaGlow} />
            <span className="tag tag-lime" style={{ marginBottom: 16 }}>Start Free</span>
            <h2 className={styles.ctaTitle}>Ready to break your plateau?</h2>
            <p className={styles.ctaSub}>
              Upload your first video and get your personalized coaching card in under 5 seconds.
            </p>
            <div className={styles.ctaBtns}>
              <Link href="/upload" className="btn-primary">
                <Play size={15} fill="currentColor" />
                Upload Practice Video
              </Link>
              <Link href="/history" className="btn-secondary">
                See Sample Progress Report
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
