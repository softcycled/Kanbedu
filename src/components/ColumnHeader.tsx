"use client";

import { useState, useRef, useEffect } from "react";
import { Column as ColumnType } from "@/lib/types";

interface Props {
  columnId: string;
  label: string;
  taskCount: number;
  onRename: (newLabel: string) => Promise<void>;
  onDelete: () => void;
  isDynamic: boolean; // true if user-created, false if default
  columnIndex?: number;
  isDragging?: boolean;
}

const getColorClasses = (index: number) => {
  const colors = [
    { bg: "bg-blue-100", border: "border-blue-200", dot: "bg-slate-400" },
    { bg: "bg-amber-100", border: "border-amber-200", dot: "bg-amber-500" },
    { bg: "bg-green-100", border: "border-green-200", dot: "bg-green-500" },
    { bg: "bg-purple-100", border: "border-purple-200", dot: "bg-purple-500" },
    { bg: "bg-pink-100", border: "border-pink-200", dot: "bg-pink-500" },
    { bg: "bg-cyan-100", border: "border-cyan-200", dot: "bg-cyan-500" },
  ];

  return colors[index % colors.length];
};

export default function ColumnHeader({
  columnId,
  label,
  taskCount,
  onRename,
  onDelete,
  isDynamic,
  columnIndex = 0,
  isDragging = false,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  const colors = getColorClasses(columnIndex);

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

  return (
    <div
      className={`flex items-center gap-2 px-2.5 py-2 mb-3 rounded-lg border transition-all ${colors.bg} ${colors.border} ${
        isDragging ? "opacity-50 scale-95" : ""
      } cursor-grab active:cursor-grabbing`}
      data-column
      data-column-id={columnId}
    >
      <span className={`w-2 h-2 rounded-full ${colors.dot} flex-shrink-0`} />

      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="text-xs font-bold uppercase tracking-widest text-ink bg-white/80 border border-current rounded px-1 py-0.5 flex-1 min-w-0"
          onClick={(e) => e.stopPropagation()}
          draggable={false}
        />
      ) : (
        <h2
          onClick={() => setIsEditing(true)}
          className="text-xs font-bold uppercase tracking-widest text-ink cursor-pointer hover:opacity-70 transition-opacity flex-1"
          draggable={false}
        >
          {label}
        </h2>
      )}

      <span className="ml-auto text-xs text-muted font-mono bg-black/5 rounded-md px-1.5 py-0.5 flex-shrink-0">
        {taskCount}
      </span>

      {isDynamic && (
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
