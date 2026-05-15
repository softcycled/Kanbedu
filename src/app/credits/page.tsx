import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Credits — Kanbedu",
  description: "Kanbedu acknowledgements and credits.",
};

export default function CreditsPage() {
  return (
    <div className="min-h-screen bg-paper text-ink" style={{ fontFamily: "var(--font-geist-sans)" }}>
      {/* Nav */}
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/landing" className="text-sm font-semibold text-ink hover:text-accent transition-colors">
            Kanbedu
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <p className="text-xs font-medium uppercase tracking-widest text-muted mb-3">Credits</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink mb-4">Kanbedu</h1>
          <p className="text-sm text-muted">This started as a joke and somehow escaped containment.</p>
        </div>

        <div className="prose-kanbedu space-y-8">
          <section className="space-y-4">
            <p className="text-base text-ink/80 leading-relaxed">
              Kanbedu was conceived during a time of unexpected intellectual clarity and an unfortunate burst of ambition.
            </p>

            <p className="text-base text-ink/80 leading-relaxed">
              For months, I kept talking about the idea instead of actually building it, confidently telling people: "I could probably make a better version if I tried."
            </p>

            <p className="text-base text-ink/80 leading-relaxed">
              Nobody expected me to do anything about it.
              <br />
              Including me.
            </p>

            <p className="text-base text-ink/80 leading-relaxed">
              Then at 4AM before a presentation, something shifted.
              <br />
              A random burst of motivation appeared out of nowhere and the first Kanbedu demo was built in around 1.5 hours.
            </p>

            <div className="mt-6">
              <p className="text-base text-ink/80 leading-relaxed mb-3">The original version was held together by:</p>
              <div className="ml-px space-y-[3px] text-[15px] text-ink/55 italic">
                <p>AI.</p>
                <p>Desperation.</p>
                <p>Optimism.</p>
                <p>Several questionable engineering decisions.</p>
              </div>
            </div>

            <p className="mt-10 text-xl md:text-2xl font-semibold text-ink leading-snug">Somehow, people didn't think it was complete bullshit.</p>

            <p className="mt-2 text-xl md:text-2xl font-semibold text-ink leading-snug">This was deeply unfortunate because it meant I now had to continue building it.</p>
          </section>

          <section className="space-y-4">
            <p className="text-base text-ink/80 leading-relaxed mb-3">Since then:</p>
            <ul className="list-disc pl-5 space-y-2 text-ink/80">
              <li>databases have fought back</li>
              <li>queries have taken 6 seconds to update a single task</li>
              <li>entire UI sections have been erased from history</li>
              <li>and several debugging sessions became spiritual experiences</li>
            </ul>
          </section>

          <section className="space-y-8">
            <p className="text-base leading-relaxed font-bold">Against all odds, Kanbedu avoided dying immediately. So, we're here.</p>
          </section>

          <section className="mt-10 space-y-8">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Built By</p>
              <p className="text-[15px] leading-7 text-muted mt-2">Built by Jorge and the Kanbedu team.</p>
            </div>

            <div className="mt-10">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Special Thanks</p>
              <p className="text-[15px] leading-7 text-muted mt-2 max-w-sm">Thanks to everyone who tested early builds, gave feedback, tolerated the chaos, and supported the project while it slowly evolved into something functional.</p>
            </div>
          </section>

          <section className="mt-10">
            <p className="text-xs uppercase tracking-[0.2em] text-muted mb-3">Private Beta</p>
            <p className="text-[15px] leading-7 text-muted max-w-2xl">Kanbedu is currently in private beta while features, systems, and performance continue evolving.</p>
          </section>

          <section className="mt-10">
            <p className="mt-2 text-xl md:text-2xl font-semibold text-ink leading-snug">Thanks for being here early.</p>
          </section>
        </div>

        <div className="mt-24 pt-8 border-t border-border flex items-center justify-between">
          <Link href="/landing" className="text-sm text-muted hover:text-ink transition-colors">← Back to Kanbedu</Link>
        </div>
      </main>
    </div>
  );
}

