import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "Kanbedu <noreply@kanbedu.com>";
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const verifyUrl = `${BASE_URL}/verify-email/${token}`;

  if (!process.env.RESEND_API_KEY) {
    // In dev without a key, log the link so you can verify manually
    console.info(`[email] Verification link for ${to}: ${verifyUrl}`);
    return;
  }

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Verify your Kanbedu email",
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#FDFCFA;border-radius:12px;border:1px solid #E2DED8">
        <h1 style="font-size:20px;font-weight:700;color:#1C1917;margin:0 0 8px">Confirm your email</h1>
        <p style="font-size:14px;color:#78716C;margin:0 0 24px">Click the button below to verify your Kanbedu account. This link expires in 24 hours.</p>
        <a href="${verifyUrl}" style="display:inline-block;background:#1C1917;color:#F7F5F0;font-size:14px;font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none">Verify email</a>
        <p style="font-size:12px;color:#A8A29E;margin:24px 0 0">If you didn't create a Kanbedu account, you can safely ignore this email.</p>
      </div>
    `,
  });
}
