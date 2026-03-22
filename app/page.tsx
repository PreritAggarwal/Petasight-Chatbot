"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { resolveColor, accessibleTextColor, InputType } from "@/lib/colors";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Leader {
  id: number;
  name: string;
  role: string;
  language: string;
  flag: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  // Only on assistant messages:
  nativeText?: string;
  translation?: string;
  inputType?: InputType;
  colorValue?: number;
  toneLabel?: string;
  bgColor?: string;
  textColor?: string;
}

// ─── Hint chips shown before first message ───────────────────────────────────
const HINTS = [
  "Submit the board report by 6pm today",
  "1337",
  "I just got promoted! Best day ever 🎉",
  "Nobody remembers my birthday 😔",
  "The quarterly numbers look average",
];

// ─── SendIcon SVG ─────────────────────────────────────────────────────────────
function SendIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

// ─── Colour badge label ───────────────────────────────────────────────────────
function colorLabel(inputType: InputType, colorValue: number): string {
  if (inputType === "task_deadline") {
    if (colorValue >= 24) return "≥24h · Low urgency";
    if (colorValue >= 12) return "12h · Moderate urgency";
    if (colorValue >= 2) return "<12h · High urgency";
    return "<2h · Critical";
  }
  if (inputType === "number") {
    const last2 = Math.abs(Math.round(colorValue)) % 100;
    return `Last 2 digits: ${String(last2).padStart(2, "0")}`;
  }
  if (colorValue >= 60) return "Very happy 😄";
  if (colorValue >= 20) return "Happy 🙂";
  if (colorValue > -20) return "Neutral 😐";
  if (colorValue > -60) return "Sad 😞";
  return "Very sad 😢";
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Home() {
  // Auth state
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Chat state
  const [leader, setLeader] = useState<Leader | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const firstRender = useRef(true);

  // Restore session
  useEffect(() => {
    const saved = sessionStorage.getItem("ps_email");
    const savedLeader = sessionStorage.getItem("ps_leader");
    if (saved) {
      setEmail(saved);
      setAuthed(true);
      if (savedLeader) setLeader(JSON.parse(savedLeader));
    }
  }, []);

  // Fetch a random leader once authed
  useEffect(() => {
    if (!authed || leader) return;
    fetch("/api/chat")
      .then((r) => r.json())
      .then((d) => {
        setLeader(d.leader);
        sessionStorage.setItem("ps_leader", JSON.stringify(d.leader));
      })
      .catch(() => showToast("Could not load leader config"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  // Scroll to bottom
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  }

  // ── Auth submit ──────────────────────────────────────────────────────────
  function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setEmailError("");
    const trimmed = email.trim().toLowerCase();

    if (!trimmed) {
      setEmailError("Email is required.");
      return;
    }
    if (!trimmed.endsWith("@petasight.com")) {
      setEmailError("Access restricted to @petasight.com addresses.");
      return;
    }

    setAuthLoading(true);
    // Simulate brief validation delay for UX
    setTimeout(() => {
      sessionStorage.setItem("ps_email", trimmed);
      setAuthed(true);
      setAuthLoading(false);
    }, 600);
  }

  function handleSignOut() {
    sessionStorage.clear();
    setAuthed(false);
    setLeader(null);
    setMessages([]);
    setEmail("");
  }

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading || !leader) return;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        text: text.trim(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text.trim(), leaderId: leader.id }),
        });

        if (!res.ok) {
          const err = await res.json();
          showToast(err.error ?? "Something went wrong.");
          setLoading(false);
          return;
        }

        const data = await res.json();
        const inputType: InputType = data.inputType ?? "general";
        const colorValue: number = data.colorValue ?? 0;
        const bgColor = resolveColor(inputType, colorValue);
        const textColor = accessibleTextColor(bgColor);

        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: data.response,
          nativeText: data.response,
          translation: data.translation,
          inputType,
          colorValue,
          toneLabel: data.toneLabel,
          bgColor,
          textColor,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        showToast("Network error. Please try again.");
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    },
    [leader, loading]
  );

  // Auto-resize textarea
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  // ── Render: Auth ─────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <>
        <a href="#chat-input" className="skip-link">
          Skip to chat
        </a>
        <main className="auth-screen">
          <div
            className="auth-card"
            role="main"
            aria-labelledby="auth-heading"
          >
            <h1 className="auth-logo" id="auth-heading">
              Peta<span>sight</span>
            </h1>
            <p className="auth-subtitle">
              Chromatic Chat — a tone-aware, multilingual assistant.
              <br />
              Access restricted to Petasight team members.
            </p>

            <form onSubmit={handleAuth} noValidate>
              <div className="field-group">
                <label htmlFor="email" className="field-label">
                  Work Email
                </label>
                <input
                  id="email"
                  type="email"
                  className={`field-input${emailError ? " error" : ""}`}
                  placeholder="you@petasight.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError("");
                  }}
                  autoComplete="email"
                  aria-describedby={emailError ? "email-error" : undefined}
                  aria-invalid={!!emailError}
                  required
                />
                {emailError && (
                  <p id="email-error" className="field-error" role="alert">
                    {emailError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={authLoading}
                aria-busy={authLoading}
              >
                {authLoading ? "Verifying…" : "Enter Chat"}
              </button>
            </form>
          </div>
        </main>
      </>
    );
  }

  // ── Render: Chat ──────────────────────────────────────────────────────────
  return (
    <>
      <a href="#chat-input" className="skip-link">
        Skip to message input
      </a>

      <div className="chat-screen" role="main">
        {/* Header */}
        <header className="chat-header">
          <h1 className="chat-header-brand" aria-label="Petasight Chromatic Chat">
            Peta<span>sight</span>
          </h1>

          {leader && (
            <div
              className="chat-header-leader"
              aria-label={`Speaking as ${leader.flag} ${leader.name}`}
            >
              <span aria-hidden="true">{leader.flag}</span>
              <span>{leader.name}</span>
            </div>
          )}

          <button
            className="chat-header-sign-out"
            onClick={handleSignOut}
            aria-label="Sign out"
          >
            Sign out
          </button>
        </header>

        {/* Messages */}
        <section
          className="messages-area"
          aria-label="Chat messages"
          aria-live="polite"
          aria-atomic="false"
          aria-relevant="additions"
        >
          {messages.length === 0 && !loading && (
            <>
              <div style={{ color: "var(--text-muted)", fontSize: "0.875rem", textAlign: "center", marginTop: "2rem" }}>
                Try one of these, or type your own:
              </div>
              <div className="hint-bar" role="list" aria-label="Example inputs">
                {HINTS.map((h) => (
                  <button
                    key={h}
                    className="hint-chip"
                    role="listitem"
                    onClick={() => sendMessage(h)}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`msg-row ${msg.role}`}
              role="listitem"
            >
              {msg.role === "user" ? (
                <div
                  className="msg-bubble user"
                  aria-label={`You: ${msg.text}`}
                >
                  {msg.text}
                </div>
              ) : (
                <div
                  className="msg-bubble assistant"
                  style={{
                    background: msg.bgColor,
                    color: msg.textColor,
                    border: `1px solid ${msg.bgColor}`,
                  }}
                  aria-label={`${leader?.name ?? "Assistant"}: ${msg.translation}`}
                >
                  {/* Colour mode badge */}
                  {msg.inputType && msg.colorValue !== undefined && (
                    <div
                      className="color-tag"
                      style={{
                        background: "rgba(0,0,0,0.25)",
                        color: msg.textColor,
                        border: `1px solid rgba(255,255,255,0.15)`,
                      }}
                      aria-label={`Mode: ${msg.inputType.replace("_", " ")} — ${colorLabel(msg.inputType, msg.colorValue)}`}
                    >
                      <span aria-hidden="true">⬤</span>
                      <span>{colorLabel(msg.inputType, msg.colorValue)}</span>
                    </div>
                  )}

                  <p className="native-text">{msg.nativeText}</p>

                  {msg.translation && (
                    <p
                      className="translation-text"
                      aria-label={`English translation: ${msg.translation}`}
                    >
                      {msg.translation}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="msg-row assistant" aria-live="polite" aria-label="Assistant is typing">
              <div className="typing-bubble" role="status">
                <div className="typing-dot" aria-hidden="true" />
                <div className="typing-dot" aria-hidden="true" />
                <div className="typing-dot" aria-hidden="true" />
                <span className="sr-only">Assistant is typing…</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} aria-hidden="true" />
        </section>

        {/* Input */}
        <div className="input-area" role="complementary" aria-label="Message input">
          <div className="input-row">
            <label htmlFor="chat-input" className="sr-only">
              Type a message
            </label>
            <textarea
              id="chat-input"
              ref={inputRef}
              className="chat-input"
              placeholder="Type a task with deadline, a number, or anything…"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              rows={1}
              aria-label="Message input"
              aria-multiline="true"
              disabled={loading || !leader}
            />
            <button
              className="send-btn"
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim() || !leader}
              aria-label="Send message"
            >
              <SendIcon />
            </button>
          </div>
          <p className="input-hint" aria-hidden="true">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>

      {/* Screen-reader only utility class */}
      <style>{`.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}`}</style>

      {/* Toast */}
      {toast && (
        <div className="toast" role="alert" aria-live="assertive">
          {toast}
        </div>
      )}
    </>
  );
}
