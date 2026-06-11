"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function ClassJoinPage() {
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;

  const [className, setClassName] = useState("");
  const [term, setTerm] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "joining" | "done" | "error">("loading");
  const [message, setMessage] = useState("");
  const [classId, setClassId] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`/api/classes/join/${code}`);
        const data = await res.json();
        if (!res.ok) {
          setMessage(data.error || "Invalid class code.");
          setStatus("error");
          return;
        }
        setClassName(data.name);
        setTerm(data.term ?? null);
        setStatus("ready");
      } catch {
        setMessage("Network error. Please try again.");
        setStatus("error");
      }
    };
    check();
  }, [code]);

  const handleJoin = async () => {
    setStatus("joining");
    try {
      const res = await fetch(`/api/classes/join/${code}`, { method: "POST" });
      const data = await res.json();
      if (res.status === 401) {
        router.push(`/login?next=/class/join/${encodeURIComponent(code)}`);
        return;
      }
      if (!res.ok) {
        setMessage(data.error || "Failed to join.");
        setStatus("error");
        return;
      }
      setMessage(data.message);
      setClassId(data.classId);
      setStatus("done");
      setTimeout(() => router.push(`/class/${data.classId}`), 1200);
    } catch {
      setMessage("Network error. Please try again.");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#F7F5F0" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold tracking-tight"><a href="/landing" style={{ color: "#1C1917", textDecoration: "none" }}>kanbedu</a></h1>
          <p className="text-sm mt-1" style={{ color: "#78716C" }}>Class invitation</p>
        </div>

        <div
          className="rounded-2xl p-6 text-center"
          style={{ backgroundColor: "#FDFCFA", border: "1px solid #E2DED8", boxShadow: "0 2px 8px rgba(26,24,20,0.06), 0 1px 3px rgba(26,24,20,0.04)" }}
        >
          {status === "loading" && <p className="text-sm" style={{ color: "#78716C" }}>Checking invite…</p>}

          {status === "ready" && (
            <>
              <p className="text-sm mb-1" style={{ color: "#78716C" }}>You have been invited to join</p>
              <p className="text-lg font-bold" style={{ color: "#1C1917" }}>{className}</p>
              {term && <p className="text-xs mb-5" style={{ color: "#78716C" }}>{term}</p>}
              <button
                onClick={handleJoin}
                className="w-full mt-4 py-2.5 text-sm font-medium rounded-xl transition-colors"
                style={{ backgroundColor: "#1C1917", color: "#F7F5F0" }}
              >
                Join class
              </button>
            </>
          )}

          {status === "joining" && <p className="text-sm" style={{ color: "#78716C" }}>Joining…</p>}

          {status === "done" && <p className="text-sm font-medium" style={{ color: "#1C1917" }}>{message}</p>}

          {status === "error" && (
            <>
              <p className="text-sm font-medium mb-5" style={{ color: "#E8613A" }}>{message}</p>
              <button
                onClick={() => router.push(classId ? `/class/${classId}` : "/")}
                className="w-full py-2.5 text-sm font-medium rounded-xl transition-colors"
                style={{ backgroundColor: "#1C1917", color: "#F7F5F0" }}
              >
                Go to dashboard
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
