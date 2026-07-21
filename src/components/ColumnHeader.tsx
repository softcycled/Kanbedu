"use client";

import { useState, useRef, useEffect } from "react";
import { resolveColumnPalette, COLUMN_PALETTE } from "@/lib/columnPalette";
import { DropdownMenu, DropdownItem, DropdownDivider } from "./ui/DropdownMenu";

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
  onAddTaskClick?: () => void;
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
  onAddTaskClick,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<"main" | "color">("main");
  const inputRef = useRef<HTMLInputElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

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

  // Keep the edit buffer in sync with the live label when not actively editing,
  // so opening the rename box always starts from the current name (e.g. after a
  // realtime update renamed the column under us). Without this, saving an
  // unchanged-looking box could revert a concurrent rename.
  useEffect(() => {
    if (!isEditing) setEditValue(label);
  }, [label, isEditing]);

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

      {/* + Quick add, always reachable even with the header pinned above a long, scrolled list.
          preventDefault on pointerdown stops the browser from blurring an open AddTask input in
          this column first -- without it, a click here would commit whatever draft was mid-typing
          before reopening a fresh input. */}
      {onAddTaskClick && (
        <button
          type="button"
          aria-label={`Add task to ${label}`}
          title="Add task"
          draggable={false}
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onClick={(e) => { e.stopPropagation(); onAddTaskClick(); }}
          className="flex-shrink-0 p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-column-bg transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
        </button>
      )}

      {/* ⋯ options menu */}
      <div className="relative flex-shrink-0" onPointerDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          ref={menuTriggerRef}
          aria-label="Column options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
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

        <DropdownMenu open={menuOpen} onClose={closeMenu} anchorRef={menuTriggerRef} align="right" className="w-48">
          {menuView === "main" ? (
            <>
              {/* Change color */}
              {onSetColor && (
                <DropdownItem onClick={() => setMenuView("color")}>
                  <span className="flex items-center justify-between w-full">
                    Change color
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted flex-shrink-0">
                      <path d="M4 2l4 4-4 4" />
                    </svg>
                  </span>
                </DropdownItem>
              )}
              <DropdownDivider />
              {/* Mark as Done — only shown for non-done columns */}
              {!isDone && (
                <DropdownItem onClick={() => { onSetDone(); closeMenu(); }}>
                  Mark as Done
                </DropdownItem>
              )}
              {/* Delete */}
              {isDynamic && !isDone && (
                <DropdownItem danger onClick={() => { onDelete(); closeMenu(); }}>
                  Delete column
                </DropdownItem>
              )}
            </>
          ) : (
            <>
              {/* Color picker — named list, like tagging */}
              <button
                type="button"
                onClick={() => setMenuView("main")}
                className="w-full flex items-center gap-2 px-2.5 py-2 text-sm text-muted hover:text-ink hover:bg-ink/5 rounded-lg transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                  <path d="M8 2L4 6l4 4" />
                </svg>
                <span className="font-medium">Color</span>
              </button>
              <DropdownDivider />
              {COLUMN_PALETTE.map((p) => (
                <DropdownItem
                  key={p.name}
                  selected={color === p.name}
                  icon={<span className={`inline-block w-[11px] h-[11px] rounded-full flex-shrink-0 ${p.dot}`} />}
                  onClick={() => pickColor(color === p.name ? null : p.name)}
                >
                  <span className="capitalize">{p.name}</span>
                </DropdownItem>
              ))}
            </>
          )}
        </DropdownMenu>
      </div>
    </div>
  );
}
