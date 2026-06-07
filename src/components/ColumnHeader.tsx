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
  isDynamic: boolean; // true if user-created, false if default
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const colors = resolveColumnPalette(color, columnIndex);

  const handleSave = async () => {
    if (editValue.trim() && editValue !== label) {
      try {
        await onRename(editValue.trim());
      } catch (error) {
        console.error("Failed to rename column:", error);
        setEditValue(label);
      }
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditValue(label);
      setIsEditing(false);
    }
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPickerOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pickerOpen]);

  const pickColor = (name: string | null) => {
    onSetColor?.(name);
    setPickerOpen(false);
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
      {/* Color dot — also the trigger for the color picker. */}
      <div ref={pickerRef} className="relative flex-shrink-0" onPointerDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label="Change column color"
          title="Change column color"
          draggable={false}
          onClick={(e) => { e.stopPropagation(); if (onSetColor) setPickerOpen((v) => !v); }}
          className={`w-2.5 h-2.5 rounded-full ${colors.dot} ${onSetColor ? "cursor-pointer ring-offset-1 hover:ring-2 ring-ink/20" : ""} block`}
        />
        {pickerOpen && onSetColor && (
          <div
            role="menu"
            className="absolute left-0 top-full mt-2 z-50 w-max bg-card-bg border border-border rounded-xl shadow-modal p-2"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-4 gap-1.5">
              {COLUMN_PALETTE.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  aria-label={p.name}
                  title={p.name}
                  onClick={() => pickColor(p.name)}
                  className={`w-6 h-6 rounded-full ${p.dot} transition-transform hover:scale-110 ${
                    color === p.name ? "ring-2 ring-ink ring-offset-1 ring-offset-card-bg" : ""
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => pickColor(null)}
              className="mt-2 w-full text-[11px] text-muted hover:text-ink transition-colors py-1 rounded-md hover:bg-ink/5"
            >
              {color ? "Reset to default" : "Default (by position)"}
            </button>
          </div>
        )}
      </div>

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

      <span className="ml-auto text-xs text-muted font-mono bg-ink/5 rounded-md px-1.5 py-0.5 flex-shrink-0">
        {taskCount}
      </span>

      {/* Done-column badge / toggle */}
      {isDone ? (
        <span
          title="This is the Done column. Click to unmark"
          onClick={(e) => { e.stopPropagation(); onSetDone(); }}
          className="flex-shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded-md bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 cursor-pointer hover:bg-green-200 dark:hover:bg-green-950/60 transition-colors select-none"
        >
          ✓ Done
        </span>
      ) : (
        <button
          onClick={onSetDone}
          title="Mark as Done column"
          aria-label="Mark as Done column"
          draggable={false}
          className="flex-shrink-0 text-xs text-muted hover:text-green-700 dark:hover:text-green-300 transition-colors px-1 py-0.5 rounded hover:bg-green-50 dark:hover:bg-green-950/20"
        >
          ✓
        </button>
      )}

      {isDynamic && !isDone && (
        <button
          onClick={onDelete}
          className="ml-1 text-xs text-muted hover:text-red-600 transition-colors flex-shrink-0"
          title="Delete column"
          aria-label="Delete column"
          draggable={false}
        >
          ✕
        </button>
      )}
    </div>
  );
}
