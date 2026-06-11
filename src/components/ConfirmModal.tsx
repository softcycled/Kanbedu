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
    <div data-modal-open role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-[2px] motion-safe:animate-fade-in">
      <div className="bg-card-bg rounded-2xl shadow-modal w-full max-w-sm motion-safe:animate-modal-in p-6">
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
