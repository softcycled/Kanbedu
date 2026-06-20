import { describe, it, expect } from "vitest";
import {
  dateInputToISOString,
  formatDateForInput,
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

describe("dateInputToISOString", () => {
  it("round-trips a date input through ISO", () => {
    const iso = dateInputToISOString("2026-06-15");
    expect(iso).not.toBeNull();
    expect(formatDateForInput(iso)).toBe("2026-06-15");
  });
  it("returns null when no date is set (deadline removed)", () => {
    expect(dateInputToISOString("")).toBeNull();
    expect(dateInputToISOString(null)).toBeNull();
    expect(dateInputToISOString(undefined)).toBeNull();
  });
});

describe("isOverdue (date-only)", () => {
  it("a deadline for today is not overdue", () => {
    expect(isOverdue(dateInputToISOString(dateStrOffset(0)))).toBe(false);
  });
  it("a deadline for yesterday is overdue", () => {
    expect(isOverdue(dateInputToISOString(dateStrOffset(-1)))).toBe(true);
  });
  it("a future deadline is not overdue", () => {
    expect(isOverdue(dateInputToISOString(dateStrOffset(5)))).toBe(false);
  });
  it("a completed task is never overdue", () => {
    expect(isOverdue(dateInputToISOString(dateStrOffset(-5)), new Date())).toBe(false);
  });
  it("no deadline is never overdue", () => {
    expect(isOverdue(null)).toBe(false);
  });
});

describe("formatDeadlineLabel (date-only)", () => {
  it("today -> Due today", () => {
    expect(formatDeadlineLabel(dateInputToISOString(dateStrOffset(0))).label).toBe("Due today");
  });
  it("tomorrow -> Due tomorrow", () => {
    expect(formatDeadlineLabel(dateInputToISOString(dateStrOffset(1))).label).toBe("Due tomorrow");
  });
  it("a past deadline is overdue severity", () => {
    expect(formatDeadlineLabel(dateInputToISOString(dateStrOffset(-2))).severity).toBe("overdue");
  });
  it("far future is future severity with no time in the label", () => {
    const { label, severity } = formatDeadlineLabel(dateInputToISOString(dateStrOffset(30)));
    expect(severity).toBe("future");
    expect(label).not.toContain(":");
  });
  it("no deadline returns none severity", () => {
    expect(formatDeadlineLabel(null).severity).toBe("none");
  });
});
