import type { ReactNode } from "react";

interface Props {
  name: string;
  badge?: ReactNode;
  onOpenBoard: () => void;
}

export default function GroupCardHeader({ name, badge, onOpenBoard }: Props) {
  return (
    <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-border/60">
      <div className="flex items-center gap-2 min-w-0">
        <h3 className="text-sm font-semibold text-ink truncate">{name}</h3>
        {badge}
      </div>
      <button
        onClick={onOpenBoard}
        className="text-sm text-muted hover:text-ink transition-colors flex-shrink-0"
      >
        Open board
      </button>
    </div>
  );
}
