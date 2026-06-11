"use client";

import EmailVerificationBanner from "./EmailVerificationBanner";
import NotificationBell from "./NotificationBell";

interface Props {
  boardName: string;
}

export default function Header({ boardName }: Props) {
  return (
    <div className="flex-shrink-0 flex flex-col">
      <EmailVerificationBanner />
      <header className="px-4 md:px-8 pt-4 md:pt-6 pb-4 md:pb-5 border-b border-border/70">
        <div className="flex items-center justify-between pl-14 md:pl-0">
          <h1 className="text-lg md:text-xl font-bold tracking-tight text-ink">{boardName || "Board"}</h1>
          <NotificationBell />
        </div>
      </header>
    </div>
  );
}
