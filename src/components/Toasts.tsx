"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type Toast = {
  id: string;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number; // ms
};

type ToastContextType = {
  push: (t: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function useToasts() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToasts must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, number>>({});

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2, 9);
    const defaultDuration = t.actionLabel ? 6500 : 4000;
    const toast: Toast = { id, duration: defaultDuration, ...t };
    setToasts((s) => [toast, ...s]);
    if (toast.duration && toast.duration > 0) {
      const timer = window.setTimeout(() => {
        setToasts((s) => s.filter((x) => x.id !== id));
        delete timers.current[id];
      }, toast.duration);
      timers.current[id] = timer;
    }
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((s) => s.filter((x) => x.id !== id));
    if (timers.current[id]) {
      window.clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach((t) => window.clearTimeout(t));
    };
  }, []);

  return (
    <ToastContext.Provider value={{ push, dismiss }}>
      {children}
      <div className="fixed right-6 bottom-20 md:bottom-6 z-50 flex flex-col-reverse gap-3 items-end">
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const hasAction = !!(toast.actionLabel && toast.onAction);
  const dismissBtn = (
    <button onClick={onClose} className="flex-shrink-0 p-1 rounded-md text-muted hover:bg-column-bg transition-colors" aria-label="Dismiss">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto max-w-sm w-full bg-card-bg border border-border rounded-lg shadow-card px-4 py-4 text-ink"
      style={{
        transform: mounted ? "translateY(0)" : "translateY(8px)",
        opacity: mounted ? 1 : 0,
        transition: "transform var(--motion-default) var(--motion-ease), opacity var(--motion-default) ease-out",
        willChange: "transform, opacity",
      }}
    >
      {hasAction ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm leading-snug">
              <span className="text-muted">{toast.title}: </span>
              <span className="font-semibold text-ink">{toast.description}</span>
            </p>
            {dismissBtn}
          </div>
          <p className="text-xs text-muted mt-1.5 leading-relaxed">
            Deleted items are gone for good once this closes. Undo now to restore it.
          </p>
          <div className="mt-3">
            <button
              onClick={() => { try { toast.onAction?.(); } finally { onClose(); } }}
              className="text-sm font-semibold text-ink hover:text-ink/60 transition-colors"
            >
              {toast.actionLabel}
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            {toast.title && <div className="text-sm font-medium truncate">{toast.title}</div>}
            {toast.description && <div className="text-xs text-muted truncate mt-0.5">{toast.description}</div>}
          </div>
          {dismissBtn}
        </div>
      )}
    </div>
  );
}

export default ToastProvider;
