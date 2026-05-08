"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";

// ── Icons ─────────────────────────────────────────────────────

const Icons = {
  Sun: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  ),
  Moon: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  ),
  Kanban: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="4" height="18" />
      <rect x="10" y="3" width="4" height="12" />
      <rect x="17" y="3" width="4" height="15" />
    </svg>
  ),
  User: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
    </svg>
  ),
  Chart: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="12" width="4" height="8" />
      <rect x="10" y="6" width="4" height="14" />
      <rect x="17" y="9" width="4" height="11" />
    </svg>
  ),
  Link: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 14l-2 2a3 3 0 004 0l2-2m-4-4l2-2a3 3 0 014 0l2 2" />
    </svg>
  ),
};

// ── Components ────────────────────────────────────────────────

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // Animation state for hero mockup
  const [animStep, setAnimStep] = useState(0);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Hero board animation loop
  useEffect(() => {
    const timings = [2000, 2000, 2000, 2000, 3000, 1000]; // ms per step
    const timer = setTimeout(() => {
      setAnimStep((prev) => (prev + 1) % 6);
    }, timings[animStep]);
    return () => clearTimeout(timer);
  }, [animStep]);

  // Intersection Observer for fade-in animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("opacity-100", "translate-y-0");
            entry.target.classList.remove("opacity-0", "translate-y-4");
          }
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollToFeatures = () => {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="bg-paper min-h-screen font-sans selection:bg-accent selection:text-white">
      
      {/* ── Section 1: Navigation Bar ──────────────────────────── */}
      <nav className={`sticky top-0 z-50 w-full border-b transition-all duration-300 ${
        isScrolled ? "bg-paper/80 backdrop-blur-md border-border py-3" : "bg-transparent border-transparent py-5"
      }`}>
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <Link href="/landing" className="text-xl font-bold text-ink tracking-tight">
            kanbedu
          </Link>
          <div className="flex items-center gap-4 md:gap-6">
            {mounted && (
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2 rounded-xl text-muted hover:text-ink hover:bg-column-bg transition-all"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Icons.Sun /> : <Icons.Moon />}
              </button>
            )}
            <Link href="/login" className="text-sm font-medium text-muted hover:text-ink transition-colors">
              Sign in
            </Link>
            <Link href="/login" className="bg-ink text-paper px-5 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-sm">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* ── Section 2: Hero ───────────────────────────────────── */}
        <section className="text-center pt-24 pb-16 px-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-ink leading-[1.1] animate-fade-in">
              Track your group projects <br />
              <span className="text-accent">without the noise.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted mt-6 max-w-xl mx-auto leading-relaxed animate-fade-in [animation-delay:100ms]">
              The free, minimal Kanban board built for students. <br className="hidden md:block" />
              No bloat. No learning curve. Just cards.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10 animate-fade-in [animation-delay:200ms]">
              <Link href="/login" className="w-full sm:w-auto bg-ink text-paper px-8 py-3.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity shadow-md">
                Get Started
              </Link>
              <button 
                onClick={scrollToFeatures}
                className="w-full sm:w-auto border border-border text-ink px-8 py-3.5 rounded-xl text-sm font-medium hover:bg-column-bg transition-colors"
              >
                See How It Works
              </button>
            </div>

            {/* Animated Board Preview Mockup */}
            <div className="mt-20 max-w-4xl mx-auto rounded-2xl border border-border shadow-modal overflow-hidden bg-column-bg p-4 md:p-6 animate-modal-in [animation-delay:300ms]">
              <div className="flex gap-3 md:gap-4 h-[300px] md:h-[400px] overflow-x-auto no-scrollbar pb-2">
                {/* To Do Column */}
                <div className="flex-1 min-w-[140px] bg-column-bg/50 rounded-xl flex flex-col gap-3 p-2 border border-border/30">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted px-1">To Do</span>
                  <div className="relative flex-1 flex flex-col gap-3">
                    <MockCard 
                      title="Draft proposal outline" 
                      priority="medium" 
                      time="2d" 
                      tag={{ name: "RESEARCH", color: "#E8854A" }}
                    />
                    <MockCard 
                      title="Research competitor analysis" 
                      priority="high" 
                      time="4h"
                      isVisible={animStep === 0 || animStep === 5}
                      exitDir="bottom"
                    />
                  </div>
                </div>

                {/* In Progress Column */}
                <div className="flex-1 min-w-[140px] bg-column-bg/50 rounded-xl flex flex-col gap-3 p-2 border border-border/30">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted px-1">In Progress</span>
                  <div className="relative flex-1 flex flex-col gap-3">
                    <MockCard 
                      title="Design wireframes" 
                      priority="urgent" 
                      time="1d"
                      isVisible={animStep < 4 || animStep === 5}
                      tag={animStep >= 2 && animStep < 5 ? { name: "DESIGN", color: "#7B68EE" } : undefined}
                      exitDir="right"
                    />
                    <MockCard 
                      title="Research competitor analysis" 
                      priority="high" 
                      time="4h"
                      isVisible={animStep >= 1 && animStep < 5}
                      enterDir="top"
                      assignee={animStep >= 3 && animStep < 5 ? { letter: "A", color: "#4A90A4" } : undefined}
                    />
                  </div>
                </div>

                {/* Done Column */}
                <div className="flex-1 min-w-[140px] bg-column-bg/50 rounded-xl flex flex-col gap-3 p-2 border border-border/30 flex">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted px-1">Done</span>
                  <div className="relative flex-1 flex flex-col gap-3">
                    <MockCard 
                      title="Set up project repo" 
                      priority="low" 
                      time="3d" 
                    />
                    <MockCard 
                      title="Design wireframes" 
                      priority="urgent" 
                      time="1d"
                      isVisible={animStep >= 4 && animStep < 5}
                      enterDir="left"
                      isComplete={animStep === 4}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 3: Problem Statement ─────────────────────── */}
        <section className="py-24 px-6 text-center reveal opacity-0 translate-y-4 transition-all duration-700 ease-out">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-semibold text-ink">
              We&apos;ve all been there.
            </h2>
            <div className="text-base md:text-lg text-muted mt-8 max-w-lg mx-auto leading-relaxed space-y-4">
              <p>Someone says &quot;I&apos;ll do this part&quot; in the group chat.</p>
              <p>Nobody writes it down. Deadlines pass. Work overlaps.</p>
              <p className="font-medium text-ink">Half the team doesn&apos;t know what the other half is doing.</p>
            </div>
          </div>
        </section>

        {/* ── Section 4: Feature Strip ──────────────────────────── */}
        <section id="features" className="py-24 px-6 bg-column-bg/30">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-semibold text-ink text-center reveal opacity-0 translate-y-4 transition-all duration-700 ease-out">
              Everything you need. Nothing you don&apos;t.
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
              <FeatureCard 
                icon={<Icons.Kanban />} 
                title="Drag & Drop Boards" 
                description="Organize tasks into columns that make sense for your project. Drag to reprioritize." 
                delay="0ms"
              />
              <FeatureCard 
                icon={<Icons.User />} 
                title="Assign & Track" 
                description="Know exactly who is doing what. No more 'I thought you were handling that.'" 
                delay="100ms"
              />
              <FeatureCard 
                icon={<Icons.Chart />} 
                title="Built-in Analytics" 
                description="See where your project stands at a glance. Workflow overview, cycle times, team breakdown." 
                delay="200ms"
              />
              <FeatureCard 
                icon={<Icons.Link />} 
                title="One-click Invites" 
                description="Share a link. Your team joins the board. That's it. No emails, no approvals." 
                delay="300ms"
              />
            </div>
          </div>
        </section>

        {/* ── Section 5: CTA Banner ─────────────────────────────── */}
        <section className="py-32 px-6 text-center reveal opacity-0 translate-y-4 transition-all duration-700 ease-out">
          <h2 className="text-3xl md:text-4xl font-bold text-ink">
            Ready to stop losing track?
          </h2>
          <p className="text-lg text-muted mt-4">
            Free forever. No credit card. No catch.
          </p>
          <Link href="/login" className="inline-block bg-ink text-paper px-10 py-4 rounded-xl text-base font-semibold hover:opacity-90 transition-opacity mt-10 shadow-lg">
            Get Started Free
          </Link>
        </section>
      </main>

      {/* ── Section 6: Footer ─────────────────────────────────── */}
      <footer className="border-t border-border py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-8">
          <div className="text-center sm:text-left">
            <span className="text-sm font-bold text-ink block mb-1">kanbedu</span>
            <span className="text-xs text-muted">Built for students, by students.</span>
          </div>
          <div className="flex items-center text-xs text-muted">
            <Link href="https://github.com/softcycled/Kanbedu" target="_blank" className="hover:text-ink transition-colors">
              GitHub
            </Link>
            <span className="mx-3">·</span>
            <Link href="#" className="hover:text-ink transition-colors">
              Terms
            </Link>
            <span className="mx-3">·</span>
            <span>2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────

