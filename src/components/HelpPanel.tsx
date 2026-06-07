"use client";

import { useState } from "react";

type Tab = "support" | "changelog";

// Add entries here when ready for launch
const CHANGELOG: { date: string; title: string; description: string }[] = [];

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
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-base font-semibold text-ink">Support & Feedback</h2>
        <p className="text-sm text-muted mt-0.5">Found a bug or have a suggestion? Let us know.</p>
      </div>
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
      <div className="mb-8">
        <h2 className="text-base font-semibold text-ink">Changelog</h2>
        <p className="text-sm text-muted mt-0.5">New updates and improvements to Kanbedu.</p>
      </div>

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
        <div className="relative pl-6 border-l-2 border-border space-y-10">
          {CHANGELOG.map((entry, i) => (
            <div key={i} className="relative">
              <div className="absolute -left-[calc(0.75rem+1px)] top-1.5 w-3 h-3 rounded-full bg-ink border-2 border-paper" />
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-1">{entry.date}</p>
              <p className="text-sm font-semibold text-ink mb-1">{entry.title}</p>
              <p className="text-sm text-muted leading-relaxed">{entry.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HelpPanel() {
  const [tab, setTab] = useState<Tab>("support");

  const tabs: { id: Tab; label: string }[] = [
    { id: "support", label: "Support & Feedback" },
    { id: "changelog", label: "Changelog" },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-border px-6 flex items-end gap-1" style={{ height: 82 }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-ink text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-8 no-scrollbar">
        {tab === "support" ? <SupportTab /> : <ChangelogTab />}
      </div>
    </div>
  );
}
