"use client";

import { useState } from "react";
import Link from "next/link";
import LandingNav from "./landing/LandingNav";
import LandingFooter from "./landing/LandingFooter";

// Strawman tier content pending Jorge's final pricing/feature decisions. Edit
// the features and price labels here; the page layout reads entirely from this.
const FREE_FEATURES = [
  "Unlimited boards",
  "Real-time sync",
  "Class boards and groups",
  "Monitor, Integrity, and Participation panels",
  "50MB attachments per board",
];

const PRO_FEATURES = [
  "Everything in Free",
  "Larger attachment quota",
  "Higher group and student caps per class",
  "Analytics export",
  "Priority support",
];

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "pricing" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Something went wrong. Please try again.");
        return;
      }
      setStatus("done");
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  };

  if (status === "done") {
    return (
      <p className="text-sm text-ink/90 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-center">
        You are on the list. We will email you when Lecturer Pro opens.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus("idle"); }}
          placeholder="you@school.edu"
          className="flex-1 min-w-0 bg-white/[0.04] border border-white/10 rounded-full px-4 py-2.5 text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:border-white/25 transition-colors"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="flex-shrink-0 bg-[#EBEBEB] text-[#161412] px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-white transition-colors disabled:opacity-60"
        >
          {status === "loading" ? "Joining..." : "Join the waitlist"}
        </button>
      </div>
      {status === "error" && <p className="text-xs text-red-400 px-1">{message}</p>}
    </form>
  );
}

export default function PricingPage() {
  return (
    <div className="dark">
      <div className="min-h-screen font-sans antialiased text-ink bg-paper selection:bg-accent/30 selection:text-white">
        <LandingNav />

        <main>
          {/* ── Hero ──────────────────────────────────────────────── */}
          <section className="pt-44 pb-16 px-6">
            <div className="max-w-2xl mx-auto text-center">
              <h1 className="text-4xl sm:text-5xl md:text-[60px] font-bold tracking-[-0.03em] leading-[1.04] text-ink mb-5 motion-safe:animate-fade-in">
                Free for the classroom.
                <br />
                More for lecturers who need it.
              </h1>
              <p className="text-[15px] md:text-[17px] text-muted max-w-md mx-auto leading-relaxed motion-safe:animate-fade-in [animation-delay:120ms]">
                Kanbedu stays free for students and teachers. Lecturer Pro adds room to scale for larger cohorts.
              </p>
            </div>
          </section>

          {/* ── Tiers ─────────────────────────────────────────────── */}
          <section className="pb-32 px-6">
            <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-5 items-start motion-safe:animate-fade-in [animation-delay:200ms]">

              {/* Free */}
              <div className="rounded-2xl border border-white/[0.08] p-7 bg-white/[0.02]">
                <p className="text-sm font-semibold text-ink">Free</p>
                <p className="text-xs text-muted mt-1">For students and educators</p>
                <div className="mt-5 mb-6">
                  <span className="text-4xl font-bold tracking-tight text-ink">Free</span>
                  <span className="text-sm text-muted ml-1.5">forever</span>
                </div>
                <Link
                  href="/login?mode=signup"
                  className="block w-full text-center text-sm font-semibold px-5 py-2.5 rounded-full border border-white/15 text-ink hover:border-white/30 hover:bg-white/[0.04] transition-colors"
                >
                  Get started
                </Link>
                <ul className="mt-7 space-y-3">
                  {FREE_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-muted">
                      <span className="text-muted/70"><Check /></span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Lecturer Pro (highlighted via border + glow, no pill) */}
              <div className="relative rounded-2xl border border-white/20 p-7 overflow-hidden">
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: "radial-gradient(ellipse 70% 55% at 50% 0%, rgba(124,58,237,0.12), transparent 70%)" }}
                />
                <div className="relative">
                  <p className="text-sm font-semibold text-ink">Lecturer Pro</p>
                  <p className="text-xs text-muted mt-1">Early access via the waitlist</p>
                  <div className="mt-5 mb-6">
                    <span className="text-4xl font-bold tracking-tight text-ink">Coming soon</span>
                  </div>
                  <WaitlistForm />
                  <ul className="mt-7 space-y-3">
                    {PRO_FEATURES.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-muted">
                        <span className="text-ink/80"><Check /></span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

            </div>

            <p className="text-center text-xs text-muted/60 mt-10 max-w-md mx-auto">
              Questions about Lecturer Pro? Email{" "}
              <a href="mailto:support@kanbedu.com" className="underline hover:text-muted transition-colors">support@kanbedu.com</a>.
            </p>
          </section>
        </main>

        <LandingFooter />
      </div>
    </div>
  );
}
