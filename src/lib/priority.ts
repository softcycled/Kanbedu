export const PRIORITY_CONFIG = {
  urgent: {
    label:    "URGENT",
    dot:      "bg-red-500",
    text:     "text-red-500 dark:text-red-400",
    badge:    "bg-red-500/10 text-red-500",
  },
  high: {
    label:    "High",
    dot:      "bg-orange-500",
    text:     "text-orange-500 dark:text-orange-400",
    badge:    "bg-orange-500/10 text-orange-500",
  },
  medium: {
    label:    "Med",
    dot:      "bg-yellow-500",
    text:     "text-yellow-600 dark:text-yellow-300",
    badge:    "bg-yellow-500/10 text-yellow-600",
  },
  low: {
    label:    "Low",
    dot:      "bg-blue-500",
    text:     "text-blue-500 dark:text-blue-400",
    badge:    "bg-blue-500/10 text-blue-500",
  },
} as const;

export type Priority = keyof typeof PRIORITY_CONFIG;

export const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0, high: 1, medium: 2, low: 3,
};

export function getPriorityConfig(priority: string | null | undefined) {
  return PRIORITY_CONFIG[(priority ?? "medium") as Priority] ?? PRIORITY_CONFIG.medium;
}
