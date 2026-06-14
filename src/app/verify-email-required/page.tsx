import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import ResendButton from "./ResendButton";
import SignOutButton from "./SignOutButton";

export const dynamic = "force-dynamic";

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(2, local.length - 2))}@${domain}`;
}

export default async function VerifyEmailRequired() {
  const session = await getSession();
  if (!session) redirect("/landing");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true, emailVerified: true },
  });

  if (!user) redirect("/landing");
  if (user.emailVerified) redirect("/");

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-paper">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold tracking-tight">
            <a href="/landing" className="text-ink no-underline">kanbedu</a>
          </h1>
          <p className="text-sm mt-1 text-muted">Verify your email</p>
        </div>
        <div className="rounded-2xl p-6 text-center bg-card-bg border border-border shadow-card">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-5 bg-column-bg">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-muted" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M2 7l10 7 10-7" />
            </svg>
          </div>
          <p className="text-sm font-semibold mb-1 text-ink">Check your inbox</p>
          <p className="text-sm mb-1 text-muted">
            We sent a verification link to
          </p>
          <p className="text-sm font-medium mb-6 text-ink">
            {maskEmail(user.email)}
          </p>
          <p className="text-xs mb-5 text-muted/70">
            You need to verify your email before you can use Kanbedu. The link expires in 24 hours.
          </p>
          <ResendButton />
        </div>
        <div className="mt-4 text-center">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
