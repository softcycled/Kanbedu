"use client";

import { getPriorityConfig } from "@/lib/priority";

interface Props {
  priority: "low" | "medium" | "high" | "urgent" | string | null | undefined;
  className?: string;
  colorClass?: string; // overrides the default priority-based color
}

const LEVELS: Record<string, number> = { low: 1, medium: 2, high: 3 };

export default function PriorityIcon({ priority, className = "w-3 h-3", colorClass }: Props) {
  const p = (priority ?? "medium") as string;
  const color = colorClass ?? getPriorityConfig(p).text;

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

  // Ascending signal bars for low / medium / high.
  // Three bars aligned to the bottom, increasing in height left to right.
  const level = LEVELS[p] ?? 0;

  return (
    <svg
      className={`flex-shrink-0 ${color} ${className}`}
      viewBox="0 0 14 14"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect opacity={level >= 1 ? 1 : 0.2} x="1"  y="9"  width="3" height="4"  rx="0.5" />
      <rect opacity={level >= 2 ? 1 : 0.2} x="5.5" y="6"  width="3" height="7"  rx="0.5" />
      <rect opacity={level >= 3 ? 1 : 0.2} x="10" y="3"  width="3" height="10" rx="0.5" />
    </svg>
  );
}
