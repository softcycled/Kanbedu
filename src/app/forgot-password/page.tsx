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
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#F7F5F0" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold tracking-tight"><a href="/landing" style={{ color: "#1C1917", textDecoration: "none" }}>kanbedu</a></h1>
          <p className="text-sm mt-1" style={{ color: "#78716C" }}>
            {sent ? "Check your email" : "Reset your password"}
          </p>
        </div>

        <div className="rounded-2xl p-6" style={{ backgroundColor: "#FDFCFA", border: "1px solid #E2DED8", boxShadow: "0 2px 8px rgba(26,24,20,0.06), 0 1px 3px rgba(26,24,20,0.04)" }}>
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: "#ECFDF5" }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 10l4 4 8-8" />
                </svg>
              </div>
              <p className="text-sm" style={{ color: "#78716C" }}>
                If an account exists for <strong style={{ color: "#1C1917" }}>{email}</strong>, you'll receive a reset link shortly. Check your spam folder if it doesn't arrive.
              </p>
              <a
                href="/login"
                className="block w-full py-2.5 text-sm font-medium rounded-xl text-center transition-colors"
                style={{ backgroundColor: "#1C1917", color: "#F7F5F0" }}
              >
                Back to sign in
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm" style={{ color: "#78716C" }}>
                Enter your email and we'll send you a link to reset your password.
              </p>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#78716C" }}>
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
                  className="w-full px-3 py-2.5 text-sm rounded-xl outline-none transition-colors"
                  style={{ backgroundColor: "#EFEDE8", color: "#1C1917", border: "1px solid transparent" }}
                  onFocus={(e) => (e.target.style.borderColor = "#E2DED8")}
                  onBlur={(e) => (e.target.style.borderColor = "transparent")}
                />
              </div>

              {error && (
                <div className="text-xs font-medium px-3 py-2 rounded-lg" style={{ backgroundColor: "#FDF0EB", color: "#E8613A" }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: "#1C1917", color: "#F7F5F0" }}
                onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "#1C1917CC"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#1C1917"; }}
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>

              <div className="text-center">
                <a href="/login" className="text-xs transition-colors" style={{ color: "#78716C" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#1C1917")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#78716C")}
                >
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
