"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [boardName, setBoardName] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "joining" | "done" | "error">("loading");
  const [message, setMessage] = useState("");

  // Check invite validity on mount
  useEffect(() => {
    const checkInvite = async () => {
      try {
        const res = await fetch(`/api/invites/${token}`);
        const data = await res.json();
        if (!res.ok) {
          setMessage(data.error || "Invalid invite.");
          setStatus("error");
          return;
        }
        setBoardName(data.boardName);
        setStatus("ready");
      } catch {
        setMessage("Network error. Please try again.");
        setStatus("error");
      }
    };
    checkInvite();
  }, [token]);

  const handleJoin = async () => {
    setStatus("joining");
    try {
      const res = await fetch(`/api/invites/${token}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Failed to join.");
        setStatus("error");
        return;
      }
      setMessage(data.message);
      setStatus("done");
      // Redirect to board after short delay
      setTimeout(() => router.push("/"), 1500);
    } catch {
      setMessage("Network error. Please try again.");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#F7F5F0" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold tracking-tight">
            <a href="/landing" style={{ color: "#1C1917", textDecoration: "none" }}>kanbedu</a>
          </h1>
          <p className="text-sm mt-1" style={{ color: "#78716C" }}>
            Board invitation
          </p>
        </div>

        <div
          className="rounded-2xl p-6 text-center"
          style={{
            backgroundColor: "#FDFCFA",
            border: "1px solid #E2DED8",
            boxShadow: "0 2px 8px rgba(26,24,20,0.06), 0 1px 3px rgba(26,24,20,0.04)",
          }}
        >
          {status === "loading" && (
            <p className="text-sm" style={{ color: "#78716C" }}>Checking invite...</p>
          )}

          {status === "ready" && (
            <>
              <p className="text-sm mb-1" style={{ color: "#78716C" }}>
                You have been invited to join
              </p>
              <p className="text-lg font-bold mb-6" style={{ color: "#1C1917" }}>
                {boardName}
              </p>
              <button
                onClick={handleJoin}
                className="w-full py-2.5 text-sm font-medium rounded-xl transition-colors"
                style={{ backgroundColor: "#1C1917", color: "#F7F5F0" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1C1917CC")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#1C1917")}
              >
                Join board
              </button>
            </>
          )}

          {status === "joining" && (
            <p className="text-sm" style={{ color: "#78716C" }}>Joining...</p>
          )}

          {status === "done" && (
            <p className="text-sm font-medium" style={{ color: "#1C1917" }}>{message}</p>
          )}

          {status === "error" && (
            <>
              <p className="text-sm font-medium mb-5" style={{ color: "#E8613A" }}>{message}</p>
              <button
                onClick={() => router.push("/")}
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
