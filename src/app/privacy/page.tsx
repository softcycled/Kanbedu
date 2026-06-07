import { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Privacy Policy | Kanbedu",
  description: "Kanbedu Privacy Policy",
};

export default async function PrivacyPage() {
  // Logged-in visitors (reaching this via the in-app Help panel) go back to the
  // board; logged-out visitors (from the landing footer) go back to the landing page.
  const session = await getSession();
  const backHref = session ? "/" : "/landing";
  const backLabel = session ? "Back to board" : "Back to Kanbedu";
  return (
    <div className="min-h-screen bg-paper text-ink" style={{ fontFamily: "var(--font-geist-sans)" }}>
      {/* Nav */}
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href={backHref} className="text-sm font-semibold text-ink hover:text-accent transition-colors">
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
          <p className="text-sm text-muted">Last updated: 7th June 2026</p>
        </div>

        <div>
          <p className="text-base text-ink/80 leading-relaxed mb-10">
            Your privacy matters to us. This Privacy Policy explains what data Kanbedu collects, why we collect it, and how it&rsquo;s used. We keep this simple and honest. We&rsquo;re not in the business of selling your data.
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
              <li>This data is used only to power in-app analytics visible to your board members. It&rsquo;s not shared externally.</li>
            </ul>
            <SubHeading>Diagnostic data</SubHeading>
            <ul>
              <li>If the app encounters an error, we automatically collect diagnostic information including the error details, your browser and operating system type, and a session identifier. This is processed by our error monitoring provider (Sentry) and used solely to identify and fix bugs.</li>
              <li>Standard server logs, including IP addresses, browser type, and request timestamps, are collected automatically by our hosting infrastructure.</li>
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
              <li>Send transactional emails (e.g. invite links, password resets). We don&rsquo;t send marketing emails without your consent.</li>
              <li>Debug issues and improve the service.</li>
            </ul>
          </Section>

          <Section title="4. Legal Basis for Processing">
            <p>
              We process your personal data in accordance with Malaysia&rsquo;s Personal Data Protection Act 2010 (the &ldquo;PDPA&rdquo;) and the data protection principles it sets out, including the General Principle, the Notice and Choice Principle, the Security Principle, and the Retention Principle. By creating an account and providing your data, you consent to us processing it for the purposes described in this policy. You can withdraw your consent at any time as described in Section 11.
            </p>
            <p>
              Where other data protection laws also apply to you, we rely on the following grounds to process your data:
            </p>
            <ul>
              <li><strong>Performance of a contract:</strong> processing your account information and content is necessary to provide the service you signed up for.</li>
              <li><strong>Legitimate interests:</strong> we process usage data to operate, secure, and improve the platform. We only do this where our interests don&rsquo;t override your rights.</li>
              <li><strong>Legal obligation:</strong> we may process or retain data where the law requires it.</li>
              <li><strong>Consent:</strong> where we rely on your consent (e.g. marketing communications), you can withdraw it at any time. That won&rsquo;t affect anything we processed before you withdrew.</li>
            </ul>
          </Section>

          <Section title="5. Authentication and Sessions">
            <p>
              When you create an account, we send a verification email to confirm your address. Your account will have limited access until your email is verified. Verification links are single-use and expire within 24 hours.
            </p>
            <p>
              When you log in, Kanbedu issues a signed session token stored as an HTTP-only cookie. This token is used to authenticate your requests and expires after a period of inactivity.
            </p>
            <p>
              We do not use third-party OAuth (e.g. Google, GitHub) at this time. All authentication is handled directly by Kanbedu.
            </p>
          </Section>

          <Section title="6. Cookies and Local Storage">
            <p>
              Kanbedu uses a small number of cookies and browser storage mechanisms:
            </p>
            <ul>
              <li><strong>Session cookie:</strong> an HTTP-only cookie used to keep you logged in securely.</li>
              <li><strong>Theme preference:</strong> stored in <code>localStorage</code> to remember your light/dark mode setting.</li>
            </ul>
            <p>
              We do not use advertising cookies, third-party tracking cookies, or analytics platforms like Google Analytics.
            </p>
          </Section>

          <Section title="7. Data Storage and Security">
            <p>
              Your data is stored using third-party infrastructure providers (see Section 9). We use industry-standard practices to protect it:
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

          <Section title="8. International Data Transfers">
            <p>
              As Kanbedu relies on infrastructure providers that operate servers globally (see Section 9), your personal data may be transferred to, stored, and processed outside Malaysia. Consistent with the PDPA, we take reasonable steps to ensure that any party we transfer your data to provides a standard of protection comparable to that required under Malaysian law, for example by relying on providers that maintain standard contractual clauses or equivalent safeguards recognised under applicable law.
            </p>
            <p>
              By using Kanbedu, you consent to your personal data being transferred to and processed in countries other than Malaysia as described in this policy.
            </p>
          </Section>

          <Section title="9. Third-Party Services">
            <p>
              We rely on the following providers to operate Kanbedu. Each is contractually bound to handle your data securely and only as instructed by us.
            </p>
            <ul>
              <li><strong>Supabase:</strong> database hosting. Stores all account data, content, and usage data.</li>
              <li><strong>Vercel:</strong> hosting and deployment. Processes all web requests and server logs including IP addresses.</li>
              <li><strong>Resend:</strong> email delivery. Receives your email address to send transactional emails (verification links, password resets, and board invites).</li>
              <li><strong>Sentry:</strong> error monitoring. Receives diagnostic data including session identifiers and browser information when errors occur.</li>
            </ul>
            <p>
              We do not integrate with advertising networks, social media trackers, or data brokers. If we add new providers in the future, we will update this section.
            </p>
          </Section>

          <Section title="10. Sharing Your Data">
            <p>We do not sell, rent, or trade your personal data. We only share it in these limited circumstances:</p>
            <ul>
              <li><strong>With your team:</strong> your name and avatar are visible to members of boards you belong to.</li>
              <li><strong>Legal requirements:</strong> if required by law or a valid legal process, we may disclose information. Where permitted, we will notify you before complying.</li>
              <li><strong>Service providers:</strong> limited data may be shared with infrastructure providers strictly to operate the service, under confidentiality obligations.</li>
              <li><strong>Business transfers:</strong> in the event of a merger, acquisition, or sale of assets, your data may be transferred to a successor entity, subject to equivalent privacy protections.</li>
            </ul>
          </Section>

          <Section title="11. Your Rights">
            <p>
              Under the PDPA, you have the right to access and correct your personal data, and to withdraw your consent to our processing of it. To exercise these rights, contact us at <Placeholder text="privacy@kanbedu.com" />.
            </p>
            <p>Depending on where you live, you may also have some or all of the following rights over your data:</p>
            <ul>
              <li><strong>Access:</strong> request a copy of the data we hold about you.</li>
              <li><strong>Correction:</strong> update inaccurate information (most can be changed directly in the app).</li>
              <li><strong>Deletion:</strong> ask us to delete your account and associated data by contacting us at <Placeholder text="support@kanbedu.com" />.</li>
              <li><strong>Portability:</strong> request your data in a structured, machine-readable format where technically feasible.</li>
              <li><strong>Restriction:</strong> ask us to limit how we process your data in certain circumstances.</li>
              <li><strong>Objection:</strong> object to processing based on our legitimate interests, including any profiling.</li>
              <li><strong>Withdraw consent:</strong> if we&rsquo;re relying on your consent, you can withdraw it at any time. This won&rsquo;t affect anything we processed before you withdrew.</li>
              <li><strong>Lodge a complaint:</strong> if you think we&rsquo;ve mishandled your data, you can complain to your local data protection authority.</li>
            </ul>
            <p>
              We aim to respond to all data requests within 30 days. We may need to verify your identity before fulfilling a request.
            </p>
          </Section>

          <Section title="12. Data Retention">
            <p>
              We retain your account and content data for as long as your account is active. If you delete your account, we will remove your personal data within a reasonable period (typically within 30 days), except where we are required to retain it by law or for legitimate security purposes.
            </p>
            <p>
              Anonymised, aggregated data (e.g. aggregate usage patterns) may be retained indefinitely, as it cannot reasonably be linked back to you.
            </p>
          </Section>

          <Section title="13. Children">
            <p>
              Kanbedu is intended for users aged 13 and over. We do not knowingly collect personal data from children under 13. If you are under 13, please do not use Kanbedu or provide any personal information.
            </p>
            <p>
              If a parent or guardian believes a child under 13 has created an account, please contact us at <Placeholder text="support@kanbedu.com" /> and we will promptly delete the account and associated data.
            </p>
            <p>
              Users aged 13 to 17 should use Kanbedu only with the awareness and consent of a parent or guardian, where required by law.
            </p>
            <p>
              Where Kanbedu is used in an institutional or educational setting, the institution is responsible for ensuring that appropriate consents and authorisations are in place for all users, including those under the digital age of consent in their jurisdiction.
            </p>
          </Section>

          <Section title="14. Changes to This Policy">
            <p>
              We may update this Privacy Policy as the service evolves. When we do, we&rsquo;ll update the &ldquo;Last updated&rdquo; date at the top. For material changes, we&rsquo;ll notify you via email or an in-app notice at least 14 days before the changes take effect, where reasonably practicable.
            </p>
          </Section>

          <Section title="15. Contact">
            <p>
              If you have questions or concerns about this policy or how we handle your data, reach us at <Placeholder text="privacy@kanbedu.com" />. General support is at <Placeholder text="support@kanbedu.com" />.
            </p>
            <p>
              If you are in Malaysia and believe we have not adequately addressed your concern, you may lodge a complaint with the Personal Data Protection Commissioner (Jabatan Perlindungan Data Peribadi). If you are in the European Economic Area, you have the right to contact your local supervisory authority.
            </p>
          </Section>
        </div>

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-border flex items-center justify-between">
          <Link href={backHref} className="text-sm text-muted hover:text-ink transition-colors">
            ← {backLabel}
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
