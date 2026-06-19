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
    return <p className="text-sm text-green-600">Email sent. Check your inbox.</p>;
  }

  return (
    <button
      onClick={handleResend}
      disabled={state === "sending"}
      className="text-sm text-muted underline underline-offset-2 disabled:opacity-50 transition-opacity"
    >
      {state === "sending" ? "Sending…" : state === "error" ? "Failed. Try again" : "Resend verification email"}
    </button>
  );
}
