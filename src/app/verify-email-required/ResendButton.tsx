"use client";

import { useState } from "react";

export default function ResendButton() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const handleResend = async () => {
    setState("sending");
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  };

  if (state === "sent") {
    return <p className="text-sm" style={{ color: "#16A34A" }}>Email sent — check your inbox.</p>;
  }

  return (
    <button
      onClick={handleResend}
      disabled={state === "sending"}
      className="text-sm underline underline-offset-2 disabled:opacity-50 transition-opacity"
      style={{ color: "#78716C" }}
    >
      {state === "sending" ? "Sending…" : state === "error" ? "Failed — try again" : "Resend verification email"}
    </button>
  );
}
