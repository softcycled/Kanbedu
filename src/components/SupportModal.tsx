"use client";

import { useState } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function SupportModal({ isOpen, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus("idle");

    try {
      // Basic browser/env info
      const browserInfo = `UA: ${navigator.userAgent} | Lang: ${navigator.language} | Screen: ${window.innerWidth}x${window.innerHeight}`;

      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, browserInfo }),
      });

      if (!res.ok) {
        let errorMessage = "Submission failed";
        try {
          const data = await res.json();
          errorMessage = data.error || errorMessage;
        } catch {
          errorMessage = `Server Error (${res.status})`;
        }
        throw new Error(errorMessage);
      }

      setStatus("success");
      setTimeout(() => {
        onClose();
        setTitle("");
        setDescription("");
        setStatus("idle");
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm motion-safe:animate-fade-in">
      <div className="bg-card-bg w-full max-w-lg rounded-2xl border border-border shadow-modal overflow-hidden">
        
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink">Support & Feedback</h2>
            <p className="text-sm text-muted">Found a bug? Tell us about it.</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-muted hover:text-ink hover:bg-border/50 rounded-lg transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {status === "success" ? (
            <div className="py-8 text-center space-y-4 motion-safe:animate-scale-in">
              <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-ink">Report Sent!</h3>
                <p className="text-sm text-muted">Thanks for helping us improve Kanbedu.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-muted">Subject</label>
                <input
                  required
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Brief summary of the issue..."
                  className="w-full bg-column-bg/50 border border-border/50 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 transition-all"
                />
              </div>

              <div className="space-y-2">
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
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 motion-safe:animate-shake">
                  <svg className="text-red-500 flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
                  </svg>
                  <p className="text-xs text-red-600 font-medium">{errorMessage}</p>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-ink text-paper py-3 rounded-xl font-bold hover:bg-ink/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="motion-safe:animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                      Sending...
                    </>
                  ) : (
                    "Submit Report"
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
