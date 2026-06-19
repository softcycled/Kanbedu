import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Reliability Update | Kanbedu",
  description: "A pass through the parts of the app that were working but not quite right.",
};

export default function ReliabilityUpdatePage() {
  return (
    <div className="min-h-screen bg-paper text-ink" style={{ fontFamily: "var(--font-geist-sans)" }}>
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-ink hover:text-accent transition-colors">
            Kanbedu
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-16">
        <div className="mb-10">
          <p className="text-xs font-medium uppercase tracking-widest text-muted mb-3">Jun 17, 2026</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink mb-6">Reliability Update</h1>
          <p className="text-base text-muted leading-relaxed">
            This update doesn't add anything new. It's a pass through the parts of the app that were working but not quite right, making them behave the way you'd expect.
          </p>
        </div>

        <div className="space-y-6 text-base text-ink/80 leading-relaxed">
          <p>
            <strong className="text-ink font-semibold">Deadlines were the biggest one.</strong> Tasks were showing as overdue from midnight on the deadline day, which meant something due today was already flagged red before most people had started their day. A task is now only overdue after the deadline day has fully passed.
          </p>

          <p>
            <strong className="text-ink font-semibold">On shared boards</strong>, the column rename box was opening with a stale name when a teammate had recently renamed it. Typing into it without noticing would silently overwrite their change. It now always opens showing the current name.
          </p>

          <p>
            When a <strong className="text-ink font-semibold">card move fails</strong> due to a brief connection drop, the card was staying in the wrong column instead of snapping back. It now returns to where it started.
          </p>

          <p>
            The <strong className="text-ink font-semibold">group search</strong>{" "}in Monitor and Integrity now suggests the right group when your search doesn&apos;t match exactly. Typing &ldquo;4&rdquo; will point you to &ldquo;Group 4&rdquo; if that&apos;s what exists.
          </p>

          <p>
            <strong className="text-ink font-semibold">Cloning a class with co-teachers</strong> no longer demotes them. They keep their educator role in the new class.
          </p>

          <p>
            The <strong className="text-ink font-semibold">formatting toolbar</strong> no longer mangles mixed styles. Clicking italic on already-bold text was stripping a character instead of adding italic. That's fixed.
          </p>
        </div>

        <div className="mt-24 pt-8 border-t border-border">
          <Link href="/" className="text-sm text-muted hover:text-ink transition-colors">Back to Kanbedu</Link>
        </div>
      </main>
    </div>
  );
}
