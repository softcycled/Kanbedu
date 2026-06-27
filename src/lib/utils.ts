export function timeInColumn(columnUpdatedAt: Date | string): string {
  const updated = new Date(columnUpdatedAt);
  const now = new Date();
  const diffMs = now.getTime() - updated.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m`;

  const hours = Math.floor(diffMins / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (remainingHours === 0) return `${days}d`;
  return `${days}d ${remainingHours}h`;
}

// Date-only deadlines: a task is overdue once its deadline day has fully passed.
export function isOverdue(deadline: Date | string | null, completedAt?: Date | string | null): boolean {
  if (!deadline || completedAt) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(deadline);
  d.setHours(0, 0, 0, 0);
  return d.getTime() < now.getTime();
}

export function formatDate(date: Date | string | null): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateForInput(date: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Convert a date input (YYYY-MM-DD) to an ISO string at local midnight, or null
// when no date is set (deadline removed).
export function dateInputToISOString(input: string | null | undefined): string | null {
  if (!input) return null;
  const parts = String(input).split("-");
  if (parts.length !== 3) return new Date(input).toISOString();
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  return new Date(y, m - 1, d).toISOString();
}

export function formatDateTime(date: Date | string | null): string {
  if (!date) return "";
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTimeAgo(date: Date | string | null | undefined): string {
  if (!date) return "just now";

  const ts = new Date(date).getTime();
  const now = Date.now();
  const diffSeconds = Math.round((now - ts) / 1000);
  const absSeconds = Math.abs(diffSeconds);

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (absSeconds < 60) return "just now";

  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) return rtf.format(-diffMinutes, "minute");

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(-diffHours, "hour");

  const diffDays = Math.round(diffHours / 24);
  return rtf.format(-diffDays, "day");
}

export type DeadlineSeverity = "overdue" | "due-soon" | "future" | "none";

export function formatDeadlineLabel(deadline: Date | string | null, completedAt?: Date | string | null): { label: string; severity: DeadlineSeverity } {
  if (!deadline || completedAt) return { label: "", severity: "none" };

  const now = new Date();
  const d = new Date(deadline);

  // Date-only comparison: a task is not overdue until the deadline day has passed.
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDeadlineDay = new Date(d);
  startOfDeadlineDay.setHours(0, 0, 0, 0);
  const daysUntil = Math.round((startOfDeadlineDay.getTime() - startOfToday.getTime()) / 86_400_000);

  if (daysUntil < 0) {
    const days = Math.abs(daysUntil);
    return { label: `Overdue by ${days}d`, severity: "overdue" };
  }
  if (daysUntil === 0) {
    return { label: "Due today", severity: "due-soon" };
  }
  if (daysUntil === 1) {
    return { label: "Due tomorrow", severity: "due-soon" };
  }
  if (daysUntil <= 7) {
    return { label: `Due in ${daysUntil}d`, severity: "future" };
  }
  return { label: formatDate(d), severity: "future" };
}
