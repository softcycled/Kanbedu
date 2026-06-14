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
    <div className="min-h-screen flex items-center justify-center px-4 bg-paper">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold tracking-tight">
            <a href="/landing" className="text-ink no-underline">kanbedu</a>
          </h1>
          <p className="text-sm mt-1 text-muted">
            {success ? "Email verified" : "Verification failed"}
          </p>
        </div>
        <div className="rounded-2xl p-6 text-center bg-card-bg border border-border shadow-card">
          {success ? (
            <>
              <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4 bg-green-500/10">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-green-600 dark:text-green-400" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 10 8 14 16 6" />
                </svg>
              </div>
              <p className="text-sm font-medium mb-1 text-ink">Your email has been verified</p>
              <p className="text-xs mb-5 text-muted">Your Kanbedu account is now fully set up. Log in to continue.</p>
              <a href="/login" className="block w-full py-2.5 text-sm font-medium rounded-xl text-center transition-colors bg-primary text-on-primary hover:bg-primary/90">
                Log in
              </a>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4 bg-red-500/10">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-red-500" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="10" cy="10" r="8" />
                  <path d="M10 6v4M10 14h.01" />
                </svg>
              </div>
              <p className="text-sm font-medium mb-1 text-ink">Verification failed</p>
              <p className="text-xs mb-5 text-muted">{errorMessage}</p>
              <a href="/" className="block w-full py-2.5 text-sm font-medium rounded-xl text-center transition-colors bg-primary text-on-primary hover:bg-primary/90">
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
