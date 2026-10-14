"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Key, CheckCircle2, ExternalLink, Trash2, ShieldCheck } from "lucide-react";
import { getStoredKey, saveKey, clearKey, isKeyValid } from "@/lib/api";
import styles from "./page.module.css";

export default function SettingsPage() {
  const router = useRouter();
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState("");

  useEffect(() => {
    const k = getStoredKey();
    if (isKeyValid(k)) {
      setHasKey(true);
      setMaskedKey(`${k.slice(0, 7)}${"•".repeat(20)}${k.slice(-4)}`);
    }
  }, []);

  const handleSave = () => {
    if (!isKeyValid(keyInput)) return;
    saveKey(keyInput);
    setHasKey(true);
    setMaskedKey(`${keyInput.slice(0, 7)}${"•".repeat(20)}${keyInput.slice(-4)}`);
    setSaved(true);
    setKeyInput("");
    setTimeout(() => {
      router.push("/upload");
    }, 1200);
  };

  const handleClear = () => {
    clearKey();
    setHasKey(false);
    setMaskedKey("");
    setSaved(false);
  };

  return (
    <div className={styles.page}>
      <div className="container" style={{ maxWidth: 580 }}>
        <div className={styles.card}>
          <div className={styles.iconWrap}>
            <Key size={28} color="var(--accent-lime)" />
          </div>
          <h1 className={styles.title}>Connect Your OpenAI Key</h1>
          <p className={styles.sub}>
            SliceIt uses your own OpenAI API key to generate coaching. Your key is stored
            only in <strong>your browser</strong> and sent directly to OpenAI — it never
            touches our servers permanently.
          </p>

          {/* Security callout */}
          <div className={styles.securityBox}>
            <ShieldCheck size={16} color="var(--accent-teal)" />
            <div className={styles.securityText}>
              <strong>Privacy first:</strong> Your key is stored in your browser's localStorage.
              It is sent to our backend only as a request header to call OpenAI, and is never
              logged or saved to any database. Clearing your browser data removes it completely.
            </div>
          </div>

          {/* Current key status */}
          {hasKey && (
            <div className={styles.currentKey}>
              <CheckCircle2 size={16} color="var(--accent-lime)" />
              <span className={styles.currentKeyText}>{maskedKey}</span>
              <button className={styles.clearBtn} onClick={handleClear}>
                <Trash2 size={13} /> Remove
              </button>
            </div>
          )}

          {/* Key input */}
          {!saved && (
            <>
              <div className={styles.inputWrap}>
                <Key size={15} className={styles.inputIcon} />
                <input
                  id="api-key-input"
                  className={styles.input}
                  type={showKey ? "text" : "password"}
                  placeholder="sk-proj-..."
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                />
                <button className={styles.eyeBtn} onClick={() => setShowKey(!showKey)}>
                  {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              <button
                id="save-key-btn"
                className="btn-primary"
                style={{ width: "100%", justifyContent: "center" }}
                disabled={!isKeyValid(keyInput)}
                onClick={handleSave}
              >
                <CheckCircle2 size={15} />
                {hasKey ? "Update Key & Go to Analyze" : "Save Key & Start Analyzing"}
              </button>
            </>
          )}

          {saved && (
            <div className={styles.savedMsg}>
              <CheckCircle2 size={18} color="var(--accent-lime)" />
              Key saved! Redirecting to upload…
            </div>
          )}

          {/* How to get a key */}
          <div className={styles.helpBox}>
            <div className={styles.helpTitle}>Don't have an OpenAI key?</div>
            <ol className={styles.helpSteps}>
              <li>Go to <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">platform.openai.com/api-keys <ExternalLink size={11} /></a></li>
              <li>Sign up or log in to OpenAI</li>
              <li>Click <strong>"Create new secret key"</strong></li>
              <li>Copy the key (starts with <code>sk-</code>) and paste it above</li>
            </ol>
            <div className={styles.helpNote}>
              ℹ️ GPT-4o costs roughly <strong>$0.01–0.05 per session</strong> analysis.
              Set a spend limit in OpenAI's billing settings to stay in control.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
