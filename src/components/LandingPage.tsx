"use client";

import { useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import EducatorSteps from "./landing/EducatorSteps";

const DemoBoard = dynamic(() => import("./landing/DemoBoard"), { ssr: false, loading: () => <DemoBoardSkeleton /> });

function DemoBoardSkeleton() {
  return (
    <div className="flex gap-3" style={{ minWidth: 420 }}>
      {["To Do", "In Progress", "Done"].map((label) => (
        <div
          key={label}
          className="flex-1 rounded-xl p-3"
          style={{ background: "rgb(35 32 30)", border: "1px solid rgba(70,67,63,0.5)", minHeight: 180 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-border" />
            <span className="text-xs text-muted">{label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Pillar icons ──────────────────────────────────────────────────────────────

function IconBoards() {
  return (
    <svg width="92" height="92" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="14" width="14" height="36" rx="1.5" />
      <rect x="25" y="14" width="14" height="36" rx="1.5" />
      <rect x="42" y="14" width="14" height="36" rx="1.5" />
      <line x1="11" y1="22" x2="19" y2="22" />
      <line x1="11" y1="28" x2="19" y2="28" />
      <line x1="28" y1="22" x2="36" y2="22" />
      <line x1="28" y1="28" x2="36" y2="28" />
      <line x1="28" y1="34" x2="36" y2="34" />
      <line x1="45" y1="22" x2="53" y2="22" />
    </svg>
  );
}

function IconSync() {
  return (
    <svg width="92" height="92" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 30 A18 18 0 0 1 46 20" />
      <polyline points="38,14 46,20 40,26" />
      <path d="M50 34 A18 18 0 0 1 18 44" />
      <polyline points="26,50 18,44 24,38" />
    </svg>
  );
}

function IconLink() {
  return (
    <svg width="92" height="92" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M28 24 H22 a8 8 0 0 0 0 16 H28" />
      <path d="M36 24 H42 a8 8 0 0 1 0 16 H36" />
      <line x1="24" y1="32" x2="40" y2="32" />
    </svg>
  );
}

const PILLAR_GLOWS = [
  "rgba(124,58,237,0.10)",
  "rgba(59,130,246,0.10)",
  "rgba(16,185,129,0.09)",
];

function PillarIconFrame({ children, index = 0 }: { children: React.ReactNode; index?: number }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-white/[0.07] aspect-square flex items-center justify-center"
      style={{ background: "#131110" }}
    >
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(ellipse 60% 50% at 50% 50%, ${PILLAR_GLOWS[index % 3]}, transparent 70%)` }}
      />
      <div className="relative text-white/40">{children}</div>
    </div>
  );
}

const PILLARS = [
  {
    fig: "FIG 0.1",
    title: "Boards built for clarity",
    description: "Visual columns that match how you actually think about work. No setup, no learning curve.",
    Icon: IconBoards,
  },
  {
    fig: "FIG 0.2",
    title: "Synced in real time",
    description: "Changes show up instantly for everyone on the board. No refresh, no stale state.",
    Icon: IconSync,
  },
  {
    fig: "FIG 0.3",
    title: "One link to join",
    description: "Share a link, your group joins. No approval flow, no friction.",
    Icon: IconLink,
  },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function LandingPage() {
  useEffect(() => {
    const reveals = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    reveals.forEach((el) => {
      if (el.getBoundingClientRect().top > window.innerHeight * 0.9) {
        el.style.opacity = "0";
        el.style.transform = "translateY(20px)";
        el.style.transition = "opacity 0.7s ease-out, transform 0.7s ease-out";
      }
    });
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            el.style.opacity = "1";
            el.style.transform = "translateY(0)";
          }
        });
      },
      { threshold: 0.05, rootMargin: "0px 0px 300px 0px" }
    );
    reveals.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="dark">
      <div className="min-h-screen font-sans antialiased text-ink bg-paper selection:bg-accent/30 selection:text-white">

        {/* ── Navigation ──────────────────────────────────────────── */}
        <nav
          className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06] backdrop-blur-md"
          style={{ background: "rgba(22,20,18,0.90)" }}
        >
          <div className="max-w-6xl mx-auto px-6 h-[72px] flex items-center justify-between">
            <Link href="/landing" className="text-lg font-semibold tracking-tight text-ink">
              kanbedu
            </Link>
            <div className="flex items-center gap-5">
              <Link href="/login" className="hidden sm:block text-sm text-muted hover:text-ink transition-colors duration-150">
                Log in
              </Link>
              <Link
                href="/login?mode=signup"
                className="text-sm font-medium px-4 pt-[4px] pb-[8px] rounded-full bg-[#EBEBEB] text-[#161412] hover:bg-[#FFFFFF] transition-colors duration-150"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </nav>

        <main>

          {/* ── Hero ────────────────────────────────────────────────── */}
          <section className="pt-48 pb-20 px-6">
            <div className="max-w-5xl mx-auto">

              {/* Headline + sub + CTAs */}
              <div className="text-center mb-16">
                <h1 className="text-5xl sm:text-6xl md:text-[72px] font-bold tracking-[-0.03em] leading-[1.02] text-ink mb-5 motion-safe:animate-fade-in [animation-delay:80ms]">
                  Project boards.
                  <br className="hidden sm:block" />
                  {" "}Without the noise.
                </h1>
                <p className="text-[15px] md:text-[17px] text-muted max-w-md mx-auto leading-relaxed mb-10 motion-safe:animate-fade-in [animation-delay:160ms]">
                  Boards, tasks, and analytics. Built for students and educators.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4 motion-safe:animate-fade-in [animation-delay:240ms]">
                  <Link
                    href="/login?mode=signup"
                    className="w-full sm:w-auto bg-[#EBEBEB] text-[#161412] px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-white transition-colors"
                  >
                    Get started free
                  </Link>
                  <Link
                    href="/login"
                    className="w-full sm:w-auto text-sm text-muted hover:text-ink transition-colors px-6 py-2.5 border border-white/10 rounded-full hover:border-white/20"
                  >
                    Sign in
                  </Link>
                </div>
                <p className="text-xs text-muted/60 motion-safe:animate-fade-in [animation-delay:320ms]">
                  Free for students and teachers. No credit card.
                </p>
              </div>

              {/* Interactive demo board in a browser chrome frame */}
              <div
                className="rounded-2xl overflow-hidden motion-safe:animate-modal-in [animation-delay:300ms]"
                style={{
                  border: "1px solid rgba(255,255,255,0.07)",
                  boxShadow: "0 0 0 1px rgba(255,255,255,0.03), 0 40px 100px rgba(0,0,0,0.6), 0 10px 30px rgba(0,0,0,0.4)",
                }}
              >
                  {/* Board */}
                <div className="p-5" style={{ background: "rgb(22 20 18)" }}>
                  <DemoBoard />
                </div>
              </div>

            </div>
          </section>

          {/* ── Pillars ─────────────────────────────────────────────── */}
          <section
            className="py-36 px-6"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="max-w-6xl mx-auto">
              <div className="mb-20 reveal max-w-4xl">
                <h2 className="text-3xl md:text-[44px] font-bold tracking-[-0.02em] leading-[1.15]">
                  <span className="text-ink">A Kanban tool built for the classroom.</span>{" "}
                  <span className="text-muted">
                    Stripped to the essentials so students and teachers can focus on the work, not on learning the tool.
                  </span>
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-14 reveal">
                {PILLARS.map((pillar, i) => (
                  <div key={pillar.fig}>
                    <p className="text-[10px] font-medium tracking-[0.18em] text-muted/60 mb-5 font-mono uppercase">
                      {pillar.fig}
                    </p>
                    <div className="mb-7">
                      <PillarIconFrame index={i}>
                        <pillar.Icon />
                      </PillarIconFrame>
                    </div>
                    <h3 className="text-sm font-semibold text-ink mb-2 tracking-tight">
                      {pillar.title}
                    </h3>
                    <p className="text-sm text-muted leading-relaxed">
                      {pillar.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Educator section ────────────────────────────────────── */}
          <section
            className="py-40 px-6"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="max-w-6xl mx-auto">
              <div className="mb-14 reveal max-w-4xl">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-4">
                  For educators
                </p>
                <h2 className="text-3xl md:text-[44px] font-bold tracking-[-0.02em] leading-[1.15]">
                  <span className="text-ink">Run group work without losing track.</span>{" "}
                  <span className="text-muted">
                    Class boards, group monitoring, and reusable layouts. Built for how teachers actually run Kanban.
                  </span>
                </h2>
              </div>
              <div className="reveal">
                <EducatorSteps />
              </div>
            </div>
          </section>

          {/* ── Final CTA ───────────────────────────────────────────── */}
          <section
            className="py-44 px-6 reveal"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="text-4xl md:text-[64px] font-bold tracking-[-0.03em] text-ink leading-[1.05] mb-5">
                Make group projects
                <br />feel less like chaos.
              </h2>
              <p className="text-[15px] text-muted mb-10 max-w-sm mx-auto leading-relaxed">
                Free for students and teachers. No credit card. Make your first board in 30 seconds.
              </p>
              <Link
                href="/login?mode=signup"
                className="inline-block bg-[#EBEBEB] text-[#161412] px-7 py-3 rounded-full text-sm font-semibold hover:bg-white transition-colors"
              >
                Sign Up
              </Link>
            </div>
          </section>

        </main>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <footer
          className="py-10 px-6"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "#0f0e0c" }}
        >
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5">
            <span className="text-sm font-semibold text-white/30">kanbedu</span>
            <div className="flex items-center flex-wrap justify-center sm:justify-end gap-x-5 gap-y-2 text-xs text-white/25">
              <Link href="/terms"   className="hover:text-white/45 transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-white/45 transition-colors">Privacy</Link>
              <a href="mailto:support@kanbedu.com" className="hover:text-white/45 transition-colors">Contact</a>
              <Link href="/credits" className="hover:text-white/45 transition-colors">Credits</Link>
              <span>© 2026 Kanbedu</span>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
