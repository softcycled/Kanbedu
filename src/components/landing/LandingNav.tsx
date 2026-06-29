import Link from "next/link";

// Shared marketing top nav, used by the landing and pricing pages.
export default function LandingNav() {
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
          <Link href="/pricing" className="text-sm text-muted hover:text-ink transition-colors duration-150">
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
        </div>
      </div>
    </nav>
  );
}
