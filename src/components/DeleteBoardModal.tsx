"use client";

import { useState } from "react";
import { Board } from "@/lib/types";

interface Props {
  board: Board | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (boardId: string) => Promise<void>;
}

export default function DeleteBoardModal({
  board,
  isOpen,
  onClose,
  onConfirmDelete,
}: Props) {
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    if (!board) return;
    setIsLoading(true);
    try {
      await onConfirmDelete(board.id);
      onClose();
    } catch (error) {
      console.error("Failed to delete board:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !board) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label={`Delete board "${board.name}"`} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-[2px] motion-safe:animate-fade-in">
      <div className="bg-card-bg rounded-2xl shadow-modal w-full max-w-sm motion-safe:animate-modal-in p-6">
        <p className="text-sm font-semibold text-ink">Delete "{board.name}"?</p>
        <p className="text-xs text-muted mt-1">
          This will permanently delete the board and all its columns, tasks, and comments. This action cannot be undone.
        </p>
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
            {isLoading ? "Deleting…" : "Delete board"}
          </button>
        </div>
      </div>
    </div>
  );
}
