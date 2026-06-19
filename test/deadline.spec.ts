import { describe, it, expect } from "vitest";
import {
  deadlineHasTime,
  combineDateTimeToISO,
  formatDateForInput,
  formatTimeForInput,
  isOverdue,
  formatDeadlineLabel,
} from "../src/lib/utils";

// Build a YYYY-MM-DD string for a date N days from now (local).
function dateStrOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

describe("deadlineHasTime", () => {
  it("treats local midnight (legacy date-only) as no time", () => {
    expect(deadlineHasTime(new Date(2026, 5, 15, 0, 0, 0))).toBe(false);
  });
  it("treats the 23:59:59 end-of-day sentinel as no time", () => {
    expect(deadlineHasTime(new Date(2026, 5, 15, 23, 59, 59))).toBe(false);
  });
  it("treats an explicit time as having a time", () => {
    expect(deadlineHasTime(new Date(2026, 5, 15, 9, 30, 0))).toBe(true);
  });
  it("returns false for null", () => {
    expect(deadlineHasTime(null)).toBe(false);
  });
});

describe("combineDateTimeToISO round-trip", () => {
  it("preserves date and time when a time is set", () => {
    const iso = combineDateTimeToISO("2026-06-15", "09:30");
    expect(iso).not.toBeNull();
    expect(formatDateForInput(iso)).toBe("2026-06-15");
    expect(formatTimeForInput(iso)).toBe("09:30");
    expect(deadlineHasTime(iso!)).toBe(true);
  });

  it("stores a date-only deadline as end-of-day (no time on read back)", () => {
    const iso = combineDateTimeToISO("2026-06-15", "");
    expect(iso).not.toBeNull();
    expect(formatDateForInput(iso)).toBe("2026-06-15");
    expect(formatTimeForInput(iso)).toBe("");
    expect(deadlineHasTime(iso!)).toBe(false);
  });

  it("returns null when no date is set (deadline removed)", () => {
    expect(combineDateTimeToISO("", "09:00")).toBeNull();
    expect(combineDateTimeToISO(null, null)).toBeNull();
    expect(combineDateTimeToISO(undefined, "10:00")).toBeNull();
  });
});

describe("isOverdue (smart end-of-day default)", () => {
  it("a date-only deadline for today is not overdue", () => {
    expect(isOverdue(combineDateTimeToISO(dateStrOffset(0), ""))).toBe(false);
  });
  it("a date-only deadline for yesterday is overdue", () => {
    expect(isOverdue(combineDateTimeToISO(dateStrOffset(-1), ""))).toBe(true);
  });
  it("a timed deadline in the past is overdue", () => {
    expect(isOverdue(new Date(Date.now() - 3_600_000).toISOString())).toBe(true);
  });
  it("a timed deadline in the future is not overdue", () => {
    expect(isOverdue(new Date(Date.now() + 3_600_000).toISOString())).toBe(false);
  });
  it("a completed task is never overdue", () => {
    expect(isOverdue(combineDateTimeToISO(dateStrOffset(-5), ""), new Date())).toBe(false);
  });
  it("no deadline is never overdue", () => {
    expect(isOverdue(null)).toBe(false);
  });
});

describe("formatDeadlineLabel", () => {
  it("includes the time for a far-future timed deadline", () => {
    const { label, severity } = formatDeadlineLabel(combineDateTimeToISO(dateStrOffset(30), "14:00"));
    expect(severity).toBe("future");
    expect(label).toContain(":"); // e.g. "Jul 13, 2026, 2:00 PM"
  });
  it("omits the time for a far-future date-only deadline", () => {
    const { label, severity } = formatDeadlineLabel(combineDateTimeToISO(dateStrOffset(30), ""));
    expect(severity).toBe("future");
    expect(label).not.toContain(":");
  });
  it("returns none severity for no deadline", () => {
    expect(formatDeadlineLabel(null).severity).toBe("none");
  });
});
