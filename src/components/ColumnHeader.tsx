"use client";

import { useState, useRef, useEffect } from "react";
import { resolveColumnPalette, COLUMN_PALETTE } from "@/lib/columnPalette";

interface Props {
  columnId: string;
  label: string;
  taskCount: number;
  isDone: boolean;
  onRename: (newLabel: string) => Promise<void>;
  onDelete: () => void;
  onSetDone: () => void;
  isDynamic: boolean;
  columnIndex?: number;
  color?: string | null;
  onSetColor?: (name: string | null) => void;
  isDragging?: boolean;
  dragListeners?: Record<string, unknown>;
}

export default function ColumnHeader({
  columnId,
  label,
  taskCount,
  isDone,
  onRename,
  onDelete,
  onSetDone,
  isDynamic,
  columnIndex = 0,
  color = null,
  onSetColor,
  isDragging = false,
  dragListeners,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<"main" | "color">("main");
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const colors = resolveColumnPalette(color, columnIndex);

  const handleSave = async () => {
    if (editValue.trim() && editValue !== label) {
      try {
        await onRename(editValue.trim());
      } catch {
        setEditValue(label);
      }
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    else if (e.key === "Escape") { setEditValue(label); setIsEditing(false); }
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const openMenu = () => {
    setMenuView("main");
    setMenuOpen(true);
  };

  const closeMenu = () => setMenuOpen(false);

  const pickColor = (name: string | null) => {
    onSetColor?.(name);
    closeMenu();
  };

  return (
    <div
      className={`flex items-center gap-2 px-2.5 py-2 mb-3 rounded-lg border transition-all ${colors.bg} ${colors.border} ${
        isDragging ? "opacity-50 scale-95" : ""
      } cursor-grab active:cursor-grabbing`}
      data-column
      data-column-id={columnId}
      {...(dragListeners as React.HTMLAttributes<HTMLDivElement>)}
    >
      {/* Decorative color dot */}
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors.dot}`} />

      {/* Label — click to rename */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={`text-base font-bold tracking-wide ${colors.text} bg-card-bg/80 border border-current rounded px-1 py-0.5 flex-1 min-w-0`}
          onClick={(e) => e.stopPropagation()}
          draggable={false}
        />
      ) : (
        <h2
          onClick={() => setIsEditing(true)}
          className={`text-base font-bold tracking-wide ${colors.text} cursor-pointer hover:opacity-70 transition-opacity flex-1`}
          draggable={false}
        >
          {label}
        </h2>
      )}

      {/* Done badge — visual only */}
      {isDone && (
        <span className="flex-shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded-md bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 select-none">
          ✓ Done
        </span>
      )}

      {/* Task count */}
      <span className="text-xs text-muted font-mono bg-ink/5 rounded-md px-1.5 py-0.5 flex-shrink-0">
        {taskCount}
      </span>

      {/* ⋯ options menu */}
      <div ref={menuRef} className="relative flex-shrink-0" onPointerDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label="Column options"
          title="Column options"
          draggable={false}
          onClick={(e) => { e.stopPropagation(); menuOpen ? closeMenu() : openMenu(); }}
          className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-column-bg transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="3" cy="8" r="1.5" />
            <circle cx="8" cy="8" r="1.5" />
            <circle cx="13" cy="8" r="1.5" />
          </svg>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-1.5 z-50 w-48 bg-card-bg border border-border rounded-xl shadow-modal overflow-hidden"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {menuView === "main" ? (
              <>
                {/* Change color */}
                {onSetColor && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => setMenuView("color")}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-ink hover:bg-column-bg transition-colors"
                  >
                    <span>Change color</span>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted flex-shrink-0">
                      <path d="M4 2l4 4-4 4" />
                    </svg>
                  </button>
                )}
                <div className="border-t border-border" />
                {/* Mark as Done — only shown for non-done columns */}
                {!isDone && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={(e) => { e.stopPropagation(); onSetDone(); closeMenu(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-ink hover:bg-column-bg transition-colors"
                  >
                    Mark as Done
                  </button>
                )}
                {/* Delete */}
                {isDynamic && !isDone && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={(e) => { e.stopPropagation(); onDelete(); closeMenu(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-column-bg transition-colors"
                  >
                    Delete column
                  </button>
                )}
              </>
            ) : (
              <>
                {/* Color picker — named list, like tagging */}
                <button
                  type="button"
                  onClick={() => setMenuView("main")}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-muted hover:text-ink hover:bg-column-bg transition-colors border-b border-border"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                    <path d="M8 2L4 6l4 4" />
                  </svg>
                  <span className="font-medium">Color</span>
                </button>
                {COLUMN_PALETTE.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => pickColor(color === p.name ? null : p.name)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-ink hover:bg-column-bg transition-colors"
                  >
                    <span className={`w-3 h-3 rounded-full flex-shrink-0 ${p.dot}`} />
                    <span className="capitalize flex-1 text-left">{p.name}</span>
                    {color === p.name && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                        <path d="M2 6l3 3 5-5" />
                      </svg>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
