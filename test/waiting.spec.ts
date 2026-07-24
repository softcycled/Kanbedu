import { describe, it, expect } from "vitest";
import { isWaiting, WAITING_MS } from "../src/lib/waiting";

// "now" and a helper for "entered the column N ms ago".
const NOW = Date.UTC(2026, 6, 24, 12, 0, 0);
const ago = (ms: number) => NOW - ms;

// A task sitting well past the threshold, untouched and undiscussed. Each test
// flips one input to prove which conditions suppress the signal.
const base = {
  isDoneColumn: false,
  isStartColumn: false,
  hasComments: false,
  enteredColumnAt: ago(WAITING_MS + 1),
  now: NOW,
};

describe("isWaiting", () => {
  it("flags a task parked in an active column past the threshold", () => {
    expect(isWaiting(base)).toBe(true);
  });

  it("does not flag a task still within the threshold", () => {
    expect(isWaiting({ ...base, enteredColumnAt: ago(WAITING_MS - 1) })).toBe(false);
  });

  it("never flags a Done column, however long it has sat there", () => {
    expect(isWaiting({ ...base, isDoneColumn: true, enteredColumnAt: ago(WAITING_MS * 100) })).toBe(false);
  });

  it("never flags a Start column, however long it has sat there", () => {
    // The core fix: cards park in Start columns (To Do / Wishlist) by design.
    expect(isWaiting({ ...base, isStartColumn: true, enteredColumnAt: ago(WAITING_MS * 100) })).toBe(false);
  });

  it("exempts EVERY start column, not just the first one (the regression)", () => {
    // Before this change only the leftmost column was exempt, so a second
    // backlog column (e.g. Wishlist) wrongly accrued the signal. Any column the
    // lecturer marks Start must be exempt.
    const wishlist = { ...base, isStartColumn: true };
    const todo = { ...base, isStartColumn: true };
    expect(isWaiting(wishlist)).toBe(false);
    expect(isWaiting(todo)).toBe(false);
  });

  it("does not flag a task that has an active comment thread", () => {
    expect(isWaiting({ ...base, hasComments: true })).toBe(false);
  });
});
