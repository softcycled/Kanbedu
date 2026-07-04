import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  enabled: process.env.NODE_ENV === "production",

  // Lower sample rate for server transactions to reduce noise
  tracesSampleRate: 0.05,
  sampleRate: 1.0,

  // Capture console.warn so [SECURITY] lines from securityLog.ts reach Sentry.
  integrations: [Sentry.captureConsoleIntegration({ levels: ["warn"] })],

  beforeSend(event) {
    // Drop console-captured events that are not [SECURITY]; real exceptions pass through.
    const msg = event.logentry?.message ?? event.message ?? "";
    const fromConsole = event.extra !== undefined && "arguments" in event.extra;
    if (fromConsole && !String(msg).includes("[SECURITY]")) return null;
    return event;
  },
});
