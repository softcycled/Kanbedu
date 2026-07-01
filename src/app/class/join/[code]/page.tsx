"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ClassJoinContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const code = params.code as string;
  const autoJoin = searchParams.get("auto") === "1";

  const [className, setClassName] = useState("");
  const [term, setTerm] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "verify-email" | "joining" | "done" | "error">("loading");
  const [message, setMessage] = useState("");
  const [classId, setClassId] = useState<string | null>(null);
  const autoFired = useRef(false);

  const handleJoin = async () => {
    setStatus("joining");
    try {
      const res = await fetch(`/api/classes/join/${code}`, { method: "POST" });
      const data = await res.json();
      if (res.status === 401) {
        router.push(`/login?next=/class/join/${encodeURIComponent(code)}`);
        return;
      }
      if (res.status === 403 && data.code === "EMAIL_NOT_VERIFIED") {
        setStatus("verify-email");
        return;
      }
      if (res.status === 429) {
        setMessage("Too many requests. Wait a moment and try again.");
        setStatus("error");
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

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`/api/classes/join/${code}`);
        const data = await res.json();
        if (res.status === 429) {
          setMessage("Too many requests. Wait a moment and refresh the page.");
          setStatus("error");
          return;
        }
        if (!res.ok) {
          setMessage(data.error || "Invalid class code.");
          setStatus("error");
          return;
        }
        setClassName(data.name);
        setTerm(data.term ?? null);
        if (autoJoin && !autoFired.current) {
          autoFired.current = true;
          // Trigger join automatically — user just verified their email
          setStatus("joining");
          const joinRes = await fetch(`/api/classes/join/${code}`, { method: "POST" });
          const joinData = await joinRes.json();
          if (joinRes.ok) {
            setMessage(joinData.message);
            setClassId(joinData.classId);
            setStatus("done");
            setTimeout(() => router.push(`/class/${joinData.classId}`), 600);
          } else if (joinRes.status === 403 && joinData.code === "EMAIL_NOT_VERIFIED") {
            setStatus("verify-email");
          } else {
            setMessage(joinData.error || "Failed to join.");
            setStatus("error");
          }
        } else {
          setStatus("ready");
        }
      } catch {
        setMessage("Network error. Please try again.");
        setStatus("error");
      }
    };
    check();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <div className="force-light min-h-screen flex items-center justify-center px-4 bg-paper">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold tracking-tight"><a href="/landing" className="text-ink no-underline">kanbedu</a></h1>
          <p className="text-sm mt-1 text-muted">Class invitation</p>
        </div>

        <div className="rounded-2xl p-6 text-center bg-card-bg border border-border shadow-card">
          {status === "loading" && <p className="text-sm text-muted">Checking invite…</p>}

          {status === "ready" && (
            <>
              <p className="text-sm mb-1 text-muted">You have been invited to join</p>
              <p className="text-lg font-bold text-ink">{className}</p>
              {term && <p className="text-xs mb-5 text-muted">{term}</p>}
              <button
                onClick={handleJoin}
                className="w-full mt-4 py-2.5 text-sm font-medium rounded-xl transition-colors bg-primary text-on-primary hover:bg-primary/90"
              >
                Join class
              </button>
            </>
          )}

          {status === "joining" && <p className="text-sm text-muted">Joining…</p>}

          {status === "done" && <p className="text-sm font-medium text-ink">{message}</p>}

          {status === "verify-email" && (
            <>
              <p className="text-sm font-medium mb-1 text-ink">Check your inbox</p>
              <p className="text-xs mb-5 text-muted">
                Please verify your email to join <strong>{className || "this class"}</strong>.
                We sent you a verification link when you signed up.
              </p>
              <a
                href="/check-email"
                className="block w-full py-2.5 text-sm font-medium rounded-xl text-center transition-colors bg-primary text-on-primary hover:bg-primary/90"
              >
                Resend verification email
              </a>
            </>
          )}

          {status === "error" && (
            <>
              <p className="text-sm font-medium mb-5 text-red-500">{message}</p>
              <button
                onClick={() => router.push(classId ? `/class/${classId}` : "/")}
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

export default function ClassJoinPage() {
  return (
    <Suspense fallback={<div className="force-light min-h-screen flex items-center justify-center bg-paper text-ink">Loading…</div>}>
      <ClassJoinContent />
    </Suspense>
  );
}
