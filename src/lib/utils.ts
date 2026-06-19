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

// A deadline "has a time" when the user explicitly set one. Two stored values are
// treated as date-only (no time): local midnight 00:00:00 (legacy deadlines saved
// before time support) and the end-of-day sentinel 23:59:59 (saved for new
// date-only deadlines). A <input type="time"> only ever emits HH:mm (seconds 0),
// so the :59 sentinel is unreachable by user input — no collision.
export function deadlineHasTime(deadline: Date | string | null): boolean {
  if (!deadline) return false;
  const d = new Date(deadline);
  const h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
  if (h === 0 && m === 0 && s === 0) return false;
  if (h === 23 && m === 59 && s === 59) return false;
  return true;
}

// The instant a deadline is actually "due" for overdue/severity math.
// Timed deadlines use their exact instant; date-only deadlines use end of that day
// so a task due "today" is not overdue until the day fully passes.
export function effectiveDeadlineMs(deadline: Date | string): number {
  const d = new Date(deadline);
  if (deadlineHasTime(d)) return d.getTime();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
}

// "9:00 AM" — only meaningful when deadlineHasTime is true.
export function formatDeadlineTime(date: Date | string | null): string {
  if (!date) return "";
  return new Date(date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function isOverdue(deadline: Date | string | null, completedAt?: Date | string | null): boolean {
  if (!deadline || completedAt) return false;
  return Date.now() > effectiveDeadlineMs(deadline);
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

// "HH:mm" for <input type="time">, or "" when the deadline is date-only.
export function formatTimeForInput(date: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  if (!deadlineHasTime(d)) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// Combine a date input (YYYY-MM-DD) and optional time input (HH:mm) into an ISO
// string. No time -> end-of-day sentinel (23:59:59) so the deadline reads as
// date-only. Returns null when no date is set (deadline removed).
export function combineDateTimeToISO(
  dateStr: string | null | undefined,
  timeStr: string | null | undefined
): string | null {
  if (!dateStr) return null;
  const parts = String(dateStr).split("-");
  if (parts.length !== 3) return new Date(dateStr).toISOString();
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (timeStr) {
    const tp = String(timeStr).split(":");
    const hh = Number(tp[0] || 0);
    const mm = Number(tp[1] || 0);
    return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
  }
  return new Date(y, m - 1, d, 23, 59, 59, 0).toISOString();
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
  const hasTime = deadlineHasTime(d);
  // Date-only deadlines are due at end of day; timed ones at their exact instant.
  const diffMs = effectiveDeadlineMs(d) - now.getTime();
  const timeSuffix = hasTime ? `, ${formatDeadlineTime(d)}` : "";

  // Past (overdue) — time-aware, consistent with isOverdue(): timed deadlines go
  // overdue at their exact instant, date-only ones once the day has fully passed.
  if (diffMs < 0) {
    const absMs = Math.abs(diffMs);
    const days = Math.floor(absMs / 86_400_000);
    if (days >= 1) return { label: `Overdue by ${days}d`, severity: "overdue" };
    const hours = Math.ceil(absMs / 3_600_000);
    return { label: `Overdue by ${hours}h`, severity: "overdue" };
  }

  // Day-boundary diff for relative labels.
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDeadlineDay = new Date(d);
  startOfDeadlineDay.setHours(0, 0, 0, 0);
  const daysUntil = Math.round((startOfDeadlineDay.getTime() - startOfToday.getTime()) / 86_400_000);

  // Due today — show the time when set, else the plain date-only label.
  if (daysUntil === 0) {
    return { label: hasTime ? `Due ${formatDeadlineTime(d)}` : "Due today", severity: "due-soon" };
  }

  // Due tomorrow
  if (daysUntil === 1) {
    return { label: hasTime ? `Tomorrow, ${formatDeadlineTime(d)}` : "Due tomorrow", severity: "due-soon" };
  }

  // Timed deadlines within ~2 days show hours for precision.
  if (hasTime && diffMs <= 48 * 3_600_000) {
    const hours = Math.ceil(diffMs / 3_600_000);
    return { label: `Due in ${hours}h`, severity: "due-soon" };
  }

  // Within a week show days
  if (daysUntil <= 7) {
    return { label: `Due in ${daysUntil}d`, severity: "future" };
  }

  // Otherwise show a concise date (with time when set)
  return { label: `${formatDate(d)}${timeSuffix}`, severity: "future" };
}
