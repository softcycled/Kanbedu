import Link from "next/link";

export default function NotFound() {
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
          <p className="text-5xl font-bold tracking-tight" style={{ color: "#1C1917" }}>404</p>
          <div>
            <p className="text-sm font-semibold" style={{ color: "#1C1917" }}>Page not found</p>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: "#78716C" }}>
              This page doesn&apos;t exist or may have been moved.
            </p>
          </div>
          <Link
            href="/"
            className="inline-block w-full py-2.5 text-sm font-medium rounded-xl transition-colors"
            style={{ backgroundColor: "#1C1917", color: "#F7F5F0" }}
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
