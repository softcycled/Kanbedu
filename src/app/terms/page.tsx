import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Kanbedu",
  description: "Kanbedu Terms of Service",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-paper text-ink" style={{ fontFamily: "var(--font-geist-sans)" }}>
      {/* Nav */}
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/landing" className="text-sm font-semibold text-ink hover:text-accent transition-colors">
            Kanbedu
          </Link>
          <Link href="/privacy" className="text-sm text-muted hover:text-ink transition-colors">
            Privacy Policy →
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <p className="text-xs font-medium uppercase tracking-widest text-muted mb-3">Legal</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink mb-4">Terms of Service</h1>
          <p className="text-sm text-muted">Last updated: 9/5/2026</p>
        </div>

        <div className="prose-kanbedu">
          <p className="text-base text-ink/80 leading-relaxed mb-10">
            These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of Kanbedu (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;). By creating an account or using Kanbedu, you agree to these Terms. If you don&rsquo;t agree, please don&rsquo;t use the service.
          </p>

          <Section title="1. What Kanbedu Is">
            <p>
              Kanbedu is a collaborative workflow and project management platform designed for students and educators. It lets you create boards, manage tasks, track progress, leave comments, and collaborate with your team.
            </p>
            <p>
              Kanbedu is a work in progress. Features may be added, changed, or removed over time. We&rsquo;ll do our best to communicate significant changes, but we can&rsquo;t guarantee a fixed feature set.
            </p>
          </Section>

          <Section title="2. Accounts and Access">
            <p>
              To use Kanbedu, you need to create an account with a valid email address and password.
            </p>
            <ul>
              <li>You must be at least 13 years old to use Kanbedu.</li>
              <li>You are responsible for keeping your login credentials secure. We are not liable for any loss or damage arising from unauthorised access to your account.</li>
              <li>Don&rsquo;t share your account with others or create accounts on behalf of other people without their permission.</li>
              <li>Notify us immediately at <Placeholder text="support@kanbedu.com" /> if you suspect your account has been compromised.</li>
            </ul>
          </Section>

          <Section title="3. Acceptable Use">
            <p>You agree to use Kanbedu only for lawful purposes and in ways that don&rsquo;t harm others. You must not:</p>
            <ul>
              <li>Use Kanbedu to harass, threaten, or abuse other users.</li>
              <li>Post or share content that is illegal, fraudulent, defamatory, or infringes on others&rsquo; rights.</li>
              <li>Attempt to gain unauthorised access to other users&rsquo; accounts or boards.</li>
              <li>Reverse engineer, scrape, or exploit the platform in ways not permitted by these Terms.</li>
              <li>Use Kanbedu to send spam or unsolicited communications.</li>
              <li>Interfere with or disrupt the service&rsquo;s infrastructure or other users&rsquo; experience.</li>
            </ul>
            <p>
              We reserve the right to suspend or terminate accounts that violate these rules, at our discretion, without prior notice.
            </p>
          </Section>

          <Section title="4. Your Content">
            <p>
              Anything you create on Kanbedu — boards, tasks, comments, descriptions — belongs to you. We don&rsquo;t claim ownership of your content.
            </p>
            <p>
              By using Kanbedu, you grant us a limited licence to store, display, and transmit your content solely as needed to operate the service. We will never sell your content to third parties or use it for advertising.
            </p>
            <p>
              You are responsible for the content you create and share. Don&rsquo;t upload anything you don&rsquo;t have the right to share.
            </p>
          </Section>

          <Section title="5. Intellectual Property">
            <p>
              The Kanbedu name, logo, and interface design are our intellectual property. You may not use them without permission.
            </p>
            <p>
              The underlying code, design system, and platform features are owned by Kanbedu. Nothing in these Terms transfers any intellectual property rights to you beyond what&rsquo;s needed to use the service.
            </p>
          </Section>

          <Section title="6. Service Availability">
            <p>
              We aim to keep Kanbedu available and reliable, but we can&rsquo;t guarantee uninterrupted uptime. The service is provided &ldquo;as is&rdquo; and we may take it offline for maintenance, upgrades, or at any time without notice.
            </p>
            <p>
              Kanbedu is a evolving product. We may change, pause, or discontinue features or the service itself. We&rsquo;ll try to give reasonable notice for significant changes, but this isn&rsquo;t always possible.
            </p>
          </Section>

          <Section title="7. Limitation of Liability">
            <p>
              To the maximum extent permitted by law, Kanbedu and its creators are not liable for:
            </p>
            <ul>
              <li>Loss of data, revenue, or profits.</li>
              <li>Indirect, incidental, or consequential damages arising from your use of the service.</li>
              <li>Errors, interruptions, or security vulnerabilities beyond our reasonable control.</li>
            </ul>
            <p>
              Our total liability for any claim related to Kanbedu will not exceed the amount you paid us in the past 12 months (which, if you&rsquo;re on a free plan, is $0).
            </p>
          </Section>

          <Section title="8. Termination">
            <p>
              You can stop using Kanbedu and delete your account at any time by contacting us at <Placeholder text="support@kanbedu.com" />.
            </p>
            <p>
              We may suspend or terminate your access if you violate these Terms, if required by law, or if we decide to shut down the service. Where possible, we&rsquo;ll give you advance notice and a way to export your data.
            </p>
          </Section>

          <Section title="9. Changes to These Terms">
            <p>
              We may update these Terms from time to time. When we do, we&rsquo;ll update the &ldquo;Last updated&rdquo; date at the top. Continued use of Kanbedu after changes are posted means you accept the updated Terms.
            </p>
            <p>
              For significant changes, we&rsquo;ll do our best to notify you via email or an in-app notice.
            </p>
          </Section>

          <Section title="10. Contact">
            <p>
              Questions about these Terms? Reach us at <Placeholder text="legal@kanbedu.com" />. General support is at <Placeholder text="support@kanbedu.com" />.
            </p>
          </Section>
        </div>

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-border flex items-center justify-between">
          <Link href="/landing" className="text-sm text-muted hover:text-ink transition-colors">
            ← Back to Kanbedu
          </Link>
          <Link href="/privacy" className="text-sm text-muted hover:text-ink transition-colors">
            Privacy Policy →
          </Link>
        </div>
      </main>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-base font-semibold text-ink mb-3 mt-8">{title}</h2>
      <div className="space-y-3 text-sm text-ink/80 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:text-ink/70">
        {children}
      </div>
    </section>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <span className="font-medium text-accent">{text}</span>
  );
}
