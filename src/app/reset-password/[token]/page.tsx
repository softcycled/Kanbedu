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
    <div className="min-h-screen flex items-center justify-center px-4 bg-paper">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold tracking-tight"><a href="/landing" className="text-ink no-underline">kanbedu</a></h1>
          <p className="text-sm mt-1 text-muted">
            {done ? "Password updated" : "Set a new password"}
          </p>
        </div>

        <div className="rounded-2xl p-6 bg-card-bg border border-border shadow-card">
          {done ? (
            <div className="text-center space-y-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto bg-green-500/10">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-green-600 dark:text-green-400" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 10l4 4 8-8" />
                </svg>
              </div>
              <p className="text-sm text-muted">Your password has been updated. You can now sign in.</p>
              <button
                onClick={() => router.push("/login")}
                className="w-full py-2.5 text-sm font-medium rounded-xl transition-colors bg-primary text-on-primary hover:bg-primary/90"
              >
                Go to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-muted">
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
                  className="w-full px-3 py-2.5 text-sm rounded-xl outline-none transition-colors bg-column-bg text-ink border border-transparent focus:border-border"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-muted">
                  Confirm password
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
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
                {loading ? "Updating…" : "Set new password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
