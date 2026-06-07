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
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#F7F5F0" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold tracking-tight">
            <a href="/landing" style={{ color: "#1C1917", textDecoration: "none" }}>kanbedu</a>
          </h1>
          <p className="text-sm mt-1" style={{ color: "#78716C" }}>Check your inbox</p>
        </div>

        <div className="rounded-2xl p-6 text-center space-y-4" style={{ backgroundColor: "#FDFCFA", border: "1px solid #E2DED8", boxShadow: "0 2px 8px rgba(26,24,20,0.06), 0 1px 3px rgba(26,24,20,0.04)" }}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: "#FFF8EC" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="M2 7l10 7 10-7"/>
            </svg>
          </div>

          <div>
            <p className="text-sm font-semibold" style={{ color: "#1C1917" }}>Verify your email to continue</p>
            {email && (
              <p className="text-xs mt-1" style={{ color: "#78716C" }}>
                We sent a link to <span className="font-medium" style={{ color: "#1C1917" }}>{email}</span>. Click it to activate your account.
              </p>
            )}
            <p className="text-xs mt-2" style={{ color: "#A8A29E" }}>Don't forget to check your spam folder.</p>
          </div>

          <div className="pt-1 border-t border-[#E2DED8]">
            {sent ? (
              <p className="text-xs" style={{ color: "#16A34A" }}>Email resent — check your inbox.</p>
            ) : error ? (
              <p className="text-xs" style={{ color: "#E8613A" }}>{error}</p>
            ) : (
              <p className="text-xs" style={{ color: "#78716C" }}>
                Didn't receive it?{" "}
                <button
                  onClick={resend}
                  disabled={sending}
                  className="underline underline-offset-2 disabled:opacity-50 transition-opacity hover:opacity-70"
                  style={{ color: "#1C1917" }}
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
