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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div className="bg-card-bg rounded-xl shadow-modal p-6 max-w-sm w-full mx-4 animate-modal-in">
        <h3 className="text-lg font-bold text-ink mb-2">Delete "{board.name}"?</h3>
        <p className="text-sm text-muted mb-6">
          This will permanently delete the board and all its columns, tasks, and comments. This cannot be undone.
        </p>
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
            {isLoading ? "Deleting…" : "Delete board"}
          </button>
        </div>
      </div>
    </div>
  );
}
