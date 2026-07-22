// Single source of truth for the "Waiting" signal.
//
// A task is "waiting" when it has sat in an active work column, untouched and
// undiscussed, past the threshold below. This same rule powers both the
// educator Monitor overview and a board's Analytics panel, so the count means
// the same thing in both places and can never quietly drift apart.
//
// Framing note: this is a help signal for lecturers ("someone might be stuck
// here, worth a gentle check-in"), never a ranking or a verdict on students.
// The user-facing label is always "Waiting" — never "stalled" or "stagnant",
// which read as blame and make lecturers press students over tasks that are
// simply parked. Keep that wording out of any UI copy.

export const WAITING_DAYS = 5;
export const WAITING_MS = WAITING_DAYS * 24 * 60 * 60 * 1000;

export interface WaitingInput {
  /** Task's current column is a Done column — finished work is never waiting. */
  isDoneColumn: boolean;
  /** Current column is the intake column (To Do / Backlog / Wishlist). Cards
   *  sit there by design until someone picks them up, so backlog is never
   *  "waiting". */
  isFirstColumn: boolean;
  /** The task has at least one comment. An active thread means someone is
   *  already on it, so it isn't sitting there ignored. */
  hasComments: boolean;
  /** Epoch ms the task entered its current column. */
  enteredColumnAt: number;
  /** Epoch ms "now". */
  now: number;
}

export function isWaiting({
  isDoneColumn,
  isFirstColumn,
  hasComments,
  enteredColumnAt,
  now,
}: WaitingInput): boolean {
  if (isDoneColumn || isFirstColumn || hasComments) return false;
  return now - enteredColumnAt > WAITING_MS;
}
