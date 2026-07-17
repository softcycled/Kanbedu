"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

// Bump the suffix whenever a new announcement should show again to everyone
// who already dismissed an older one -- each key is independent, so old
// dismissals never suppress a future announcement.
const SEEN_KEY = "kanbedu-announcement-seen-semester-break-update";

export default function AnnouncementModal() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      // localStorage unavailable (private browsing etc.) -- just skip the popup
    }
  }, []);

  const dismiss = useCallback(() => {
    try { localStorage.setItem(SEEN_KEY, "1"); } catch {}
    setOpen(false);
  }, []);

  const viewChangelog = useCallback(() => {
    dismiss();
    router.push("/changelog/semester-break-update");
  }, [dismiss, router]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  if (!open) return null;

  return (
    <div
      data-modal-open
      role="dialog"
      aria-modal="true"
      aria-labelledby="announcement-title"
      onClick={dismiss}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-[2px] motion-safe:animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card-bg rounded-2xl shadow-modal w-full max-w-md motion-safe:animate-modal-in overflow-hidden relative"
      >
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 p-1.5 rounded-full bg-black/35 text-white/90 hover:bg-black/55 hover:text-white transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>

        <Image
          src="/screenshots/announcement-analytics.png"
          alt="The redesigned Analytics tab"
          width={1024}
          height={799}
          className="w-full h-auto"
          priority
        />

        <div className="p-6 border-t border-border/60">
          <p className="text-xs font-medium uppercase tracking-widest text-muted mb-2">New update</p>
          <h2 id="announcement-title" className="text-lg font-semibold text-ink">The Semester Break Update</h2>
          <p className="text-sm text-muted mt-2 leading-relaxed">
            Kanbedu got a month of new features: shareable board links, a redesigned Analytics tab, file attachments, a 30-day trash for deleted tasks, and more.
          </p>
          <div className="flex items-center justify-end gap-4 mt-5">
            <button onClick={dismiss} className="text-sm text-muted hover:text-ink transition-colors">
              Maybe later
            </button>
            <button
              onClick={viewChangelog}
              className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              See what&apos;s new
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
