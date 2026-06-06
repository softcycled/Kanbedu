import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function VerifyEmailPage({ params }: Props) {
  const { token } = await params;

  let success = false;
  let errorMessage = "Something went wrong. Please try again.";

  try {
    const record = await prisma.emailVerification.findUnique({ where: { token } });

    if (!record) {
      errorMessage = "Invalid or expired verification link.";
    } else if (record.expiresAt < new Date()) {
      await prisma.emailVerification.delete({ where: { id: record.id } });
      errorMessage = "This verification link has expired. Please request a new one.";
    } else {
      await prisma.$transaction([
        prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
        prisma.emailVerification.deleteMany({ where: { userId: record.userId } }),
      ]);
      await createSession(record.userId);
      success = true;
    }
  } catch {
    errorMessage = "Something went wrong. Please try again.";
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#F7F5F0" }}>
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold tracking-tight mb-2">
          <a href="/landing" style={{ color: "#1C1917", textDecoration: "none" }}>kanbedu</a>
        </h1>
        <div className="rounded-2xl p-6 mt-6" style={{ backgroundColor: "#FDFCFA", border: "1px solid #E2DED8", boxShadow: "0 2px 8px rgba(26,24,20,0.06)" }}>
          {success ? (
            <>
              <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "#ECFDF5" }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 10 8 14 16 6" />
                </svg>
              </div>
              <p className="text-sm font-medium mb-1" style={{ color: "#1C1917" }}>Your email has been verified</p>
              <p className="text-xs mb-5" style={{ color: "#78716C" }}>Your Kanbedu account is now fully set up.</p>
              <a href="/" className="inline-block px-4 py-2 text-sm font-medium rounded-xl text-white" style={{ backgroundColor: "#1C1917" }}>
                Continue to app →
              </a>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "#FDF0EB" }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#E8613A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="10" cy="10" r="8" />
                  <path d="M10 6v4M10 14h.01" />
                </svg>
              </div>
              <p className="text-sm font-medium mb-1" style={{ color: "#1C1917" }}>Verification failed</p>
              <p className="text-xs mb-5" style={{ color: "#78716C" }}>{errorMessage}</p>
              <a href="/" className="inline-block px-4 py-2 text-sm font-medium rounded-xl text-white" style={{ backgroundColor: "#1C1917" }}>
                Back to app
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
