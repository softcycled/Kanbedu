"use client";

interface Props {
  priority: "low" | "medium" | "high" | "urgent" | string | null | undefined;
  className?: string;
  colorClass?: string; // overrides the default priority-based color
}

const DEFAULT_COLOR: Record<string, string> = {
  urgent: "text-red-500 dark:text-red-400",
  high:   "text-orange-500 dark:text-orange-400",
  medium: "text-yellow-500 dark:text-yellow-400",
  low:    "text-blue-500 dark:text-blue-400",
};

const LEVELS: Record<string, number> = { low: 1, medium: 2, high: 3 };

export default function PriorityIcon({ priority, className = "w-3 h-3", colorClass }: Props) {
  const p = (priority ?? "medium") as string;
  const color = colorClass ?? DEFAULT_COLOR[p] ?? "text-muted";

  if (p === "urgent") {
    return (
      <svg
        className={`flex-shrink-0 ${color} ${className}`}
        viewBox="0 0 14 14"
        fill="currentColor"
        aria-hidden="true"
      >
        <rect x="6" y="2" width="2" height="7" rx="1" />
        <circle cx="7" cy="12" r="1.1" />
      </svg>
    );
  }

  // Wifi-bar arcs for low / medium / high.
  // All arcs share center (7, 14) with ±45° spread.
  // r = n·2√2 so endpoints land on clean integers.
  const level = LEVELS[p] ?? 0;

  return (
    <svg
      className={`flex-shrink-0 ${color} ${className}`}
      viewBox="0 0 14 14"
      aria-hidden="true"
    >
      <circle cx="7" cy="13" r="0.85" fill="currentColor" />
      <path
        fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
        opacity={level >= 1 ? 1 : 0.2}
        d="M 5 12 A 2.83 2.83 0 0 1 9 12"
      />
      <path
        fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
        opacity={level >= 2 ? 1 : 0.2}
        d="M 3 10 A 5.66 5.66 0 0 1 11 10"
      />
      <path
        fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
        opacity={level >= 3 ? 1 : 0.2}
        d="M 1 8 A 8.49 8.49 0 0 1 13 8"
      />
    </svg>
  );
}
