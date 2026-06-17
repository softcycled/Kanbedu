import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Reliability Update — Jun 17, 2026 | Kanbedu",
  description: "A broad wave of fixes across deadlines, drag-and-drop, notifications, group search, and the class clone flow.",
};

export default function ReliabilityUpdatePage() {
  return (
    <div className="min-h-screen bg-paper text-ink" style={{ fontFamily: "var(--font-geist-sans)" }}>
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/landing" className="text-sm font-semibold text-ink hover:text-accent transition-colors">
            Kanbedu
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-12">
          <p className="text-xs font-medium uppercase tracking-widest text-muted mb-3">Jun 17, 2026</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink mb-4">Reliability Update</h1>
          <p className="text-base text-muted leading-relaxed">
            A broad wave of fixes shipped this week. Nothing flashy — just things that were quietly off, now working the way they should.
          </p>
        </div>

        <div className="space-y-10">
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Deadlines</h2>
            <p className="text-base text-ink/80 leading-relaxed">
              Tasks now only show as overdue the day <em>after</em> the deadline — not at midnight on the deadline day itself. The overdue label on the card and inside the task now agree with each other.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Drag & Drop</h2>
            <p className="text-base text-ink/80 leading-relaxed">
              If a card move fails — say, due to a connection hiccup — the card now snaps back to where it was instead of staying in the wrong column.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Group Search</h2>
            <p className="text-base text-ink/80 leading-relaxed">
              Monitor and Integrity now suggest the correct group when your search has no exact match. Typing &ldquo;4&rdquo; will suggest &ldquo;Group 4&rdquo; if that&apos;s what exists.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Class Clone</h2>
            <p className="text-base text-ink/80 leading-relaxed">
              Cloning a class with co-teachers no longer demotes them. They keep their educator role in the new class.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Column Rename</h2>
            <p className="text-base text-ink/80 leading-relaxed">
              On shared boards, the column rename box now always opens with the current name — previously it could show a stale name and silently overwrite a teammate&apos;s recent rename.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Formatting</h2>
            <p className="text-base text-ink/80 leading-relaxed">
              The formatting toolbar no longer mangles text when mixing bold and italic. Clicking italic on already-bold text now correctly adds italic instead of stripping a character.
            </p>
          </section>
        </div>

        <div className="mt-24 pt-8 border-t border-border">
          <Link href="/" className="text-sm text-muted hover:text-ink transition-colors">Back to Kanbedu</Link>
        </div>
      </main>
    </div>
  );
}
