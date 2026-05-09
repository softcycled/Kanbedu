import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Kanbedu",
  description: "Kanbedu Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-paper text-ink" style={{ fontFamily: "var(--font-geist-sans)" }}>
      {/* Nav */}
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/landing" className="text-sm font-semibold text-ink hover:text-accent transition-colors">
            Kanbedu
          </Link>
          <Link href="/terms" className="text-sm text-muted hover:text-ink transition-colors">
            Terms of Service →
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <p className="text-xs font-medium uppercase tracking-widest text-muted mb-3">Legal</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink mb-4">Privacy Policy</h1>
          <p className="text-sm text-muted">Last updated: 9/5/2026</p>
        </div>

        <div>
          <p className="text-base text-ink/80 leading-relaxed mb-10">
            Your privacy matters to us. This Privacy Policy explains what data Kanbedu collects, why we collect it, and how it&rsquo;s used. We keep this simple and honest — we&rsquo;re not in the business of selling your data.
          </p>

          <Section title="1. What We Collect">
            <p>We collect only what&rsquo;s necessary to run the service:</p>
            <SubHeading>Account information</SubHeading>
            <ul>
              <li>Your name and email address, provided when you sign up.</li>
              <li>A hashed version of your password. We never store your password in plaintext.</li>
              <li>Your chosen avatar colour and display preferences.</li>
            </ul>
            <SubHeading>Content you create</SubHeading>
            <ul>
              <li>Boards, columns, tasks, comments, and any other content you add to the platform.</li>
              <li>Task metadata: titles, descriptions, deadlines, priority, assignees, and column history.</li>
            </ul>
            <SubHeading>Usage data</SubHeading>
            <ul>
              <li>Basic activity data used for analytics features (e.g. task completion times, workflow phase durations).</li>
              <li>This data is used only to power in-app analytics visible to your board members — it is not shared externally.</li>
            </ul>
          </Section>

          <Section title="2. What We Don't Collect">
            <p>We don&rsquo;t collect:</p>
            <ul>
              <li>Payment information (Kanbedu is currently free).</li>
              <li>Device fingerprints, advertising identifiers, or behavioural tracking data.</li>
              <li>Any data beyond what is necessary to operate the service.</li>
            </ul>
          </Section>

          <Section title="3. Why We Collect It">
            <p>We use the data we collect to:</p>
            <ul>
              <li>Create and manage your account.</li>
              <li>Provide the core features of Kanbedu (boards, tasks, collaboration).</li>
              <li>Power the analytics dashboard so you and your team can review progress.</li>
              <li>Send transactional emails (e.g. invite links, password resets) — we don&rsquo;t send marketing emails without your consent.</li>
              <li>Debug issues and improve the service.</li>
            </ul>
          </Section>

          <Section title="4. Authentication and Sessions">
            <p>
              When you log in, Kanbedu issues a signed session token stored as an HTTP-only cookie. This token is used to authenticate your requests and expires after a period of inactivity.
            </p>
            <p>
              We do not use third-party OAuth (e.g. Google, GitHub) at this time. All authentication is handled directly by Kanbedu.
            </p>
          </Section>

          <Section title="5. Cookies and Local Storage">
            <p>
              Kanbedu uses a small number of cookies and browser storage mechanisms:
            </p>
            <ul>
              <li><strong>Session cookie</strong> — an HTTP-only cookie used to keep you logged in securely.</li>
              <li><strong>Theme preference</strong> — stored in <code>localStorage</code> to remember your light/dark mode setting.</li>
            </ul>
            <p>
              We do not use advertising cookies, third-party tracking cookies, or analytics platforms like Google Analytics.
            </p>
          </Section>

          <Section title="6. Data Storage and Security">
            <p>
              Your data is stored in a database hosted on our infrastructure. We use industry-standard practices to protect it:
            </p>
            <ul>
              <li>Passwords are hashed using bcrypt before storage.</li>
              <li>Communication between your browser and our servers is encrypted over HTTPS.</li>
              <li>Access to production data is restricted to authorised personnel only.</li>
            </ul>
            <p>
              No system is perfectly secure. While we take reasonable precautions, we cannot guarantee absolute security. If you suspect unauthorised access to your account, contact us at <Placeholder text="support@kanbedu.com" /> immediately.
            </p>
          </Section>

          <Section title="7. Third-Party Services">
            <p>
              Kanbedu may rely on third-party services for infrastructure (e.g. hosting, deployment). These providers are contractually bound to handle your data securely and only as instructed by us.
            </p>
            <p>
              We do not integrate with third-party advertising networks, social media trackers, or data brokers.
            </p>
            <p>
              If we introduce new third-party integrations in the future (e.g. email delivery, notifications), we will update this policy and disclose what data those services receive.
            </p>
          </Section>

          <Section title="8. Sharing Your Data">
            <p>We do not sell, rent, or trade your personal data. We only share it in these limited circumstances:</p>
            <ul>
              <li><strong>With your team</strong> — your name and avatar are visible to members of boards you belong to.</li>
              <li><strong>Legal requirements</strong> — if required by law, we may disclose information in response to a valid legal request.</li>
              <li><strong>Service providers</strong> — limited data may be shared with infrastructure providers strictly to operate the service.</li>
            </ul>
          </Section>

          <Section title="9. Your Rights">
            <p>You have the right to:</p>
            <ul>
              <li><strong>Access</strong> the data we hold about you.</li>
              <li><strong>Correct</strong> inaccurate information (you can update most of this directly in the app).</li>
              <li><strong>Delete</strong> your account and associated data by contacting us at <Placeholder text="support@kanbedu.com" />.</li>
              <li><strong>Export</strong> your data — contact us and we&rsquo;ll help where technically feasible.</li>
            </ul>
            <p>
              We aim to respond to data requests within 30 days.
            </p>
          </Section>

          <Section title="10. Data Retention">
            <p>
              We retain your account and content data for as long as your account is active. If you delete your account, we will remove your personal data within a reasonable period, except where we are required to retain it by law.
            </p>
            <p>
              Anonymised, aggregated data (e.g. aggregate usage patterns) may be retained indefinitely.
            </p>
          </Section>

          <Section title="11. Children">
            <p>
              Kanbedu is not directed at children under 13. We do not knowingly collect personal data from anyone under 13. If you believe a minor has created an account, please contact us at <Placeholder text="support@kanbedu.com" /> and we will remove it.
            </p>
          </Section>

          <Section title="12. Changes to This Policy">
            <p>
              We may update this Privacy Policy as the service evolves. When we do, we&rsquo;ll update the &ldquo;Last updated&rdquo; date at the top. For material changes, we&rsquo;ll notify you via email or an in-app notice.
            </p>
          </Section>

          <Section title="13. Contact">
            <p>
              If you have questions or concerns about this policy or how we handle your data, reach us at <Placeholder text="privacy@kanbedu.com" />. General support is at <Placeholder text="support@kanbedu.com" />.
            </p>
          </Section>
        </div>

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-border flex items-center justify-between">
          <Link href="/landing" className="text-sm text-muted hover:text-ink transition-colors">
            ← Back to Kanbedu
          </Link>
          <Link href="/terms" className="text-sm text-muted hover:text-ink transition-colors">
            Terms of Service →
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
      <div className="space-y-3 text-sm text-ink/80 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:text-ink/70 [&_strong]:font-semibold [&_strong]:text-ink [&_code]:font-mono [&_code]:text-xs [&_code]:bg-column-bg [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded">
        {children}
      </div>
    </section>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-muted mt-4 mb-1.5">{children}</p>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <span className="font-medium text-accent">{text}</span>
  );
}
