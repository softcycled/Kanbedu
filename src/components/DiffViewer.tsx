"use client";

import { diffWords } from "diff";
import { useMemo } from "react";

interface Props {
  oldText: string;
  newText: string;
}

export default function DiffViewer({ oldText, newText }: Props) {
  const diff = useMemo(() => {
    return diffWords(oldText, newText);
  }, [oldText, newText]);

  return (
    <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed p-4 bg-column-bg rounded-xl border border-border/40 overflow-x-auto">
      {diff.map((part, index) => {
        const colorClass = part.added
          ? "bg-green-500/20 text-green-700 dark:text-green-300"
          : part.removed
          ? "bg-red-500/20 text-red-700 dark:text-red-300 line-through"
          : "text-ink/70";

        return (
          <span key={index} className={`${colorClass} px-0.5 rounded-sm`}>
            {part.value}
          </span>
        );
      })}
    </div>
  );
}
