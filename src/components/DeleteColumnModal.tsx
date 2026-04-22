"use client";

import { useState } from "react";
import { ColumnData } from "@/lib/types";

interface Props {
  column: ColumnData;
  taskCount: number;
  otherColumns: ColumnData[];
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (moveToColumnId?: string) => Promise<void>;
}

export default function DeleteColumnModal({
  column,
  taskCount,
  otherColumns,
  isOpen,
  onClose,
  onConfirmDelete,
}: Props) {
  const [selectedTargetColumn, setSelectedTargetColumn] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div className="bg-card-bg rounded-xl shadow-modal p-6 max-w-sm w-full mx-4 animate-modal-in">
        <h3 className="text-lg font-bold text-ink mb-2">Delete column "{column.label}"?</h3>
        
        <p className="text-sm text-muted mb-4">
          This column contains <strong>{taskCount}</strong> task{taskCount !== 1 ? "s" : ""}.
        </p>

        {taskCount > 0 && otherColumns.length > 0 ? (
          <div className="mb-4">
            <p className="text-sm text-muted mb-2">Move tasks to:</p>
            <select
              value={selectedTargetColumn || ""}
              onChange={(e) => setSelectedTargetColumn(e.target.value || undefined)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink"
            >
              <option value="">Delete column and all tasks</option>
              {otherColumns.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-medium text-muted border border-border rounded-lg hover:bg-column-bg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
