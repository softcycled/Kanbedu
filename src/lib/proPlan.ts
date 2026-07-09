// Single source of truth for Lecturer Pro plan copy. Read by both the public
// pricing page and the in-app Settings > Lecturer Pro tab so the two can
// never drift apart. Edit prices and features here only.

// RM160 = exactly 10 months of RM16, so "2 months free" is verifiably true.
// The label below must stay true if either price changes; recompute before editing.
export const PRO_PRICE_MONTHLY = "RM16";
export const PRO_PRICE_YEARLY = "RM160";
export const PRO_YEARLY_DISCOUNT_LABEL = "2 months free";

export const PRO_FEATURES = [
  "Everything in Free",
  "Grading export: every student's tasks, participation, and integrity flags as a spreadsheet",
  "Up to 10 active classes",
  "Unlimited archived classes for past semesters",
  "Clone a finished class into the new semester in one click",
  "Early access to new features",
];
