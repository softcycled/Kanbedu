"use client";

interface Props {
  priority: "low" | "medium" | "high" | "urgent" | string | null | undefined;
  className?: string;
}

const LEVELS: Record<string, number> = { low: 1, medium: 2, high: 3, urgent: 4 };

export default function PriorityIcon({ priority, className = "w-3 h-3" }: Props) {
  const p = (priority ?? "medium") as string;
  const level = LEVELS[p] ?? 0;

  const fillClass =
    p === "urgent" ? "fill-red-500 dark:fill-red-400" :
    p === "high"   ? "fill-orange-500 dark:fill-orange-400" :
    p === "medium" ? "fill-yellow-500 dark:fill-yellow-400" :
    p === "low"    ? "fill-blue-500 dark:fill-blue-400" :
                     "fill-muted";

  return (
    <svg className={`flex-shrink-0 ${className}`} viewBox="0 0 14 14" aria-hidden="true">
      <rect className={fillClass} opacity={level >= 1 ? 1 : 0.25} x="2"  y="9" width="2" height="4"  rx="0.5" />
      <rect className={fillClass} opacity={level >= 2 ? 1 : 0.25} x="6"  y="6" width="2" height="7"  rx="0.5" />
      <rect className={fillClass} opacity={level >= 3 ? 1 : 0.25} x="10" y="3" width="2" height="10" rx="0.5" />
      {level >= 4 && <circle cx="11" cy="1.5" r="1" className={fillClass} />}
    </svg>
  );
}
