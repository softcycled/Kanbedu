"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">("login");

  useEffect(() => {
    if (searchParams.get("mode") === "signup") setMode("signup");
    const errorParam = searchParams.get("error");
    if (errorParam) {
      if (errorParam === "auth_failed") setError("GitHub authentication failed.");
      if (errorParam === "no_email") setError("Could not get email from GitHub.");
      if (errorParam === "no_code") setError("No authorization code received.");
    }
  }, [searchParams]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
    const body: Record<string, string> = { email, password };
    if (mode === "signup") body.name = name;

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

      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === "login" ? "signup" : "login"));
    setError("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#F7F5F0" }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#1C1917" }}>
            kanbedu
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

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-[#E2DED8]" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#FDFCFA] px-2 text-[#78716C]">or</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => window.location.href = "/api/auth/github"}
              className="w-full py-2.5 text-sm font-medium rounded-xl border border-[#E2DED8] flex items-center justify-center gap-2 hover:bg-[#EFEDE8] transition-colors"
              style={{ color: "#1C1917" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.042-1.416-4.042-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Continue with GitHub
            </button>
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
      </div>
    </div>
  );
}
