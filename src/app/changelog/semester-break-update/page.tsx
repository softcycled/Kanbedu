import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "The Semester Break Update | Kanbedu",
  description: "A month of new features: board sharing, a rebuilt Analytics tab, file attachments, a trash for deleted tasks, push notifications, and more.",
};

export default function SemesterBreakUpdatePage() {
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
          <p className="text-xs font-medium uppercase tracking-widest text-muted mb-3">Jul 16, 2026</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink mb-6">The Semester Break Update</h1>
          <p className="text-base text-muted leading-relaxed">
            The Reliability Update was about fixing what was already there. This one is about what&apos;s new. A month of work went into it: sharing, a new take on analytics, file attachments, a safety net for deleted tasks, and a long list of things that just work better now.
          </p>
        </div>

        <div className="space-y-10">
          <section>
            <h2 className="text-xl font-semibold text-ink mb-5">Share a board with a link</h2>
            <div className="rounded-2xl border border-border overflow-hidden mb-4">
              <Image src="/screenshots/changelog-public-view.png" alt="A board opened through a public view link, showing the read-only preview banner" width={2560} height={1320} className="w-full h-auto" unoptimized />
            </div>
            <p className="text-base text-ink/80 leading-relaxed">
              Personal boards can now be shared with anyone. Turn on the public view link under Board settings, in the new Visibility section, and anyone who opens it sees your board in read-only preview mode. No account, no login. Visitors can search and filter tasks, but they can&apos;t touch anything, and the link never exposes assignees, comments, or attachments. If a link gets somewhere it shouldn&apos;t, regenerate it and the old one stops working instantly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-5">Analytics, rebuilt</h2>
            <div className="rounded-2xl border border-border overflow-hidden mb-4">
              <Image src="/screenshots/changelog-analytics.png" alt="The new Analytics charts showing tasks by phase and time spent per phase" width={1952} height={856} className="w-full h-auto" unoptimized />
            </div>
            <p className="text-base text-ink/80 leading-relaxed">
              The Analytics tab used to be tables of numbers. Now it&apos;s charts. See where work is sitting, how long tasks stay in each phase, which phase is the bottleneck, how much of each priority is still open, and completions week by week. It answers the question the tables never quite did: is this project actually moving? Analytics now opens from the board title menu, and boards without much activity yet get a clean waiting state instead of empty graphs.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-5">Files on tasks</h2>
            <div className="rounded-2xl border border-border overflow-hidden mb-4">
              <Image src="/screenshots/changelog-attachments.png" alt="A task's attachments section showing two uploaded files" width={1350} height={488} className="w-full h-auto" unoptimized />
            </div>
            <p className="text-base text-ink/80 leading-relaxed">
              Tasks can now carry attachments. Drop in images, PDFs, or documents and they live right on the task, next to the description and comments. Up to 10 files per task at 10 MB each, with 100 MB of storage per board.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-5">Deleted doesn&apos;t mean gone</h2>
            <div className="rounded-2xl border border-border overflow-hidden mb-4">
              <Image src="/screenshots/changelog-trash.png" alt="The Recently deleted panel showing a restorable task" width={896} height={300} className="w-full h-auto" unoptimized />
            </div>
            <p className="text-base text-ink/80 leading-relaxed">
              Deleting a task used to be permanent, which is a scary property for a tool used by groups. Deleted tasks now move to Recently deleted, where anyone with the right access can restore them for 30 days before they&apos;re cleaned up for good.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-2">Notifications that reach you</h2>
            <p className="text-base text-ink/80 leading-relaxed">
              Kanbedu can now send push notifications to your device. When someone assigns you a task or comments on one of yours, you&apos;ll know about it even with the tab closed. Enable them once from your browser prompt and they just work.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-2">The Participation tab</h2>
            <p className="text-base text-ink/80 leading-relaxed">
              A new panel for educators, sitting next to Monitor and Integrity. It shows each student&apos;s written contribution across their group&apos;s board: words added to task descriptions and comments posted. Group work has a way of hiding who did what, and this makes the quiet contributors, and the quiet passengers, visible. Contributions are credited to the group where they happened, so moving a student between groups doesn&apos;t move their history with them.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-2">Joining a class in three steps</h2>
            <p className="text-base text-ink/80 leading-relaxed">
              Scan the QR code, create an account, land on your board. Students who arrive through a class invite now start at signup instead of a login form they can&apos;t use yet, and students whose email was added by their lecturer through a roster import skip email verification entirely. The invite already proved they own the address. Educators can also see who hasn&apos;t joined yet in the Roster tab, and resend or withdraw invites from there.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-5">One menu for everything</h2>
            <div className="rounded-2xl border border-border overflow-hidden mb-4">
              <Image src="/screenshots/changelog-menu.png" alt="The board title dropdown open, showing Invite to board, Board settings, and Analytics" width={1800} height={920} className="w-full h-auto" unoptimized />
            </div>
            <p className="text-base text-ink/80 leading-relaxed">
              The Manage tab is gone. Everything about the board you&apos;re looking at now lives in a menu on the board title: invite people, open settings, view analytics, or leave. Class group boards got the same menu, educators can rename a group right from it, and students can finally see who&apos;s in their group under Board settings. Behind the scenes, every dropdown in the app was rebuilt on a single shared design, so menus look and behave the same everywhere instead of each having its own opinions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-5">Lecturer Pro</h2>
            <div className="rounded-2xl border border-border overflow-hidden mb-4">
              <Image src="/screenshots/changelog-pricing.png" alt="The Free and Lecturer Pro pricing cards" width={2000} height={880} className="w-full h-auto" unoptimized />
            </div>
            <p className="text-base text-ink/80 leading-relaxed">
              Kanbedu now has a <Link href="/pricing" className="text-accent hover:underline">pricing page</Link>. Everything you use today stays free. Lecturer Pro adds room to grow, with more active classes, archiving, and one-click cloning of a finished class into the new semester. It isn&apos;t purchasable yet, but the waitlist is open and waitlist members hear about it first.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-2">And everything else</h2>
            <p className="text-base text-ink/80 leading-relaxed">
              Boards now refresh every few seconds, so a teammate&apos;s changes show up almost immediately. Signups no longer stall when a whole classroom shares one campus network. The landing page got a proper mobile menu, and the board header was cleaned up on small screens. A task&apos;s edit history records once per edit instead of once per keystroke. You can now delete your account from Settings. And underneath all of it, a month of security hardening, performance work, and several dozen small fixes.
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
