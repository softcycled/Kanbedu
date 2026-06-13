import { Suspense } from "react";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Invalid or expired verification link.",
  expired: "This verification link has expired. Please request a new one.",
  unknown: "Something went wrong. Please try again.",
};

function DoneContent({ searchParams }: { searchParams: { error?: string } }) {
  const error = searchParams.error;
  const success = !error;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.unknown) : "";

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#F7F5F0" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold tracking-tight">
            <a href="/landing" style={{ color: "#1C1917", textDecoration: "none" }}>kanbedu</a>
          </h1>
          <p className="text-sm mt-1" style={{ color: "#78716C" }}>
            {success ? "Email verified" : "Verification failed"}
          </p>
        </div>
        <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: "#FDFCFA", border: "1px solid #E2DED8", boxShadow: "0 2px 8px rgba(26,24,20,0.06)" }}>
          {success ? (
            <>
              <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "#ECFDF5" }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 10 8 14 16 6" />
                </svg>
              </div>
              <p className="text-sm font-medium mb-1" style={{ color: "#1C1917" }}>Your email has been verified</p>
              <p className="text-xs mb-5" style={{ color: "#78716C" }}>Your Kanbedu account is now fully set up. Log in to continue.</p>
              <a href="/login" className="block w-full py-2.5 text-sm font-medium rounded-xl text-center" style={{ backgroundColor: "#1C1917", color: "#F7F5F0" }}>
                Log in
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
              <a href="/" className="block w-full py-2.5 text-sm font-medium rounded-xl text-center" style={{ backgroundColor: "#1C1917", color: "#F7F5F0" }}>
                Back to app
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default async function VerifyDonePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  return (
    <Suspense>
      <DoneContent searchParams={sp} />
    </Suspense>
  );
}
