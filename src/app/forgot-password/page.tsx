"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="force-light min-h-screen flex items-center justify-center px-4 bg-paper">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold tracking-tight"><a href="/landing" className="text-ink no-underline">kanbedu</a></h1>
          <p className="text-sm mt-1 text-muted">
            {sent ? "Check your email" : "Reset your password"}
          </p>
        </div>

        <div className="rounded-2xl p-6 bg-card-bg border border-border shadow-card">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto bg-green-500/10">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-green-600" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 10l4 4 8-8" />
                </svg>
              </div>
              <p className="text-sm text-muted">
                If an account exists for <strong className="text-ink">{email}</strong>, you'll receive a reset link shortly. Check your spam folder if it doesn't arrive.
              </p>
              <a
                href="/login"
                className="block w-full py-2.5 text-sm font-medium rounded-xl text-center transition-colors bg-primary text-on-primary hover:bg-primary/90"
              >
                Back to sign in
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-muted">
                Enter your email and we'll send you a link to reset your password.
              </p>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-muted">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoFocus
                  required
                  className="w-full px-3 py-2.5 text-sm rounded-xl outline-none transition-colors bg-column-bg text-ink border border-transparent focus:border-border"
                />
              </div>

              {error && (
                <div className="text-xs font-medium px-3 py-2 rounded-lg bg-red-500/10 text-red-500">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-on-primary hover:bg-primary/90"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>

              <div className="text-center">
                <a href="/login" className="text-xs transition-colors text-muted hover:text-ink">
                  Back to sign in
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
