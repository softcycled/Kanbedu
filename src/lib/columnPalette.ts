export interface ColumnPaletteEntry {
  bg:     string;
  border: string;
  dot:    string;
  text:   string;
  pill:   string;
}

export const COLUMN_PALETTE: ColumnPaletteEntry[] = [
  {
    bg:     "bg-blue-100 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    dot:    "bg-blue-500 dark:bg-blue-400",
    text:   "text-blue-700 dark:text-blue-300",
    pill:   "bg-blue-500/15 text-blue-600 dark:text-blue-300",
  },
  {
    bg:     "bg-amber-100 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    dot:    "bg-amber-500 dark:bg-amber-400",
    text:   "text-amber-700 dark:text-amber-300",
    pill:   "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  },
  {
    bg:     "bg-green-100 dark:bg-green-950/30",
    border: "border-green-200 dark:border-green-800",
    dot:    "bg-green-500 dark:bg-green-400",
    text:   "text-green-700 dark:text-green-300",
    pill:   "bg-green-500/15 text-green-600 dark:text-green-300",
  },
  {
    bg:     "bg-purple-100 dark:bg-purple-950/30",
    border: "border-purple-200 dark:border-purple-800",
    dot:    "bg-purple-500 dark:bg-purple-400",
    text:   "text-purple-700 dark:text-purple-300",
    pill:   "bg-purple-500/15 text-purple-600 dark:text-purple-300",
  },
  {
    bg:     "bg-pink-100 dark:bg-pink-950/30",
    border: "border-pink-200 dark:border-pink-800",
    dot:    "bg-pink-500 dark:bg-pink-400",
    text:   "text-pink-700 dark:text-pink-300",
    pill:   "bg-pink-500/15 text-pink-600 dark:text-pink-300",
  },
  {
    bg:     "bg-cyan-100 dark:bg-cyan-950/30",
    border: "border-cyan-200 dark:border-cyan-800",
    dot:    "bg-cyan-500 dark:bg-cyan-400",
    text:   "text-cyan-700 dark:text-cyan-300",
    pill:   "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300",
  },
  {
    bg:     "bg-yellow-100 dark:bg-yellow-950/30",
    border: "border-yellow-200 dark:border-yellow-800",
    dot:    "bg-yellow-500 dark:bg-yellow-400",
    text:   "text-yellow-700 dark:text-yellow-300",
    pill:   "bg-yellow-500/15 text-yellow-600 dark:text-yellow-300",
  },
  {
    bg:     "bg-rose-100 dark:bg-rose-950/30",
    border: "border-rose-200 dark:border-rose-800",
    dot:    "bg-rose-500 dark:bg-rose-400",
    text:   "text-rose-700 dark:text-rose-300",
    pill:   "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  },
];

export function getColumnPalette(index: number): ColumnPaletteEntry {
  return COLUMN_PALETTE[index % COLUMN_PALETTE.length];
}
