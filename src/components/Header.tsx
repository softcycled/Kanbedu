"use client";

import { Task } from "@/lib/types";

interface Props {
  tasks: Task[];
}

export default function Header({ tasks }: Props) {

  return (
    <header className="flex-shrink-0 px-8 pt-8 pb-7 border-b border-border/40">
      <div className="flex items-start justify-between">
        {/* Left section */}
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            kanbedu
          </h1>
          <span className="text-xs text-muted">group project board</span>
        </div>

        <div className="text-xs text-muted" />
      </div>
    </header>
  );
}
