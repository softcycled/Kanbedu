export interface ColumnPaletteEntry {
  name:   string;
  bg:     string;
  border: string;
  dot:    string;
  text:   string;
  pill:   string;
}

export const COLUMN_PALETTE: ColumnPaletteEntry[] = [
  {
    name:   "blue",
    bg:     "bg-blue-100 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    dot:    "bg-blue-500 dark:bg-blue-600",
    text:   "text-blue-700 dark:text-blue-300",
    pill:   "bg-blue-500/15 text-blue-600 dark:text-blue-300",
  },
  {
    name:   "orange",
    bg:     "bg-amber-100 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    dot:    "bg-amber-500 dark:bg-amber-600",
    text:   "text-amber-700 dark:text-amber-300",
    pill:   "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  },
  {
    name:   "green",
    bg:     "bg-green-100 dark:bg-green-950/30",
    border: "border-green-200 dark:border-green-800",
    dot:    "bg-green-500 dark:bg-green-600",
    text:   "text-green-700 dark:text-green-300",
    pill:   "bg-green-500/15 text-green-600 dark:text-green-300",
  },
  {
    name:   "purple",
    bg:     "bg-purple-100 dark:bg-purple-950/30",
    border: "border-purple-200 dark:border-purple-800",
    dot:    "bg-purple-500 dark:bg-purple-600",
    text:   "text-purple-700 dark:text-purple-300",
    pill:   "bg-purple-500/15 text-purple-600 dark:text-purple-300",
  },
  {
    name:   "pink",
    bg:     "bg-pink-100 dark:bg-pink-950/30",
    border: "border-pink-200 dark:border-pink-800",
    dot:    "bg-pink-500 dark:bg-pink-600",
    text:   "text-pink-700 dark:text-pink-300",
    pill:   "bg-pink-500/15 text-pink-600 dark:text-pink-300",
  },
  {
    name:   "cyan",
    bg:     "bg-cyan-100 dark:bg-cyan-950/30",
    border: "border-cyan-200 dark:border-cyan-800",
    dot:    "bg-cyan-500 dark:bg-cyan-600",
    text:   "text-cyan-700 dark:text-cyan-300",
    pill:   "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300",
  },
  {
    name:   "yellow",
    bg:     "bg-yellow-100 dark:bg-yellow-950/30",
    border: "border-yellow-200 dark:border-yellow-800",
    dot:    "bg-yellow-500 dark:bg-yellow-600",
    text:   "text-yellow-700 dark:text-yellow-300",
    pill:   "bg-yellow-500/15 text-yellow-600 dark:text-yellow-300",
  },
  {
    name:   "red",
    bg:     "bg-red-100 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800",
    dot:    "bg-red-500 dark:bg-red-600",
    text:   "text-red-700 dark:text-red-300",
    pill:   "bg-red-500/15 text-red-600 dark:text-red-300",
  },
];

// The set of selectable color names, in palette order.
export const COLUMN_COLOR_NAMES: string[] = COLUMN_PALETTE.map((p) => p.name);

// Palette by position — the default when a column has no explicit color.
export function getColumnPalette(index: number): ColumnPaletteEntry {
  return COLUMN_PALETTE[index % COLUMN_PALETTE.length];
}

// Palette by explicit color name, or null when the name is unknown/unset.
export function getColumnPaletteByName(name: string | null | undefined): ColumnPaletteEntry | null {
  if (!name) return null;
  return COLUMN_PALETTE.find((p) => p.name === name) ?? null;
}

// Resolve a column's palette: an explicit color wins, else fall back to position.
export function resolveColumnPalette(color: string | null | undefined, index: number): ColumnPaletteEntry {
  return getColumnPaletteByName(color) ?? getColumnPalette(index);
}
