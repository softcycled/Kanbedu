// Single source of truth for Lecturer Pro plan copy. Read by both the public
// pricing page and the in-app Settings > Lecturer Pro tab so the two can
// never drift apart. Edit prices and features here only.

// RM99.99/year vs RM9.99 x 12 = RM119.88 is a ~17% discount, not an exact
// month count -- keep the label a plain percentage, not "N months free".
// The label below must stay true if either price changes; recompute before editing.
export const PRO_PRICE_MONTHLY = "RM9.99";
export const PRO_PRICE_YEARLY = "RM99.99";
export const PRO_YEARLY_DISCOUNT_LABEL = "save ~17%";
// Shown wherever prices appear until Pro is purchasable. Remove at launch.
export const PRO_PRICE_DISCLAIMER = "Prices may change until Lecturer Pro officially launches.";

export const PRO_FEATURES = [
  "Everything in Free",
  "Grading export: every student's tasks, participation, and integrity flags as a spreadsheet",
  "Up to 10 active classes",
  "Unlimited archived classes for past semesters",
  "Clone a finished class into the new semester in one click",
  "Early access to new features",
];
