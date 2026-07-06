"use client";

import { useEffect, useRef, RefObject, ReactNode } from "react";

interface DropdownMenuProps {
  open: boolean;
  onClose: () => void;
  // Ref on the trigger button. Clicks on the trigger count as "inside" so the
  // trigger's own onClick can toggle open/closed without this outside-click
  // handler fighting it (a closed-then-reopened flicker otherwise).
  anchorRef: RefObject<HTMLElement | null>;
  align?: "left" | "right";
  role?: string;
  className?: string;
  children: ReactNode;
}

// Shared dropdown/menu panel: positioning, outside-click, and Escape are all
// handled here so no call site needs to reimplement them. Escape always calls
// stopPropagation so it never bubbles to a parent Escape handler (closing a
// modal, navigating home, etc).
export function DropdownMenu({ open, onClose, anchorRef, align = "left", role = "menu", className = "", children }: DropdownMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      role={role}
      className={`absolute top-full ${align === "right" ? "right-0" : "left-0"} mt-1.5 z-50 rounded-xl border border-border bg-card-bg shadow-modal p-1.5 motion-safe:animate-menu-in ${className}`}
    >
      {children}
    </div>
  );
}

interface DropdownItemProps {
  icon?: ReactNode;
  // Single-select highlight (role="menuitem", checkmark on the right).
  selected?: boolean;
  // Multi-select highlight (role="menuitemcheckbox", checkmark on the right).
  checked?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}

export function DropdownItem({ icon, selected, checked, danger, disabled, onClick, className = "", children }: DropdownItemProps) {
  const active = selected || checked;
  const role = checked !== undefined ? "menuitemcheckbox" : "menuitem";
  return (
    <button
      type="button"
      role={role}
      aria-checked={checked !== undefined ? checked : undefined}
      aria-selected={selected !== undefined ? selected : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-sm rounded-lg text-left transition-colors disabled:opacity-50 disabled:cursor-default ${
        danger
          ? "text-ink/80 hover:text-red-500 hover:bg-red-500/8"
          : active
          ? "bg-ink/5 text-ink font-medium"
          : "text-ink/80 hover:text-ink hover:bg-ink/5"
      } ${className}`}
    >
      {icon && <span className="flex-shrink-0 text-muted">{icon}</span>}
      <span className="flex-1 min-w-0 truncate text-left">{children}</span>
      {active && (
        <svg className="ml-auto flex-shrink-0" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 6l3 3 5-5" />
        </svg>
      )}
    </button>
  );
}

export function DropdownDivider() {
  return <div className="my-1 -mx-1.5 border-t border-border/60" />;
}
