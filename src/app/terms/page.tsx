import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Kanbedu",
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
          <p className="text-sm text-muted">Last updated: 7th June 2026</p>
        </div>

        <div>
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
              <li>We require you to verify your email address before accessing all features of the service.</li>
              <li>You are responsible for keeping your login credentials secure. We are not liable for any loss or damage arising from unauthorised access to your account.</li>
              <li>Don&rsquo;t share your account with others or create accounts on behalf of other people without their permission.</li>
              <li>You are responsible for all activity that occurs under your account.</li>
              <li>Notify us immediately at <Placeholder text="support@kanbedu.com" /> if you suspect your account has been compromised.</li>
              <li>Where Kanbedu is used in an institutional or educational setting, the institution is responsible for ensuring appropriate consents are in place for all users, including minors. Institutional administrators who invite or onboard users accept these Terms on behalf of their institution.</li>
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
              <li>Introduce malware, viruses, or any other harmful code into the platform.</li>
              <li>Impersonate any person or entity, or misrepresent your affiliation with any person or entity.</li>
            </ul>
            <p>
              We reserve the right to suspend or terminate accounts that violate these rules, at our sole discretion, without prior notice or liability to you.
            </p>
          </Section>

          <Section title="4. Your Content">
            <p>
              Anything you create on Kanbedu (boards, tasks, comments, descriptions) belongs to you. We don&rsquo;t claim ownership of your content.
            </p>
            <p>
              By using Kanbedu, you grant us a limited, non-exclusive, royalty-free, worldwide licence to store, display, and transmit your content solely as needed to operate the service. This licence ends when you delete your content or close your account. We will never sell your content to third parties or use it for advertising.
            </p>
            <p>
              Please only upload content you have the right to share. Don&rsquo;t post anything that infringes someone else&rsquo;s rights or breaks the law. What you create and share on Kanbedu is your responsibility.
            </p>
          </Section>

          <Section title="5. Intellectual Property">
            <p>
              The Kanbedu name, logo, and interface design are our intellectual property. You may not use them without our prior written permission.
            </p>
            <p>
              The underlying code, design system, and platform features are owned by Kanbedu. Nothing in these Terms gives you any intellectual property rights beyond what&rsquo;s needed to use the service.
            </p>
          </Section>

          <Section title="6. Disclaimer of Warranties">
            <p>
              Kanbedu is provided as-is and as-available, without warranties of any kind. To the fullest extent the law allows, we make no warranties, express or implied, including:
            </p>
            <ul>
              <li>That the service will be uninterrupted, timely, secure, or error-free.</li>
              <li>That anything on the platform is accurate, complete, or reliable.</li>
              <li>Any implied warranty of fitness for a particular purpose or non-infringement.</li>
            </ul>
            <p>
              We may take the service offline for maintenance, upgrades, or at any time without notice. We may change, pause, or discontinue features or the service itself. We&rsquo;ll try to give reasonable notice for significant changes, but this isn&rsquo;t always possible.
            </p>
          </Section>

          <Section title="7. Limitation of Liability">
            <p>
              To the maximum extent the law allows, Kanbedu and its creators are not liable for:
            </p>
            <ul>
              <li>Loss of data, revenue, profits, goodwill, or business opportunities.</li>
              <li>Indirect, incidental, special, consequential, or punitive damages.</li>
              <li>Errors, interruptions, or security incidents beyond our reasonable control.</li>
              <li>Any damages arising from your reliance on content or information on the platform.</li>
            </ul>
            <p>
              Our total liability for any claim related to your use of Kanbedu won&rsquo;t exceed the greater of (a) what you paid us in the 12 months before the claim, or (b) MYR 500 (or the equivalent in your local currency). If you&rsquo;re on the free plan, our liability is capped at MYR 500.
            </p>
            <p>
              Some jurisdictions don&rsquo;t allow certain liability exclusions. In those cases, our liability is limited to the fullest extent the law allows.
            </p>
          </Section>

          <Section title="8. Indemnification">
            <p>
              If your use of Kanbedu, your content, or your violation of these Terms causes a legal claim against us, you agree to cover our costs. Specifically, you agree to indemnify and hold harmless Kanbedu and its creators from any claims, damages, losses, and expenses (including reasonable legal fees) arising from:
            </p>
            <ul>
              <li>Your use of or access to Kanbedu.</li>
              <li>Your violation of these Terms.</li>
              <li>Your content, or any claim that it infringes a third party&rsquo;s rights.</li>
              <li>Your violation of any law or regulation.</li>
            </ul>
          </Section>

          <Section title="9. Termination">
            <p>
              You can stop using Kanbedu and request deletion of your account at any time by contacting us at <Placeholder text="support@kanbedu.com" />.
            </p>
            <p>
              We may suspend or terminate your access if you violate these Terms, if required by law, or if we decide to shut down the service. Where possible, we&rsquo;ll give you advance notice and a reasonable opportunity to export your data.
            </p>
            <p>
              When your access ends, the licences we granted you under these Terms end too. Sections that should naturally survive termination (including Sections 4, 5, 7, 8, 10, and 11) will continue to apply.
            </p>
          </Section>

          <Section title="10. Governing Law and Disputes">
            <p>
              These Terms are governed by and construed in accordance with the laws of Malaysia, without regard to its conflict of law provisions. Any disputes relating to these Terms or your use of Kanbedu will be subject to the exclusive jurisdiction of the courts of Malaysia.
            </p>
            <p>
              Before starting any formal legal proceedings, please contact us at <Placeholder text="legal@kanbedu.com" /> first and give us 30 days to try to sort it out informally.
            </p>
          </Section>

          <Section title="11. Changes to These Terms">
            <p>
              We may update these Terms from time to time. When we do, we&rsquo;ll update the &ldquo;Last updated&rdquo; date at the top. Continuing to use Kanbedu after changes go live means you accept the updated Terms.
            </p>
            <p>
              For significant changes, we&rsquo;ll do our best to notify you via email or an in-app notice at least 14 days before they take effect.
            </p>
          </Section>

          <Section title="12. General">
            <p>
              <strong>Entire agreement.</strong>{" "}These Terms, together with our Privacy Policy, make up the entire agreement between you and Kanbedu about your use of the service and replace any previous agreements on the same subject.
            </p>
            <p>
              <strong>Severability.</strong>{" "}If any part of these Terms is found to be unenforceable or invalid, it will be removed or narrowed only as needed; the rest still stands.
            </p>
            <p>
              <strong>No waiver.</strong>{" "}If we don&rsquo;t enforce a right or provision in these Terms, that doesn&rsquo;t mean we&rsquo;ve waived it. Any waiver needs to be in writing from an authorised Kanbedu representative.
            </p>
            <p>
              <strong>Force majeure.</strong>{" "}We won&rsquo;t be liable for any failure or delay caused by circumstances outside our reasonable control, including natural disasters, government actions, internet outages, or third-party service failures.
            </p>
            <p>
              <strong>Assignment.</strong>{" "}You can&rsquo;t transfer your rights or obligations under these Terms without our written consent. We can transfer ours without restriction, including as part of a merger, acquisition, or sale.
            </p>
          </Section>

          <Section title="13. Contact">
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
      <div className="space-y-3 text-sm text-ink/80 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:text-ink/70 [&_strong]:font-semibold [&_strong]:text-ink">
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
