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
    <div role="dialog" aria-modal="true" aria-label={`Delete column "${column.label}"`} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-[2px] motion-safe:animate-fade-in">
      <div className="bg-card-bg rounded-2xl shadow-modal w-full max-w-sm motion-safe:animate-modal-in p-6">
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
                className="w-full bg-column-bg rounded-xl px-3 py-2.5 text-sm text-ink border border-transparent hover:border-border transition-colors cursor-pointer text-left flex items-center gap-2"
              >
                <span className="truncate">
                  {selectedTargetColumn
                    ? otherColumns.find((c) => c.id === selectedTargetColumn)?.label
                    : "Delete column and all tasks"}
                </span>
                <svg className="ml-auto flex-shrink-0 text-muted transition-transform" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 4l4 4 4-4"/>
                </svg>
              </button>
              {dropdownOpen && (
                <div className="absolute z-10 mt-1 w-full bg-card-bg border border-border rounded-xl shadow-modal overflow-hidden">
                  {[{ id: "", label: "Delete column and all tasks" }, ...otherColumns.map((c) => ({ id: c.id, label: c.label }))].map((item) => {
                    const isSelected = (selectedTargetColumn ?? "") === item.id;
                    return (
                      <button
                        key={item.id || "delete-all"}
                        type="button"
                        onClick={() => { setSelectedTargetColumn(item.id || undefined); setDropdownOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                          isSelected
                            ? "bg-column-bg text-ink font-medium"
                            : "text-ink hover:bg-column-bg"
                        }`}
                      >
                        <span className="truncate">{item.label}</span>
                        {isSelected && (
                          <svg className="ml-auto flex-shrink-0 text-ink" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2 6l3 3 5-5"/>
                          </svg>
                        )}
                      </button>
                    );
                  })}
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
