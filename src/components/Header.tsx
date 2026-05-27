"use client";

import EmailVerificationBanner from "./EmailVerificationBanner";

interface Props {
  boardName: string;
}

export default function Header({ boardName }: Props) {
  return (
    <div className="flex-shrink-0 flex flex-col">
      <EmailVerificationBanner />
      <header className="px-4 md:px-8 pt-4 md:pt-6 pb-4 md:pb-5 border-b border-border/70">
        <h1 className="text-lg md:text-xl font-bold tracking-tight text-ink pl-14 md:pl-0">{boardName || "Board"}</h1>
      </header>
    </div>
  );
}
