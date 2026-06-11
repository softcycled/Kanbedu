const FROM_NAME = "Kanbedu";
const FROM_EMAIL = "noreply@kanbedu.com";
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const verifyUrl = `${BASE_URL}/verify-email/${token}`;

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
