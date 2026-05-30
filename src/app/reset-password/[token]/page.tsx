"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#F7F5F0" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#1C1917" }}>kanbedu</h1>
          <p className="text-sm mt-1" style={{ color: "#78716C" }}>
            {done ? "Password updated" : "Set a new password"}
          </p>
        </div>

        <div className="rounded-2xl p-6" style={{ backgroundColor: "#FDFCFA", border: "1px solid #E2DED8", boxShadow: "0 2px 8px rgba(26,24,20,0.06), 0 1px 3px rgba(26,24,20,0.04)" }}>
          {done ? (
            <div className="text-center space-y-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: "#ECFDF5" }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 10l4 4 8-8" />
                </svg>
              </div>
              <p className="text-sm" style={{ color: "#78716C" }}>Your password has been updated. You can now sign in.</p>
              <button
                onClick={() => router.push("/login")}
                className="w-full py-2.5 text-sm font-medium rounded-xl transition-colors"
                style={{ backgroundColor: "#1C1917", color: "#F7F5F0" }}
              >
                Go to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#78716C" }}>
                  New password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  autoComplete="new-password"
                  autoFocus
                  required
                  className="w-full px-3 py-2.5 text-sm rounded-xl outline-none transition-colors"
                  style={{ backgroundColor: "#EFEDE8", color: "#1C1917", border: "1px solid transparent" }}
                  onFocus={(e) => (e.target.style.borderColor = "#E2DED8")}
                  onBlur={(e) => (e.target.style.borderColor = "transparent")}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#78716C" }}>
                  Confirm password
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
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
                {loading ? "Updating…" : "Set new password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
