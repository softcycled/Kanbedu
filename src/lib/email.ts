const FROM_NAME = "Kanbedu";
const FROM_EMAIL = "noreply@kanbedu.com";
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Returns today's sent count (requests) from Brevo's statistics API.
// Returns null if the API key is missing or the request fails.
export async function getBrevoTodayStats(): Promise<{ sent: number; limit: number } | null> {
  if (!process.env.BREVO_API_KEY) return null;
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const res = await fetch(
      `https://api.brevo.com/v3/smtp/statistics/reports?startDate=${today}&endDate=${today}`,
      { headers: { "api-key": process.env.BREVO_API_KEY }, next: { revalidate: 0 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const report = Array.isArray(data?.reports) ? data.reports[0] : null;
    const sent = typeof report?.requests === "number" ? report.requests : 0;
    return { sent, limit: 300 };
  } catch {
    return null;
  }
}

function emailLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F5F0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="padding:40px 16px 32px">

    <!-- Wordmark -->
    <div style="text-align:center;margin-bottom:24px">
      <span style="font-size:22px;font-weight:700;color:#1C1917;letter-spacing:-0.5px">kanbedu</span>
    </div>

    <!-- Card -->
    <div style="max-width:480px;margin:0 auto;background:#FDFCFA;border-radius:14px;border:1px solid #E2DED8;padding:36px 32px;box-shadow:0 2px 8px rgba(26,24,20,0.06)">
      ${content}
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:24px">
      <p style="font-size:11px;color:#A8A29E;margin:0">
        © ${new Date().getFullYear()} Kanbedu &nbsp;·&nbsp;
        <a href="mailto:support@kanbedu.com" style="color:#A8A29E;text-decoration:underline">support@kanbedu.com</a>
      </p>
    </div>

  </div>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `<a href="${href}" style="display:block;text-align:center;background:#1C1917;color:#F7F5F0;font-size:14px;font-weight:600;padding:13px 24px;border-radius:10px;text-decoration:none;margin:24px 0 0">${label}</a>`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!process.env.BREVO_API_KEY) {
    console.info(`[email] No BREVO_API_KEY — would send "${subject}" to ${to}`);
    return;
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo email failed (${res.status}): ${body}`);
  }
}

export async function sendClassInviteEmail(to: string, studentName: string, className: string, joinUrl: string): Promise<void> {
  const content = `
    <h1 style="font-size:18px;font-weight:700;color:#1C1917;margin:0 0 8px">You've been added to a class</h1>
    <p style="font-size:14px;color:#78716C;margin:0;line-height:1.6">
      Hi ${studentName}, your educator has added you to <strong style="color:#1C1917">${className}</strong> on Kanbedu.
      Click the button below to join. You'll need to create an account if you don't have one yet.
    </p>
    ${ctaButton(joinUrl, "Join class")}
    <p style="font-size:12px;color:#A8A29E;margin:20px 0 0;line-height:1.6">
      If you weren't expecting this, you can safely ignore this email.
    </p>`;

  await sendEmail(to, `You've been added to ${className}`, emailLayout(content));
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const resetUrl = `${BASE_URL}/reset-password/${token}`;

  const content = `
    <h1 style="font-size:18px;font-weight:700;color:#1C1917;margin:0 0 8px">Reset your password</h1>
    <p style="font-size:14px;color:#78716C;margin:0;line-height:1.6">
      We received a request to reset the password for your Kanbedu account.
      Click the button below to set a new password. This link expires in <strong style="color:#1C1917">1 hour</strong>.
    </p>
    ${ctaButton(resetUrl, "Reset password")}
    <p style="font-size:12px;color:#A8A29E;margin:20px 0 0;line-height:1.6">
      If you didn't request a password reset, you can safely ignore this email. Your password won't change.
    </p>`;

  await sendEmail(to, "Reset your Kanbedu password", emailLayout(content));
}

export async function sendVerificationEmail(to: string, token: string, next?: string): Promise<void> {
  const verifyUrl = next
    ? `${BASE_URL}/verify-email/${token}?next=${encodeURIComponent(next)}`
    : `${BASE_URL}/verify-email/${token}`;

  const content = `
    <h1 style="font-size:18px;font-weight:700;color:#1C1917;margin:0 0 8px">Confirm your email</h1>
    <p style="font-size:14px;color:#78716C;margin:0;line-height:1.6">
      Thanks for signing up. Click the button below to verify your email address and activate your Kanbedu account.
      This link expires in <strong style="color:#1C1917">24 hours</strong>.
    </p>
    ${ctaButton(verifyUrl, "Verify email address")}
    <p style="font-size:12px;color:#A8A29E;margin:20px 0 0;line-height:1.6">
      If you didn't create a Kanbedu account, you can safely ignore this email.
    </p>`;

  await sendEmail(to, "Verify your Kanbedu email", emailLayout(content));
}
