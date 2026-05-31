import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function VerifyEmailPage({ params }: Props) {
  const { token } = await params;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
    cache: "no-store",
  });

  if (res.ok) {
    redirect("/?verified=1");
  }

  const data = await res.json().catch(() => ({}));
  const message = data.error ?? "Something went wrong. Please try again.";

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#F7F5F0" }}>
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold tracking-tight mb-2"><a href="/landing" style={{ color: "#1C1917", textDecoration: "none" }}>kanbedu</a></h1>
        <div className="rounded-2xl p-6 mt-6" style={{ backgroundColor: "#FDFCFA", border: "1px solid #E2DED8", boxShadow: "0 2px 8px rgba(26,24,20,0.06)" }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "#FDF0EB" }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#E8613A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10" cy="10" r="8" />
              <path d="M10 6v4M10 14h.01" />
            </svg>
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: "#1C1917" }}>Verification failed</p>
          <p className="text-xs" style={{ color: "#78716C" }}>{message}</p>
          <a href="/" className="inline-block mt-5 px-4 py-2 text-sm font-medium rounded-xl text-white" style={{ backgroundColor: "#1C1917" }}>
            Back to app
          </a>
        </div>
      </div>
    </div>
  );
}
