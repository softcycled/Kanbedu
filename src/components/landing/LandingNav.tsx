"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";

// Shared marketing top nav, used by the landing and pricing pages.
export default function LandingNav() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <nav
      className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06] backdrop-blur-md"
      style={{ background: "rgba(22,20,18,0.90)" }}
    >
      <div className="max-w-6xl mx-auto px-6 h-[72px] flex items-center justify-between">
        <Link href="/landing" className="text-lg font-bold tracking-tight text-ink">
          kanbedu
        </Link>

        <div className="flex items-center gap-5">
          {/* Desktop nav links */}
          <Link href="/pricing" className="hidden sm:block text-sm text-muted hover:text-ink transition-colors duration-150">
            Pricing
          </Link>
          <div className="hidden sm:block w-0.5 h-4 bg-white/20" />
          <Link href="/login" className="hidden sm:block text-sm text-muted hover:text-ink transition-colors duration-150">
            Log in
          </Link>

          <Link
            href="/login?mode=signup"
            className="text-sm font-semibold px-4 py-[6px] rounded-full bg-[#EBEBEB] text-[#161412] hover:bg-white transition-colors"
          >
            Sign Up
          </Link>

          {/* Mobile hamburger */}
          <div className="relative sm:hidden" ref={ref}>
            <button
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
              className="flex flex-col justify-center items-center w-8 h-8 gap-[5px] text-muted hover:text-ink transition-colors"
            >
              <span className={`block w-5 h-[1.5px] bg-current transition-all duration-200 origin-center ${open ? "rotate-45 translate-y-[6.5px]" : ""}`} />
              <span className={`block w-5 h-[1.5px] bg-current transition-all duration-200 ${open ? "opacity-0" : ""}`} />
              <span className={`block w-5 h-[1.5px] bg-current transition-all duration-200 origin-center ${open ? "-rotate-45 -translate-y-[6.5px]" : ""}`} />
            </button>

            {open && (
              <div
                className="fixed inset-x-0 bottom-0 flex flex-col px-6 py-10 gap-2"
                style={{ top: 72, background: "rgba(22,20,18,0.97)" }}
              >
                <Link
                  href="/pricing"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between px-5 py-4 rounded-2xl text-lg font-medium text-ink hover:bg-white/[0.06] transition-colors border border-white/[0.06]"
                >
                  Pricing
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between px-5 py-4 rounded-2xl text-lg font-medium text-ink hover:bg-white/[0.06] transition-colors border border-white/[0.06]"
                >
                  Log in
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
