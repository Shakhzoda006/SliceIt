"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, Film, CheckCircle2, ChevronRight,
  Loader2, Zap, Eye, Activity, Brain, AlertCircle, X
} from "lucide-react";
import { uploadAndAnalyze, fetchAnalysisStatus, fetchHealth, getStoredKey, isKeyValid } from "@/lib/api";
import styles from "./page.module.css";

const PRACTICE_TYPES = [
  { value: "wall", label: "Wall Practice", desc: "Hitting against a wall or backboard" },
  { value: "ball_machine", label: "Ball Machine", desc: "Practicing with a ball machine" },
  { value: "self_feed", label: "Self-Feed", desc: "Tossing the ball to yourself" },
  { value: "rally", label: "Live Rally", desc: "Rally with another player" },
];

const PROCESSING_LABELS = [
  { icon: Upload, label: "Uploading video to backend…" },
  { icon: Eye, label: "Running MediaPipe pose detection…" },
  { icon: Activity, label: "Extracting joint landmarks from frames…" },
  { icon: Brain, label: "Sending pose metrics to GPT-4o…" },
  { icon: Zap, label: "Generating your coaching focus…" },
];

type Step = "upload" | "configure" | "processing" | "done" | "error";

export default function UploadPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isRightHanded, setIsRightHanded] = useState(true);
  const [practiceType, setPracticeType] = useState("ball_machine");
  const [processingLabel, setProcessingLabel] = useState(PROCESSING_LABELS[0].label);
  const [processingIcon, setProcessingIconIdx] = useState(0);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [coaching, setCoaching] = useState<Record<string, unknown> | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [apiKeyOk, setApiKeyOk] = useState<boolean | null>(null);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const labelTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetToUpload = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setStep("upload");
    setFile(null);
    setSessionId(null);
    setCoaching(null);
    setErrorMsg("");
    setProcessingLabel(PROCESSING_LABELS[0].label);
    setProcessingIconIdx(0);
  };

  useEffect(() => {
    // Check if user has set their key in localStorage
    const key = getStoredKey();
    setApiKeyOk(isKeyValid(key));

    // Check backend is reachable
    fetchHealth()
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false));

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (labelTimerRef.current) clearInterval(labelTimerRef.current);
    };
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f?.type?.startsWith("video/")) setFile(f);
  }, []);

  const startAnalysis = async () => {
    if (!file) return;

    // Check key before even starting
    const key = getStoredKey();
    if (!isKeyValid(key)) {
      setErrorMsg("No OpenAI API key found. Go to \"API Key\" in the navigation and enter your key first.");
      setStep("error");
      return;
    }

    setStep("processing");
    setProcessingIconIdx(0);
    setProcessingLabel(PROCESSING_LABELS[0].label);

    let labelIdx = 0;
    labelTimerRef.current = setInterval(() => {
      labelIdx = Math.min(labelIdx + 1, PROCESSING_LABELS.length - 1);
      setProcessingIconIdx(labelIdx);
      setProcessingLabel(PROCESSING_LABELS[labelIdx].label);
    }, 4000);

    const clearTimers = () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (labelTimerRef.current) clearInterval(labelTimerRef.current);
    };

    try {
      const response = await uploadAndAnalyze(file, isRightHanded);
      const sid = response.session_id;
      setSessionId(sid);

      // Poll for real backend status
      let pollFailures = 0;
      pollRef.current = setInterval(async () => {
        try {
          const status = await fetchAnalysisStatus(sid);
          if (status.step_label) setProcessingLabel(status.step_label);
          pollFailures = 0;

          if (status.state === "done") {
            clearTimers();
            setCoaching(status.coaching ?? null);
            setStep("done");
          } else if (status.state === "error") {
            clearTimers();
            setErrorMsg(status.error ?? "Analysis failed. Check that your OpenAI key is valid.");
            setStep("error");
          }
        } catch {
          pollFailures++;
          if (pollFailures >= 5) {
            clearTimers();
            setErrorMsg("Lost connection to the backend server. Is it running on port 8000?");
            setStep("error");
          }
        }
      }, 2000);

    } catch (e: unknown) {
      clearTimers();
      const msg = e instanceof Error ? e.message : "Upload failed";
      setErrorMsg(msg);
      setStep("error");
    }
  };

  const STEPS: Step[] = ["upload", "configure", "processing", "done"];

  return (
    <div className={styles.page}>
      <div className="container" style={{ maxWidth: 720 }}>

        {/* API key warning — check localStorage */}
        {apiKeyOk === false && step === "upload" && (
          <div className={styles.warningBanner}>
            <AlertCircle size={18} />
            <div>
              <strong>No OpenAI API key set.</strong>{" "}
              <a href="/settings" style={{ color: "var(--accent-lime)", fontWeight: 700 }}>Click here to add your key</a>{" "}
              before uploading — it takes 10 seconds.
            </div>
          </div>
        )}
        {backendOk === false && step === "upload" && (
          <div className={styles.warningBanner} style={{ borderColor: "rgba(239,68,68,0.2)", background: "var(--accent-red-dim)" }}>
            <AlertCircle size={18} color="var(--accent-red)" />
            <div style={{ color: "var(--accent-red)" }}>
              <strong>Backend not reachable.</strong> Start the backend server: <code>py -m uvicorn main:app --port 8000</code>
            </div>
          </div>
        )}

        {/* Step indicator */}
        <div className={styles.stepIndicator}>
          {["Upload", "Configure", "Analyze", "Results"].map((label, i) => {
            const stepVal = STEPS[i];
            const currentIdx = STEPS.indexOf(step);
            return (
              <div key={label} className={styles.stepItem}>
                <div className={`${styles.stepDot} ${step === stepVal ? styles.stepDotActive : currentIdx > i ? styles.stepDotDone : ""}`}>
                  {currentIdx > i ? <CheckCircle2 size={14} /> : i + 1}
                </div>
                <span className={styles.stepLabel}>{label}</span>
                {i < 3 && <div className={styles.stepLine} />}
              </div>
            );
          })}
        </div>

        {/* ── Step 1: Upload ── */}
        {step === "upload" && (
          <div className={styles.card}>
            <h1 className={styles.cardTitle}>Upload Practice Video</h1>
            <p className={styles.cardSub}>Your video stays on your machine — it's processed locally by MediaPipe, then only structured pose metrics are sent to GPT-4o.</p>

            <div
              className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ""} ${file ? styles.dropzoneDone : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("fileInput")?.click()}
            >
              <input id="fileInput" type="file" accept="video/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
              {file ? (
                <div className={styles.filePreview}>
                  <div className={styles.fileIconDone}><CheckCircle2 size={26} /></div>
                  <div className={styles.fileInfo}>
                    <div className={styles.fileName}>{file.name}</div>
                    <div className={styles.fileSize}>{(file.size / 1024 / 1024).toFixed(1)} MB · Ready</div>
                  </div>
                  <button className={styles.fileClear} onClick={(e) => { e.stopPropagation(); setFile(null); }}><X size={16} /></button>
                </div>
              ) : (
                <div className={styles.dropzoneInner}>
                  <div className={styles.dropIcon}><Upload size={28} /></div>
                  <div className={styles.dropTitle}>Drop your practice video here</div>
                  <div className={styles.dropSub}>or click to browse</div>
                  <div className={styles.dropHint}>MP4 · MOV · WebM · Up to 2GB</div>
                </div>
              )}
            </div>

            <div className={styles.tips}>
              {[
                "🎥 Keep your full body in frame — feet and racket both visible",
                "⚡ Minimum 10 seconds for meaningful analysis",
                "🎾 Wall rallies, ball machine, or self-feed all work",
              ].map((t) => <div key={t} className={styles.tip}>{t}</div>)}
            </div>

            <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={!file} onClick={() => setStep("configure")}>
              Continue <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ── Step 2: Configure ── */}
        {step === "configure" && (
          <div className={styles.card}>
            <h1 className={styles.cardTitle}>Configure Analysis</h1>
            <p className={styles.cardSub}>These settings help MediaPipe interpret your pose correctly.</p>

            <div className={styles.configSection}>
              <label className={styles.configLabel}>Dominant hand</label>
              <div className={styles.handRow}>
                <button className={`${styles.handBtn} ${isRightHanded ? styles.handBtnActive : ""}`} onClick={() => setIsRightHanded(true)}>Right-handed</button>
                <button className={`${styles.handBtn} ${!isRightHanded ? styles.handBtnActive : ""}`} onClick={() => setIsRightHanded(false)}>Left-handed</button>
              </div>
            </div>

            <div className={styles.configSection}>
              <label className={styles.configLabel}>Practice type</label>
              <div className={styles.practiceGrid}>
                {PRACTICE_TYPES.map((pt) => (
                  <button key={pt.value} className={`${styles.practiceBtn} ${practiceType === pt.value ? styles.practiceBtnActive : ""}`} onClick={() => setPracticeType(pt.value)}>
                    <div className={styles.practiceBtnTitle}>{pt.label}</div>
                    <div className={styles.practiceBtnDesc}>{pt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.configActions}>
              <button className="btn-secondary" onClick={() => setStep("upload")}>Back</button>
              <button className="btn-primary" onClick={startAnalysis} id="start-analysis-btn">
                <Zap size={15} /> Start Real Analysis
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Processing ── */}
        {step === "processing" && (
          <div className={styles.card}>
            <div className={styles.processingHeader}>
              <div className={styles.processingIcon}><Loader2 size={32} className={styles.spinner} color="var(--accent-lime)" /></div>
              <h1 className={styles.cardTitle}>Analyzing Your Video</h1>
              <p className={styles.cardSub}>MediaPipe is extracting pose landmarks. Results are real and take 10–60 seconds depending on video length.</p>
            </div>
            <div className={styles.processingSteps}>
              {PROCESSING_LABELS.map(({ icon: Icon, label }, i) => (
                <div key={i} className={`${styles.procStep} ${label === processingLabel ? styles.procStepActive : PROCESSING_LABELS.indexOf(PROCESSING_LABELS.find(l => l.label === processingLabel)!) > i ? styles.procStepDone : ""}`}>
                  <div className={styles.procStepIcon}><Icon size={15} /></div>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <div className={styles.progressTrack}><div className={styles.progressPulse} /></div>
            <p className={styles.processingNote}>Do not close this tab. The backend is actively processing your video.</p>
          </div>
        )}

        {/* ── Step 4: Done ── */}
        {step === "done" && coaching && (
          <div className={`${styles.card} ${styles.doneCard}`}>
            <div className={styles.doneGlow} />
            <div className={styles.doneBadge}><CheckCircle2 size={18} /> Analysis Complete</div>
            <h1 className={styles.doneTitle}>Your Focus for Next Practice</h1>
            <div className={styles.doneFocus}>
              <div className={styles.doneFocusIcon}><Zap size={22} fill="currentColor" /></div>
              <div>
                <div className={styles.doneFocusTag}>{coaching.primary_focus_label as string}</div>
                <p className={styles.doneFocusDesc}>{coaching.explanation as string}</p>
              </div>
            </div>
            {(coaching.honest_limitations as string) && (
              <div className={styles.limitationsBox}>
                <AlertCircle size={13} />
                <span><strong>Analysis notes:</strong> {coaching.honest_limitations as string}</span>
              </div>
            )}
            <div className={styles.confidenceBadge}>
              AI confidence: <strong>{coaching.confidence as string}</strong>
            </div>
            <div className={styles.doneActions}>
              <button className="btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={() => router.push(`/session/${sessionId}`)}>
                View Full Report <ChevronRight size={16} />
              </button>
              <button className="btn-secondary" onClick={() => router.push("/dashboard")}>Dashboard</button>
            </div>
            <button
              className={styles.analyzeAnotherBtn}
              onClick={resetToUpload}
            >
              <Upload size={14} /> Analyze Another Video
            </button>
          </div>
        )}

        {/* ── Error state ── */}
        {step === "error" && (
          <div className={`${styles.card} ${styles.errorCard}`}>
            <div className={styles.errorIcon}><AlertCircle size={32} color="var(--accent-red)" /></div>
            <h1 className={styles.cardTitle}>Analysis Failed</h1>
            <p className={styles.errorMsg}>{errorMsg}</p>
            <div className={styles.errorHelp}>
              <strong>Common fixes:</strong>
              <ul>
                <li>Open the API Key section in the app and enter a valid OpenAI API key</li>
                <li>Make sure the backend server is running: <code>py -m uvicorn main:app --reload</code></li>
                <li>Check that your video file is not corrupted and is a valid video format</li>
              </ul>
            </div>
            <button className="btn-secondary" onClick={() => { setStep("upload"); setFile(null); setErrorMsg(""); }}>Try Again</button>
          </div>
        )}
      </div>
    </div>
  );
}
