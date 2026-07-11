// In-house, self-hosted usage tracking. Events land in the AnalyticsEvent
// table (see prisma/schema.prisma) and never leave our own database — no
// third-party analytics vendor, since some classes include minors' data.
// Keep the event list short and the metadata shallow; this is meant to
// answer "what do people actually use," not to log full activity.

export const ANALYTICS_EVENTS = [
  "panel_view",
  "board_view",
  "task_created",
  "task_moved",
  "task_completed",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export type AnalyticsMetadata = Record<string, string | number | boolean>;

function detectDevice(): "desktop" | "mobile" {
  if (typeof window === "undefined") return "desktop";
  return window.matchMedia("(min-width: 768px)").matches ? "desktop" : "mobile";
}

// Fire-and-forget: never blocks the UI, never throws, never surfaces an
// error to the user. Losing an analytics event is fine; breaking the app
// to record one is not.
export function trackEvent(event: AnalyticsEventName, metadata?: AnalyticsMetadata): void {
  if (typeof window === "undefined") return;
  try {
    const payload = JSON.stringify({ event, device: detectDevice(), metadata });
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon("/api/analytics/track", blob)) return;
    }
    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // never let tracking break the app
  }
}
