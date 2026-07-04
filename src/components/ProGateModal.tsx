"use client";

import { useEffect } from "react";
import Link from "next/link";

interface Props {
  isOpen: boolean;
  title: string;
  description: string;
  onClose: () => void;
  onBack?: () => void; // "Back" button action; defaults to closing
  backLabel?: string;
}

// Centered "join the Pro waitlist" dialog. Visually identical to the free-plan
// limit modal in CreateJoinClassModal so every Pro gate looks the same.
export default function ProGateModal({ isOpen, title, description, onClose, onBack, backLabel = "Back" }: Props) {
  // stopPropagation keeps Escape from bubbling to ClassWorkspace's handler
  // (which would close the open board) when this is shown inside a class.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      data-modal-open
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-[2px] motion-safe:animate-fade-in"
    >
      <div onClick={(e) => e.stopPropagation()} className="bg-card-bg rounded-2xl shadow-modal w-full max-w-sm motion-safe:animate-modal-in p-6 relative">
        <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 p-1 rounded-lg text-muted hover:text-ink hover:bg-column-bg transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <p className="text-sm text-muted mt-2 leading-relaxed">{description}</p>
        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onBack ?? onClose} className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-ink hover:bg-column-bg transition-colors">{backLabel}</button>
          <Link href="/pricing" onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-on-primary hover:bg-primary/90 transition-colors">Join Pro waitlist</Link>
        </div>
      </div>
    </div>
  );
}
