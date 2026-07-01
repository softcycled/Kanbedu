"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";

// Only allow same-origin relative paths as a post-auth destination, to prevent
// open-redirect abuse via the ?next= param.
function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  return raw;
}

function LoginContent() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const next = safeNext(searchParams.get("next"));

  useEffect(() => {
    if (searchParams.get("mode") === "signup") setMode("signup");
    const nextParam = safeNext(searchParams.get("next"));
    if (nextParam?.startsWith("/class/join/")) setMode("signup");
    const errorParam = searchParams.get("error");
    if (errorParam) {
      if (errorParam === "auth_failed") setError("Authentication failed.");
    }
  }, [searchParams]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [handleStatus, setHandleStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (mode !== "signup" || !handle) { setHandleStatus("idle"); return; }
    setHandleStatus("checking");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/handle-check?handle=${encodeURIComponent(handle)}`);
        const data = await res.json();
        setHandleStatus(data.error ? "invalid" : data.available ? "available" : "taken");
      } catch { setHandleStatus("idle"); }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [handle, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (mode === "signup") {
      if (!handle) { setError("Please choose a username."); return; }
      if (handleStatus !== "available") { setError("Please choose a valid, available username."); return; }
    }

    setLoading(true);

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
    const body: Record<string, string> = { email, password };
    if (mode === "signup") { body.name = name; body.handle = handle; if (next) body.next = next; }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setLoading(false);
        return;
      }

      if (mode === "signup") {
        // Pre-verified (invited via CSV): skip the check-email screen entirely.
        // Otherwise, send them to verify unless there's a ?next= destination waiting.
        const alreadyVerified = !!data.emailVerified;
        window.location.href = alreadyVerified || next ? (next || "/") : `/check-email?email=${encodeURIComponent(email)}`;
      } else {
        window.location.href = next || "/";
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === "login" ? "signup" : "login"));
    setError("");
    setHandle("");
    setHandleStatus("idle");
  };

  return (
    <div className="force-light min-h-screen flex items-center justify-center px-4 bg-paper">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold tracking-tight">
            <a href="/landing" className="text-ink no-underline">kanbedu</a>
          </h1>
          <p className="text-sm mt-1 text-muted">
            {mode === "login" ? "Sign in to your account" : "Create a new account"}
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl p-6 bg-card-bg border border-border shadow-card">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <label htmlFor="signup-name" className="block text-xs font-semibold uppercase tracking-widest mb-2 text-muted">
                    Name
                  </label>
                  <input
                    id="signup-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                    className="w-full px-3 py-2.5 text-sm rounded-xl outline-none transition-colors bg-column-bg text-ink border border-transparent focus:border-ink/30"
                  />
                </div>
                <div>
                  <label htmlFor="signup-handle" className="block text-xs font-semibold uppercase tracking-widest mb-2 text-muted">
                    Username
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium select-none text-muted">
                      @
                    </span>
                    <input
                      id="signup-handle"
                      type="text"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      placeholder="yourhandle"
                      autoComplete="off"
                      maxLength={30}
                      className="w-full pl-7 pr-3 py-2.5 text-sm rounded-xl outline-none transition-colors bg-column-bg text-ink border border-transparent focus:border-ink/30"
                    />
                  </div>
                  {handle && (
                    <p className={`text-xs mt-1.5 ${
                      handleStatus === "available" ? "text-green-600"
                        : handleStatus === "taken" || handleStatus === "invalid" ? "text-red-500"
                        : "text-muted"
                    }`}>
                      {handleStatus === "available" ? `@${handle} is available`
                        : handleStatus === "taken" ? "That username is already taken"
                        : handleStatus === "invalid" ? "2–30 chars, lowercase letters, numbers, underscores only"
                        : "Checking..."}
                    </p>
                  )}
                </div>
              </>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-xs font-semibold uppercase tracking-widest mb-2 text-muted">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                autoFocus={mode === "login"}
                className="w-full px-3 py-2.5 text-sm rounded-xl outline-none transition-colors bg-column-bg text-ink border border-transparent focus:border-ink/30"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="auth-password" className="block text-xs font-semibold uppercase tracking-widest text-muted">
                  Password
                </label>
                {mode === "login" && (
                  <a href="/forgot-password" className="text-xs transition-colors text-muted hover:text-ink">
                    Forgot password?
                  </a>
                )}
              </div>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "Min 8 characters" : "Your password"}
                required
                minLength={mode === "signup" ? 8 : undefined}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="w-full px-3 py-2.5 text-sm rounded-xl outline-none transition-colors bg-column-bg text-ink border border-transparent focus:border-ink/30"
              />
            </div>

            {error && (
              <div role="alert" className="text-xs font-medium px-3 py-2 rounded-lg bg-red-500/10 text-red-500">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-on-primary hover:bg-primary/90"
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                ? "Sign in"
                : "Create account"}
            </button>

            {mode === "signup" && (
              <p className="text-center text-[11px] leading-relaxed text-muted">
                By creating an account, you agree to the{" "}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-2">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-2">
                  Privacy Policy
                </a>.
              </p>
            )}
          </form>
        </div>

        {/* Toggle mode */}
        <div className="text-center mt-5">
          <button onClick={toggleMode} className="text-xs transition-colors text-muted hover:text-ink">
            {mode === "login"
              ? "Don't have an account? Create one"
              : "Already have an account? Sign in"}
          </button>
        </div>

        {/* Legal footer */}
        <div className="flex items-center justify-center gap-4 mt-8 flex-wrap">
          <a href="/terms" className="text-[11px] transition-colors text-muted hover:text-ink">
            Terms of Service
          </a>
          <span className="text-[11px] text-muted">·</span>
          <a href="/privacy" className="text-[11px] transition-colors text-muted hover:text-ink">
            Privacy Policy
          </a>
          <span className="text-[11px] text-muted">·</span>
          <a href="mailto:support@kanbedu.com" className="text-[11px] transition-colors text-muted hover:text-ink">
            Contact
          </a>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="force-light min-h-screen flex items-center justify-center bg-paper text-ink">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
