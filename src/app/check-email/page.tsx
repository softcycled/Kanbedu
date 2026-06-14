"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const resend = async () => {
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-paper">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold tracking-tight">
            <a href="/landing" className="text-ink no-underline">kanbedu</a>
          </h1>
          <p className="text-sm mt-1 text-muted">Check your inbox</p>
        </div>

        <div className="rounded-2xl p-6 text-center space-y-4 bg-card-bg border border-border shadow-card">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto bg-amber-500/10">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-amber-600 dark:text-amber-500" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="M2 7l10 7 10-7"/>
            </svg>
          </div>

          <div>
            <p className="text-sm font-semibold text-ink">Verify your email to continue</p>
            {email && (
              <p className="text-xs mt-1 text-muted">
                We sent a link to <span className="font-medium text-ink">{email}</span>. Click it to activate your account.
              </p>
            )}
            <p className="text-xs mt-2 text-muted/70">Don't forget to check your spam folder.</p>
          </div>

          <div className="pt-1 border-t border-border">
            {sent ? (
              <p className="text-xs text-green-600 dark:text-green-400">Email resent. Check your inbox.</p>
            ) : error ? (
              <p className="text-xs text-red-500">{error}</p>
            ) : (
              <p className="text-xs text-muted">
                Didn't receive it?{" "}
                <button
                  onClick={resend}
                  disabled={sending}
                  className="text-ink underline underline-offset-2 disabled:opacity-50 transition-opacity hover:opacity-70"
                >
                  {sending ? "Sending…" : "Resend email"}
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense>
      <CheckEmailContent />
    </Suspense>
  );
}
