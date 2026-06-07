"use client";

import { useState } from "react";

type Tab = "support" | "changelog";

// Add entries here when ready for launch
const CHANGELOG: { date: string; title: string; description: string }[] = [
  {
    date: "Jun 1, 2026",
    title: "Educator Tools",
    description: "Classes, groups, monitor, and integrity panel are now live. Educators can create classes, assign students to groups, and track progress in real time.",
  },
];

function IconSupport() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1z" />
      <path d="M5.5 6a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5" />
      <circle cx="8" cy="12" r="0.5" fill="currentColor" />
    </svg>
  );
}

function IconChangelog() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 5v3l2 2" />
    </svg>
  );
}

function SupportTab() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus("idle");
    try {
      const browserInfo = `UA: ${navigator.userAgent} | Lang: ${navigator.language} | Screen: ${window.innerWidth}x${window.innerHeight}`;
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, browserInfo }),
      });
      if (!res.ok) {
        let msg = "Submission failed";
        try { const d = await res.json(); msg = d.error || msg; } catch {}
        throw new Error(msg);
      }
      setStatus("success");
      setTitle("");
      setDescription("");
    } catch (err: unknown) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === "success") {
    return (
      <div className="py-16 text-center space-y-3">
        <div className="w-12 h-12 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-ink">Report sent</p>
          <p className="text-sm text-muted">Thanks for helping us improve Kanbedu.</p>
        </div>
        <button
          onClick={() => setStatus("idle")}
          className="text-sm text-muted hover:text-ink transition-colors underline underline-offset-2"
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-5">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-widest text-muted">Subject</label>
          <input
            required
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Brief summary of the issue…"
            className="w-full bg-column-bg/50 border border-border/50 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 transition-all"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-widest text-muted">Description</label>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What happened? How can we reproduce it? Any extra info helps!"
            rows={5}
            className="w-full bg-column-bg/50 border border-border/50 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 transition-all resize-none"
          />
        </div>
        {status === "error" && (
          <p className="text-xs text-red-500">{errorMessage}</p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-ink text-paper py-2.5 rounded-xl text-sm font-semibold hover:bg-ink/90 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? "Sending…" : "Submit report"}
        </button>
      </form>
    </div>
  );
}

function ChangelogTab() {
  return (
    <div className="max-w-lg">
      {CHANGELOG.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-10 h-10 rounded-full bg-ink/5 flex items-center justify-center mx-auto mb-4">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4l3 3" />
            </svg>
          </div>
          <p className="text-sm font-medium text-ink">No updates yet</p>
          <p className="text-xs text-muted mt-1">Check back after launch.</p>
        </div>
      ) : (
        <div>
          {CHANGELOG.map((entry, i) => (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-ink mt-1 flex-shrink-0" />
                {i < CHANGELOG.length - 1 && (
                  <div className="w-px bg-border flex-1 mt-1.5" />
                )}
              </div>
              <div className={i < CHANGELOG.length - 1 ? "pb-8" : ""}>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-1">{entry.date}</p>
                <p className="text-sm font-semibold text-ink mb-1">{entry.title}</p>
                <p className="text-sm text-muted leading-relaxed">{entry.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const NAV_ITEMS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "support", label: "Support & Feedback", icon: <IconSupport /> },
  { id: "changelog", label: "Changelog", icon: <IconChangelog /> },
];

export default function HelpPanel() {
  const [tab, setTab] = useState<Tab>("support");

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
      <nav className="w-full md:w-52 flex-shrink-0 border-b md:border-b-0 md:border-r border-border h-auto md:h-full overflow-x-auto md:overflow-y-auto py-4 md:py-7 px-3 no-scrollbar flex md:block items-center gap-1">
        <p className="hidden md:block text-[11px] font-semibold uppercase tracking-widest text-muted px-3 mb-3">Help</p>
        <ul className="flex md:block space-y-0 md:space-y-0.5 gap-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => setTab(item.id)}
                className={`whitespace-nowrap md:w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  tab === item.id
                    ? "bg-ink/8 text-ink font-medium"
                    : "text-ink/70 hover:bg-ink/5 hover:text-ink"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex-1 overflow-y-auto px-4 md:px-10 py-6 md:py-8 no-scrollbar">
        {tab === "support" ? <SupportTab /> : <ChangelogTab />}
      </div>
    </div>
  );
}
