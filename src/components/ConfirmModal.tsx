"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onClose,
  onConfirm,
}: Props) {
  const [processing, setProcessing] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) confirmRef.current?.focus();
  }, [isOpen]);

  // Escape closes the dialog and background scroll is locked while it's open.
  // stopPropagation keeps the Esc from bubbling to ClassWorkspace's handler.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !processing) { e.stopPropagation(); onClose(); }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, processing, onClose]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      setProcessing(true);
      await onConfirm();
    } catch (err) {
      // swallow - parent should handle errors
      console.error("ConfirmModal action failed:", err);
    } finally {
      setProcessing(false);
      onClose();
    }
  };

  const confirmBtnClass = danger
    ? "px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
    : "px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50";

  return (
    <div
      data-modal-open
      role="dialog"
      aria-modal="true"
      onClick={() => { if (!processing) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-[2px] motion-safe:animate-fade-in"
    >
      <div onClick={(e) => e.stopPropagation()} className="bg-card-bg rounded-2xl shadow-modal w-full max-w-sm motion-safe:animate-modal-in p-6">
        {title && <p className="text-sm font-semibold text-ink">{title}</p>}
        <p className="text-xs text-muted mt-1">{message}</p>
        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            disabled={processing}
            className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-ink hover:bg-column-bg transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button ref={confirmRef} onClick={handleConfirm} disabled={processing} className={confirmBtnClass}>
            {processing ? `${confirmLabel}…` : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
