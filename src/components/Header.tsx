"use client";

interface Props {
  boardName: string;
}

export default function Header({ boardName }: Props) {

  return (
    <header className="flex-shrink-0 px-4 md:px-8 pt-4 md:pt-6 pb-4 md:pb-5 border-b border-border/70">
      <h1 className="text-lg md:text-xl font-bold tracking-tight text-ink pl-14 md:pl-0">{boardName || "Board"}</h1>
    </header>
  );
}
