import Link from "next/link";

// Shared marketing footer, used by the landing and pricing pages.
export default function LandingFooter() {
  return (
    <footer
      className="py-10 px-6"
      style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "#0f0e0c" }}
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5">
        <span className="text-sm font-semibold text-white/30">kanbedu</span>
        <div className="flex items-center flex-wrap justify-center sm:justify-end gap-x-5 gap-y-2 text-xs text-white/25">
          <Link href="/pricing" className="hover:text-white/45 transition-colors">Pricing</Link>
          <Link href="/terms" className="hover:text-white/45 transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-white/45 transition-colors">Privacy</Link>
          <a href="mailto:kanbeduapp@gmail.com" className="hover:text-white/45 transition-colors">Contact</a>
          <Link href="/credits" className="hover:text-white/45 transition-colors">Credits</Link>
          <span>© 2026 Kanbedu</span>
        </div>
      </div>
    </footer>
  );
}
