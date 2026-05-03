"use client";

import { Task } from "@/lib/types";

interface Props {
  tasks: Task[];
  boardName: string;
}

export default function Header({ boardName }: Props) {

  return (
    <header className="flex-shrink-0 px-8 pt-6 pb-5 border-b border-border/70">
      <h1 className="text-xl font-bold tracking-tight text-ink">{boardName || "Board"}</h1>
    </header>
  );
}
