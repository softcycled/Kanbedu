"use client";

import { useState, useEffect } from "react";

export default function EmailVerificationBanner() {
  const [show, setShow] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    // Check once on mount — avoid re-fetching on every render
    const dismissed = sessionStorage.getItem("kanbedu-verify-dismissed");
    if (dismissed) return;

    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data && data.emailVerified === false) setShow(true);
      })
      .catch(() => {});
  }, []);

  // Hide when URL param ?verified=1 appears (redirect from verify page)
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("verified=1")) {
      setShow(false);
    }
  }, []);

  const resend = async () => {
    setSending(true);
    try {
      await fetch("/api/auth/resend-verification", { method: "POST" });
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  const dismiss = () => {
    sessionStorage.setItem("kanbedu-verify-dismissed", "1");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs font-medium bg-amber-50 border-b border-amber-200 text-amber-900 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-200">
      <span>
        Please verify your email to secure your account.{" "}
        {sent ? (
          <span className="text-green-700 dark:text-green-400">Verification email sent!</span>
        ) : (
          <button
            onClick={resend}
            disabled={sending}
            className="underline underline-offset-2 disabled:opacity-60 hover:opacity-80 transition-opacity"
          >
            {sending ? "Sending…" : "Resend email"}
          </button>
        )}
      </span>
      <button onClick={dismiss} aria-label="Dismiss" className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M2 2l10 10M12 2L2 12" />
        </svg>
      </button>
    </div>
  );
}
