"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";

// Shared marketing top nav, used by the landing and pricing pages.
export default function LandingNav() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Lock body scroll while menu is open
    document.body.style.overflow = "hidden";
    function onMouse(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    // Close if viewport grows past mobile breakpoint (e.g. rotation to landscape)
    function onResize() {
      if (window.innerWidth >= 640) setOpen(false);
    }
    document.addEventListener("mousedown", onMouse);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("mousedown", onMouse);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <>
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

            {/* Mobile hamburger — overlay is a sibling of <nav>, not a child,
                so it escapes the backdrop-blur stacking context */}
            <div className="sm:hidden" ref={ref}>
              <button
                onClick={() => setOpen((v) => !v)}
                aria-label="Menu"
                className="flex flex-col justify-center items-center w-8 h-8 gap-[5px] text-muted hover:text-ink transition-colors"
              >
                <span className={`block w-5 h-[1.5px] bg-current transition-all duration-200 origin-center ${open ? "rotate-45 translate-y-[6.5px]" : ""}`} />
                <span className={`block w-5 h-[1.5px] bg-current transition-all duration-200 ${open ? "opacity-0" : ""}`} />
                <span className={`block w-5 h-[1.5px] bg-current transition-all duration-200 origin-center ${open ? "-rotate-45 -translate-y-[6.5px]" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Full-screen mobile menu — rendered outside <nav> to avoid the
          backdrop-filter stacking context that would let page content bleed through */}
      {open && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 flex flex-col px-6 pt-10 sm:hidden"
          style={{ top: 72, background: "rgba(22,20,18,0.97)" }}
        >
          <Link
            href="/pricing"
            onClick={() => setOpen(false)}
            className="py-4 text-[2rem] font-semibold text-ink hover:text-muted transition-colors"
          >
            Pricing
          </Link>
          <div className="h-px bg-white/[0.06]" />
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="py-4 text-[2rem] font-semibold text-ink hover:text-muted transition-colors"
          >
            Log in
          </Link>
          <div className="h-px bg-white/[0.06]" />
        </div>
      )}
    </>
  );
}
