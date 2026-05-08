"use client";

import { useState, useRef, useEffect } from "react";
import { ColumnData } from "@/lib/types";

interface Props {
  column: ColumnData;
  taskCount: number;
  otherColumns: ColumnData[];
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (moveToColumnId?: string) => Promise<void>;
  errorMessage?: string | null;
}

export default function DeleteColumnModal({
  column,
  taskCount,
  otherColumns,
  isOpen,
  onClose,
  onConfirmDelete,
  errorMessage,
}: Props) {
  const [selectedTargetColumn, setSelectedTargetColumn] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      await onConfirmDelete(selectedTargetColumn);
      onClose();
    } catch (error) {
      console.error("Failed to delete column:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-[2px]">
      <div className="bg-card-bg rounded-2xl shadow-modal w-full max-w-sm animate-modal-in p-6">
        <p className="text-sm font-semibold text-ink">Delete column "{column.label}"?</p>
        <p className="text-xs text-muted mt-1">
          This column contains <strong className="text-ink">{taskCount}</strong> task{taskCount !== 1 ? "s" : ""}.
        </p>

        {taskCount > 0 && otherColumns.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-muted mb-1.5">Move tasks to:</p>
            <div ref={dropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm bg-column-bg text-ink border border-border hover:border-ink/30 transition-colors focus:outline-none"
              >
                <span>{selectedTargetColumn ? otherColumns.find(c => c.id === selectedTargetColumn)?.label : "Delete column and all tasks"}</span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className={`flex-shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}>
                  <path d="M2 4l4 4 4-4"/>
                </svg>
              </button>
              {dropdownOpen && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-card-bg border border-border rounded-xl shadow-modal z-10 py-1 animate-fade-in">
                  <button
                    type="button"
                    onClick={() => { setSelectedTargetColumn(undefined); setDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${!selectedTargetColumn ? "text-ink bg-column-bg" : "text-muted hover:text-ink hover:bg-column-bg"}`}
                  >
                    Delete column and all tasks
                  </button>
                  {otherColumns.map((col) => (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => { setSelectedTargetColumn(col.id); setDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${selectedTargetColumn === col.id ? "text-ink bg-column-bg" : "text-muted hover:text-ink hover:bg-column-bg"}`}
                    >
                      {col.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-3 py-2">
            <p className="text-xs text-red-600 dark:text-red-400">{errorMessage}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-ink hover:bg-column-bg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {isLoading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