interface MockCardProps {
  title: string;
  priority: "low" | "medium" | "high" | "urgent";
  time: string;
  tag?: { name: string; color: string };
  assignee?: { letter: string; color: string };
  isVisible?: boolean;
  enterDir?: "top" | "left" | "right" | "bottom";
  exitDir?: "top" | "left" | "right" | "bottom";
  isComplete?: boolean;
}

function MockCard({ 
  title, 
  priority, 
  time, 
  tag, 
  assignee, 
  isVisible = true, 
  enterDir = "bottom",
  exitDir = "bottom",
  isComplete = false
}: MockCardProps) {
  const dotColor = {
    low: "bg-blue-400",
    medium: "bg-yellow-400",
    high: "bg-orange-400",
    urgent: "bg-red-500"
  }[priority];

  const getTransform = () => {
    if (isVisible) return "translate-x-0 translate-y-0 scale-100";
    
    // Position when hidden
    const dir = isVisible ? enterDir : exitDir;
    switch(dir) {
      case "top": return "-translate-y-8 scale-95";
      case "bottom": return "translate-y-8 scale-95";
      case "left": return "-translate-x-8 scale-95";
      case "right": return "translate-x-8 scale-95";
      default: return "translate-y-4 scale-95";
    }
  };

  return (
    <div 
      className={`bg-card-bg rounded-xl p-3 shadow-card border transition-all duration-500 ease-smooth-out ${
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none absolute w-full"
      } ${isComplete ? "ring-2 ring-done-dot/50 border-done-dot/50" : "border-border/50"} ${getTransform()}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[11px] font-medium text-ink leading-tight">{title}</p>
        {isComplete && (
          <div className="text-done-dot flex-shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 mr-auto">
          <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
          <span className="text-[8px] font-mono text-muted uppercase tracking-wider">{priority}</span>
        </div>

        {tag && (
          <span 
            className="px-1.5 py-0.5 rounded text-[8px] font-bold text-white transition-all duration-500 animate-fade-in"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
          </span>
        )}

        {assignee && (
          <div 
            className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white transition-all duration-500 animate-fade-in"
            style={{ backgroundColor: assignee.color }}
          >
            {assignee.letter}
          </div>
        )}

        <span className="text-[8px] text-muted font-medium">{time}</span>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description, delay }: { icon: React.ReactNode, title: string, description: string, delay: string }) {
  return (
    <div 
      className="bg-card-bg rounded-2xl p-8 border border-border shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 reveal opacity-0 translate-y-4"
      style={{ transitionDelay: delay }}
    >
      <div className="text-accent mb-6 w-10 h-10 flex items-center justify-center bg-accent/5 rounded-xl">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-ink mb-3">{title}</h3>
      <p className="text-sm text-muted leading-relaxed">{description}</p>
    </div>
  );
}
