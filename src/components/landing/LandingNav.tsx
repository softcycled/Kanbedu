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
              <div className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-white/10 overflow-hidden shadow-xl"
                style={{ background: "rgba(28,25,23,0.97)" }}>
                <Link
                  href="/pricing"
                  onClick={() => setOpen(false)}
                  className="flex items-center px-4 py-3 text-sm text-muted hover:text-ink hover:bg-white/[0.04] transition-colors"
                >
                  Pricing
                </Link>
                <div className="h-px bg-white/[0.06] mx-3" />
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex items-center px-4 py-3 text-sm text-muted hover:text-ink hover:bg-white/[0.04] transition-colors"
                >
                  Log in
                </Link>
              </div>
            )}
          </div>

          <Link
            href="/login?mode=signup"
            className="text-sm font-semibold px-4 py-[6px] rounded-full bg-[#EBEBEB] text-[#161412] hover:bg-white transition-colors"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </nav>
  );
}
