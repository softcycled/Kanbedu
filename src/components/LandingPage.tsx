"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

// ── Placeholder frame ─────────────────────────────────────────────────────────

const GLOW_COLORS = [
  "rgba(59,130,246,0.08)",
  "rgba(124,58,237,0.08)",
  "rgba(16,185,129,0.07)",
  "rgba(245,158,11,0.07)",
  "rgba(236,72,153,0.07)",
  "rgba(20,184,166,0.07)",
];

function PlaceholderFrame({
  label,
  caption,
  aspect = "video",
  index = 0,
  className = "",
}: {
  label: string;
  caption?: string;
  aspect?: "video" | "square" | "tall";
  index?: number;
  className?: string;
}) {
  const aspectClass =
    aspect === "video"
      ? "aspect-video"
      : aspect === "square"
      ? "aspect-square"
      : "aspect-[3/4]";

  const glow = GLOW_COLORS[index % GLOW_COLORS.length];

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-white/[0.07] ${aspectClass} ${className}`}
      style={{ background: "#131110" }}
    >
      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.045) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      {/* Radial accent tint */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 70% 55% at 50% 35%, ${glow}, transparent 70%)`,
        }}
      />
      {/* Corner marks */}
      <div className="absolute top-4 left-4 w-5 h-5 border-t border-l border-white/[0.12]" />
      <div className="absolute top-4 right-4 w-5 h-5 border-t border-r border-white/[0.12]" />
      <div className="absolute bottom-11 left-4 w-5 h-5 border-b border-l border-white/[0.12]" />
      <div className="absolute bottom-11 right-4 w-5 h-5 border-b border-r border-white/[0.12]" />
      {/* Label bar */}
      <div
        className="absolute bottom-0 inset-x-0 px-4 py-2.5 border-t border-white/[0.06] flex items-center gap-2.5"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse flex-shrink-0" />
        <span className="text-[11px] text-white/30 font-medium tracking-wide leading-none">
          {label}
        </span>
        {caption && (
          <span className="text-[10px] text-white/15 ml-auto font-medium tracking-wider uppercase">
            {caption}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Capability grid cell ──────────────────────────────────────────────────────

function CapabilityCell({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      className="p-7 transition-colors duration-200 hover:bg-white/[0.025] group"
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <h3 className="text-sm font-semibold text-ink mb-2 leading-snug">{title}</h3>
      <p className="text-xs text-muted leading-relaxed">{description}</p>
    </div>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────

const CAPABILITIES = [
  {
    title: "Kanban Boards",
    description:
      "Visual columns that map to your workflow. Drag tasks to reprioritize in real time.",
  },
  {
    title: "Task Assignment",
    description:
      "Every card has a clear owner. No ambiguity about who handles what.",
  },
  {
    title: "Real-time Sync",
    description:
      "Changes propagate instantly to all board members. No refreshing, no stale state.",
  },
  {
    title: "One-link Invites",
    description:
      "Share a link. Your team joins the board. No approval flow required.",
  },
  {
    title: "Activity History",
    description:
      "Full audit trail on every task. Know exactly who changed what and when.",
  },
  {
    title: "Priority Labels",
    description:
      "Mark urgency with color labels. Filter for what actually needs attention now.",
  },
  {
    title: "Due Dates",
    description:
      "Attach deadlines to tasks and see them in a shared calendar view.",
  },
  {
    title: "Team Analytics",
    description:
      "Cycle time breakdowns, contribution views, and workflow summaries.",
  },
  {
    title: "Dark Mode",
    description:
      "Thoughtfully designed dark theme. Easy on the eyes during late-night work sessions.",
  },
];

const WORKFLOW_ITEMS = [
  {
    index: "01",
    category: "Boards",
    headline: "Visual boards that match\nhow your team thinks.",
    body: "Drag cards between columns as work progresses. Every status visible at a glance — no status meetings required.",
    bullets: [
      "Drag-and-drop task management",
      "Priority levels and color labels",
      "Assignee tracking per card",
      "Board-level activity feed",
    ],
    screenshot: "/screenshots/board.png",
    screenshotAlt: "Kanbedu board view with task cards organized across workflow columns",
    flip: false,
  },
  {
    index: "02",
    category: "Task detail",
    headline: "Every task has the\nfull context it needs.",
    body: "Open any task to see its description, comments, activity history, due date, and assignee — all in one focused view.",
    bullets: [
      "Inline comments and discussion",
      "Full activity history per task",
      "Due dates and deadline tracking",
      "Rich description with markdown",
    ],
    screenshot: "/screenshots/task-modal.png",
    screenshotAlt: "Task detail modal showing description, assignee, priority, deadline, and comments",
    flip: true,
  },
  {
    index: "03",
    category: "Analytics",
    headline: "Real-time analytics surface\nblockers and bottlenecks.",
    body: "Built-in analytics surfaces blockers and bottlenecks so you can keep work flowing without manual check-ins or status updates.",
    bullets: [
      "Cycle time breakdowns",
      "Overall workflow efficiency",
      "Individual contribution views",
      "Custom task filtering",
    ],
    screenshot: "/screenshots/analytics.png",
    screenshotAlt: "Analytics panel showing workflow overview, bottleneck detection, and project health metrics",
    flip: false,
  },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function LandingPage() {
  useEffect(() => {
    const reveals = Array.from(
      document.querySelectorAll<HTMLElement>(".reveal")
    );

    // Only hide elements that start below the visible viewport so above-fold
    // content is never invisible on initial load.
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
    // Force dark mode for the landing page regardless of user theme preference
    <div className="dark">
      <div
        className="min-h-screen font-sans antialiased text-ink bg-paper selection:bg-accent/30 selection:text-white"
      >

        {/* ── Navigation ──────────────────────────────────────────────── */}
        <nav
          className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06] backdrop-blur-md"
          style={{ background: "rgba(22,20,18,0.90)" }}
        >
          <div className="max-w-6xl mx-auto px-6 h-[72px] flex items-center justify-between">
            <Link
              href="/landing"
              className="text-lg font-semibold tracking-tight text-ink"
            >
              kanbedu
            </Link>
            <div className="flex items-center gap-5">
              <Link
                href="/login"
                className="hidden sm:block text-sm text-muted hover:text-ink transition-colors duration-150"
              >
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

          {/* ── Hero ──────────────────────────────────────────────────── */}
          <section className="pt-40 pb-24 px-6">
            <div className="max-w-5xl mx-auto text-center">
  
              {/* Headline */}
              <h1 className="text-5xl sm:text-6xl md:text-[72px] font-bold tracking-[-0.03em] leading-[1.02] text-ink mb-5 motion-safe:animate-fade-in [animation-delay:80ms]">
                Built for teams
                <br className="hidden sm:block" />
                {" "}that actually ship.
              </h1>

              {/* Sub */}
              <p className="text-[15px] md:text-[17px] text-muted max-w-[340px] mx-auto leading-relaxed mb-10 motion-safe:animate-fade-in [animation-delay:160ms]">
                Boards, tasks, and real-time collaboration — without the setup overhead.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-20 motion-safe:animate-fade-in [animation-delay:240ms]">
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

              {/* Hero screenshot */}
              <div
                className="relative rounded-2xl overflow-hidden border border-white/[0.07] motion-safe:animate-modal-in [animation-delay:300ms]"
                style={{
                  boxShadow:
                    "0 0 0 1px rgba(255,255,255,0.03), 0 40px 100px rgba(0,0,0,0.6), 0 10px 30px rgba(0,0,0,0.4)",
                }}
              >
                <Image
                  src="/kanbeduhero.png"
                  alt="Kanbedu board view — tasks organized across columns with assignees, priorities, and labels"
                  width={1200}
                  height={750}
                  className="w-full h-auto block"
                  priority
                  unoptimized
                />
              </div>
              {/* Glow under screenshot */}
              <div
                className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-1/2 h-24 rounded-full blur-3xl pointer-events-none"
                style={{ background: "rgba(138, 130, 121, 0)" }}
              />
            </div>
          </section>

          {/* ── Workflow Features ────────────────────────────────────── */}
          <section
            className="py-32 px-6"
            style={{ borderTop: "1px solid rgba(40, 40, 40, 0.05)" }}
          >
            <div className="max-w-6xl mx-auto">
              {/* Header */}
              <div className="mb-24 reveal">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-3">
                  How it works
                </p>
                <h2 className="text-3xl md:text-[42px] font-bold tracking-[-0.025em] text-ink leading-[1.07]">
                  Everything your team
                  <br />needs in one workspace.
                </h2>
              </div>

              {/* Feature rows */}
              <div className="space-y-32">
                {WORKFLOW_ITEMS.map((item) => (
                  <div
                    key={item.index}
                    className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center reveal"
                  >
                    {/* Text */}
                    <div className={item.flip ? "order-last lg:order-last" : ""}>
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-3">
                        {item.index} — {item.category}
                      </p>
                      <h3 className="text-[22px] font-bold text-ink mb-4 tracking-tight leading-snug whitespace-pre-line">
                        {item.headline}
                      </h3>
                      <p className="text-sm text-muted leading-relaxed mb-8 max-w-sm">
                        {item.body}
                      </p>
                      <ul className="space-y-2.5">
                        {item.bullets.map((b) => (
                          <li key={b} className="flex items-center gap-2.5 text-sm text-muted">
                            <span className="w-[3px] h-[3px] rounded-full bg-accent/60 flex-shrink-0" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Frame */}
                    <div className={item.flip ? "order-first lg:order-first" : ""}>
                      <div
                        className="relative rounded-xl overflow-hidden border border-white/[0.07]"
                        style={{
                          boxShadow:
                            "0 0 0 1px rgba(255,255,255,0.03), 0 20px 60px rgba(0,0,0,0.5)",
                        }}
                      >
                        <Image
                          src={item.screenshot}
                          alt={item.screenshotAlt}
                          width={1280}
                          height={800}
                          className="w-full h-auto block"
                          unoptimized
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Capabilities ─────────────────────────────────────────── */}
          <section
            className="py-28 px-6"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="max-w-6xl mx-auto">
              <div className="mb-16 reveal">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-3">
                  Capabilities
                </p>
                <h2 className="text-3xl md:text-[42px] font-bold tracking-[-0.025em] text-ink">
                  Everything you need.
                  <br />Nothing you don&apos;t.
                </h2>
              </div>

              <div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 reveal"
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  borderLeft: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {CAPABILITIES.map((cap) => (
                  <CapabilityCell key={cap.title} {...cap} />
                ))}
              </div>
            </div>
          </section>

          {/* ── Coming soon previews ──────────────────────────────────── */}
          <section
            className="py-28 px-6"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="max-w-6xl mx-auto">
              <div className="text-center max-w-lg mx-auto mb-16 reveal">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-3">
                  In development
                </p>
                <h2 className="text-3xl font-bold tracking-tight text-ink mb-4">
                  More views on the way.
                </h2>
                <p className="text-sm text-muted leading-relaxed">
                  Analytics, calendar views, and educator workspace features are actively being developed.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 reveal">
                <PlaceholderFrame
                  label="Task analytics dashboard"
                  caption="Coming soon"
                  aspect="square"
                  index={4}
                />
                <PlaceholderFrame
                  label="Educator workspace overview"
                  caption="Coming soon"
                  aspect="square"
                  index={5}
                />
                <PlaceholderFrame
                  label="Mobile experience preview"
                  caption="Coming soon"
                  aspect="square"
                  index={0}
                />
              </div>
            </div>
          </section>

          {/* ── Final CTA ────────────────────────────────────────────── */}
          <section
            className="py-36 px-6 reveal"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="text-4xl md:text-[64px] font-bold tracking-[-0.03em] text-ink leading-[1.05] mb-5">
                Built for the work
                <br />that matters.
              </h2>
              <p className="text-[15px] text-muted mb-10 max-w-xs mx-auto leading-relaxed">
                Free to use. No credit card. Start coordinating your team today.
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

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <footer
          className="py-10 px-6"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.05)",
            background: "#0f0e0c",
          }}
        >
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5">
            <span className="text-sm font-semibold text-white/30">kanbedu</span>
            <div className="flex items-center flex-wrap justify-center sm:justify-end gap-x-5 gap-y-2 text-xs text-white/25">
              <Link href="/terms" className="hover:text-white/45 transition-colors">
                Terms
              </Link>
              <Link href="/privacy" className="hover:text-white/45 transition-colors">
                Privacy
              </Link>
              <a
                href="mailto:support@kanbedu.com"
                className="hover:text-white/45 transition-colors"
              >
                Contact
              </a>
              <Link href="/credits" className="hover:text-white/45 transition-colors">
                Credits
              </Link>
              <span>© 2026 Kanbedu</span>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
