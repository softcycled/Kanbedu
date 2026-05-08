"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">("login");

  useEffect(() => {
    if (searchParams.get("mode") === "signup") setMode("signup");
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
