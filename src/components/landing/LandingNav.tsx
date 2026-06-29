"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";

// Shared marketing top nav, used by the landing and pricing pages.
export default function LandingNav() {
  const [open, setOpen] = useState(false);
  const hamburgerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    function onMouse(e: MouseEvent) {
      // mousedown fires before click. If we call setOpen(false) here while
      // the user is tapping a link inside the overlay, the overlay unmounts
      // before the click event fires and navigation never happens.
      // Skip the close when mousedown lands inside either the hamburger or
      // the overlay — the links' own onClick handlers close the menu instead.
      if (
        hamburgerRef.current?.contains(e.target as Node) ||
        overlayRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    }
    function onResize() {
      if (window.innerWidth >= 640) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onMouse);
    window.addEventListener("resize", onResize);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("mousedown", onMouse);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onKeyDown);
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
            <div className="sm:hidden" ref={hamburgerRef}>
              <button
                onClick={() => setOpen((v) => !v)}
                aria-label={open ? "Close menu" : "Menu"}
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

      {/* Full-screen mobile menu — sibling of <nav> so it escapes the
          backdrop-filter stacking context. overlayRef lets the mousedown
          handler distinguish overlay taps (let click fire) from outside taps
          (close immediately). */}
      {open && (
        <div
          ref={overlayRef}
          onClick={() => setOpen(false)}
          className="fixed inset-x-0 bottom-0 z-[60] flex flex-col px-6 pt-10 sm:hidden"
          style={{ top: 72, background: "#161412" }}
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
