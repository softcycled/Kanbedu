"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function HandleSetupForm() {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!handle) { setStatus("idle"); return; }
    setStatus("checking");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/handle-check?handle=${encodeURIComponent(handle)}`);
        const data = await res.json();
        setStatus(data.error ? "invalid" : data.available ? "available" : "taken");
      } catch { setStatus("idle"); }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [handle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status !== "available") return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong."); setLoading(false); return; }
      router.push("/");
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  const statusColor = status === "available" ? "#16A34A" : status === "taken" || status === "invalid" ? "#E8613A" : "#78716C";
  const statusText = status === "available" ? `@${handle} is available`
    : status === "taken" ? "That username is already taken"
    : status === "invalid" ? "2–30 chars, lowercase letters, numbers, underscores only"
    : status === "checking" ? "Checking availability..."
    : "2–30 chars, lowercase letters, numbers, underscores";

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#F7F5F0" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold tracking-tight"><a href="/landing" style={{ color: "#1C1917", textDecoration: "none" }}>kanbedu</a></h1>
          <p className="text-sm mt-1" style={{ color: "#78716C" }}>Choose your username</p>
        </div>

        <div className="rounded-2xl p-6" style={{ backgroundColor: "#FDFCFA", border: "1px solid #E2DED8", boxShadow: "0 2px 8px rgba(26,24,20,0.06), 0 1px 3px rgba(26,24,20,0.04)" }}>
          <p className="text-sm mb-5" style={{ color: "#78716C" }}>
            Your username is how others identify you on Kanbedu. You can change it later in your profile.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#78716C" }}>
                Username
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium select-none" style={{ color: "#78716C" }}>@</span>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="yourhandle"
                  autoComplete="off"
                  autoFocus
                  maxLength={30}
                  className="w-full pl-7 pr-3 py-2.5 text-sm rounded-xl outline-none transition-colors"
                  style={{ backgroundColor: "#EFEDE8", color: "#1C1917", border: "1px solid transparent" }}
                  onFocus={(e) => (e.target.style.borderColor = "#E2DED8")}
                  onBlur={(e) => (e.target.style.borderColor = "transparent")}
                />
              </div>
              <p className="text-xs mt-1.5" style={{ color: handle ? statusColor : "#78716C" }}>
                {statusText}
              </p>
            </div>

            {error && (
              <div className="text-xs font-medium px-3 py-2 rounded-lg" style={{ backgroundColor: "#FDF0EB", color: "#E8613A" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || status !== "available"}
              className="w-full py-2.5 text-sm font-medium rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#1C1917", color: "#F7F5F0" }}
              onMouseEnter={(e) => { if (!loading && status === "available") e.currentTarget.style.backgroundColor = "#1C1917CC"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#1C1917"; }}
            >
              {loading ? "Saving..." : "Set handle"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
