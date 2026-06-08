"use client";

import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#F7F5F0" }}>
      <div className="w-full max-w-sm text-center">
        <div className="mb-10">
          <h1 className="text-2xl font-bold tracking-tight">
            <Link href="/landing" style={{ color: "#1C1917", textDecoration: "none" }}>kanbedu</Link>
          </h1>
        </div>

        <div
          className="rounded-2xl p-8 space-y-4"
          style={{
            backgroundColor: "#FDFCFA",
            border: "1px solid #E2DED8",
            boxShadow: "0 2px 8px rgba(26,24,20,0.06), 0 1px 3px rgba(26,24,20,0.04)",
          }}
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: "#FDF0EB" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E8613A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "#1C1917" }}>Something went wrong</p>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: "#78716C" }}>
              An unexpected error occurred. Try again, or go back home.
            </p>
          </div>
          <div className="space-y-2">
            <button
              onClick={reset}
              className="w-full py-2.5 text-sm font-medium rounded-xl transition-colors"
              style={{ backgroundColor: "#1C1917", color: "#F7F5F0" }}
            >
              Try again
            </button>
            <Link
              href="/"
              className="inline-block w-full py-2.5 text-sm font-medium rounded-xl transition-colors"
              style={{ backgroundColor: "#EFEDE8", color: "#1C1917" }}
            >
              Go home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
