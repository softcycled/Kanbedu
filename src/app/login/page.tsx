"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function LoginContent() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">("login");

  useEffect(() => {
    if (searchParams.get("mode") === "signup") setMode("signup");
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
    if (mode === "signup") { body.name = name; body.handle = handle; }

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

      window.location.href = "/";
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
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#F7F5F0" }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold tracking-tight">
            <a href="/landing" style={{ color: "#1C1917", textDecoration: "none" }}>kanbedu</a>
          </h1>
          <p className="text-sm mt-1" style={{ color: "#78716C" }}>
            {mode === "login" ? "Sign in to your account" : "Create a new account"}
          </p>
        </div>

        {/* Form card */}
        <div
          className="rounded-2xl p-6"
          style={{
            backgroundColor: "#FDFCFA",
            border: "1px solid #E2DED8",
            boxShadow: "0 2px 8px rgba(26,24,20,0.06), 0 1px 3px rgba(26,24,20,0.04)",
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <label
                    className="block text-xs font-semibold uppercase tracking-widest mb-2"
                    style={{ color: "#78716C" }}
                  >
                    Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                    className="w-full px-3 py-2.5 text-sm rounded-xl outline-none transition-colors"
                    style={{
                      backgroundColor: "#EFEDE8",
                      color: "#1C1917",
                      border: "1px solid transparent",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#E2DED8")}
                    onBlur={(e) => (e.target.style.borderColor = "transparent")}
                  />
                </div>
                <div>
                  <label
                    className="block text-xs font-semibold uppercase tracking-widest mb-2"
                    style={{ color: "#78716C" }}
                  >
                    Username
                  </label>
                  <div className="relative">
                    <span
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium select-none"
                      style={{ color: "#78716C" }}
                    >
                      @
                    </span>
                    <input
                      type="text"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      placeholder="yourhandle"
                      autoComplete="off"
                      maxLength={30}
                      className="w-full pl-7 pr-3 py-2.5 text-sm rounded-xl outline-none transition-colors"
                      style={{
                        backgroundColor: "#EFEDE8",
                        color: "#1C1917",
                        border: "1px solid transparent",
                      }}
                      onFocus={(e) => (e.target.style.borderColor = "#E2DED8")}
                      onBlur={(e) => (e.target.style.borderColor = "transparent")}
                    />
                  </div>
                  {handle && (
                    <p className="text-xs mt-1.5" style={{
                      color: handleStatus === "available" ? "#22C55E"
                        : handleStatus === "taken" || handleStatus === "invalid" ? "#E8613A"
                        : "#78716C"
                    }}>
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
              <label
                className="block text-xs font-semibold uppercase tracking-widest mb-2"
                style={{ color: "#78716C" }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full px-3 py-2.5 text-sm rounded-xl outline-none transition-colors"
                style={{
                  backgroundColor: "#EFEDE8",
                  color: "#1C1917",
                  border: "1px solid transparent",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#E2DED8")}
                onBlur={(e) => (e.target.style.borderColor = "transparent")}
              />
            </div>

            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-widest mb-2"
                style={{ color: "#78716C" }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "Min 8 characters" : "Your password"}
                required
                minLength={mode === "signup" ? 8 : undefined}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="w-full px-3 py-2.5 text-sm rounded-xl outline-none transition-colors"
                style={{
                  backgroundColor: "#EFEDE8",
                  color: "#1C1917",
                  border: "1px solid transparent",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#E2DED8")}
                onBlur={(e) => (e.target.style.borderColor = "transparent")}
              />
            </div>

            {mode === "login" && (
              <div className="text-center -mt-1">
                <a href="/forgot-password" className="text-xs transition-colors" style={{ color: "#78716C" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#1C1917")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#78716C")}
                >
                  Forgot password?
                </a>
              </div>
            )}

            {error && (
              <div
                className="text-xs font-medium px-3 py-2 rounded-lg"
                style={{ backgroundColor: "#FDF0EB", color: "#E8613A" }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: "#1C1917",
                color: "#F7F5F0",
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "#1C1917CC"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#1C1917"; }}
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                ? "Sign in"
                : "Create account"}
            </button>

            {mode === "signup" && (
              <p className="text-center text-[11px] leading-relaxed" style={{ color: "#78716C" }}>
                By creating an account, you agree to the{" "}
                <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "#1C1917", textDecoration: "underline", textUnderlineOffset: "2px" }}>
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#1C1917", textDecoration: "underline", textUnderlineOffset: "2px" }}>
                  Privacy Policy
                </a>.
              </p>
            )}
          </form>
        </div>

        {/* Toggle mode */}
        <div className="text-center mt-5">
          <button
            onClick={toggleMode}
            className="text-xs transition-colors"
            style={{ color: "#78716C" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#1C1917")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#78716C")}
          >
            {mode === "login"
              ? "Don't have an account? Create one"
              : "Already have an account? Sign in"}
          </button>
        </div>

        {/* Legal footer */}
        <div className="flex items-center justify-center gap-4 mt-8 flex-wrap">
          <a href="/terms" className="text-[11px] transition-colors" style={{ color: "#78716C" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#1C1917")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#78716C")}
          >
            Terms of Service
          </a>
          <span style={{ color: "#78716C" }} className="text-[11px]">·</span>
          <a href="/privacy" className="text-[11px] transition-colors" style={{ color: "#78716C" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#1C1917")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#78716C")}
          >
            Privacy Policy
          </a>
          <span style={{ color: "#78716C" }} className="text-[11px]">·</span>
          <a href="mailto:support@kanbedu.com" className="text-[11px] transition-colors" style={{ color: "#78716C" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#1C1917")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#78716C")}
          >
            Contact
          </a>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#F7F5F0]">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
