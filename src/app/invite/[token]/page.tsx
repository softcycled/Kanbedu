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
        if (res.status === 401) {
          router.push(`/login?next=/invite/${token}`);
          return;
        }
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
    <div className="min-h-screen flex items-center justify-center px-4 bg-paper">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold tracking-tight">
            <a href="/landing" className="text-ink no-underline">kanbedu</a>
          </h1>
          <p className="text-sm mt-1 text-muted">
            Board invitation
          </p>
        </div>

        <div className="rounded-2xl p-6 text-center bg-card-bg border border-border shadow-card">
          {status === "loading" && (
            <p className="text-sm text-muted">Checking invite...</p>
          )}

          {status === "ready" && (
            <>
              <p className="text-sm mb-1 text-muted">
                You have been invited to join
              </p>
              <p className="text-lg font-bold mb-6 text-ink">
                {boardName}
              </p>
              <button
                onClick={handleJoin}
                className="w-full py-2.5 text-sm font-medium rounded-xl transition-colors bg-primary text-on-primary hover:bg-primary/90"
              >
                Join board
              </button>
            </>
          )}

          {status === "joining" && (
            <p className="text-sm text-muted">Joining...</p>
          )}

          {status === "done" && (
            <p className="text-sm font-medium text-ink">{message}</p>
          )}

          {status === "error" && (
            <>
              <p className="text-sm font-medium mb-5 text-red-500">{message}</p>
              <button
                onClick={() => router.push("/")}
                className="w-full py-2.5 text-sm font-medium rounded-xl transition-colors bg-primary text-on-primary hover:bg-primary/90"
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
