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
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#F7F5F0" }}>
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold tracking-tight mb-2">
          <a href="/landing" style={{ color: "#1C1917", textDecoration: "none" }}>kanbedu</a>
        </h1>
        <div className="rounded-2xl p-8 mt-6" style={{ backgroundColor: "#FDFCFA", border: "1px solid #E2DED8", boxShadow: "0 2px 8px rgba(26,24,20,0.06)" }}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: "#F0F0EB" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#78716C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M2 7l10 7 10-7" />
            </svg>
          </div>
          <p className="text-base font-semibold mb-1" style={{ color: "#1C1917" }}>Check your inbox</p>
          <p className="text-sm mb-1" style={{ color: "#78716C" }}>
            We sent a verification link to
          </p>
          <p className="text-sm font-medium mb-6" style={{ color: "#1C1917" }}>
            {maskEmail(user.email)}
          </p>
          <p className="text-xs mb-5" style={{ color: "#A8A29E" }}>
            You need to verify your email before you can use Kanbedu. The link expires in 24 hours.
          </p>
          <ResendButton />
        </div>
        <div className="mt-4">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
