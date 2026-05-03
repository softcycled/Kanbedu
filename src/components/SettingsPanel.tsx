"use client";

import { useState } from "react";
import { Board } from "@/lib/types";

interface Props {
  boards: Board[];
  activeBoardId: string;
  onRename: (boardId: string, name: string) => Promise<void>;
  onDelete: (boardId: string) => Promise<void>;
}

export default function SettingsPanel({
  boards,
  activeBoardId,
  onRename,
  onDelete,
}: Props) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const startRename = (board: Board) => {
    setRenamingId(board.id);
    setRenameValue(board.name);
  };

  const saveRename = async (boardId: string) => {
    if (!renameValue.trim()) return;
    setIsSaving(true);
    try {
      await onRename(boardId, renameValue.trim());
    } finally {
      setIsSaving(false);
      setRenamingId(null);
    }
  };

  return (
    <div className="flex-1 px-10 py-8 overflow-y-auto">
      <h2 className="text-xl font-bold text-ink mb-1">Settings</h2>
      <p className="text-sm text-muted mb-8">Manage your boards</p>

      <div className="max-w-md">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
          Boards
        </h3>
        <div className="bg-card-bg rounded-xl border border-border divide-y divide-border">
          {boards.map((board) => (
            <div key={board.id} className="flex items-center gap-3 px-4 py-3">
              {renamingId === board.id ? (
                <input
                  autoFocus
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveRename(board.id);
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  onBlur={() => saveRename(board.id)}
                  disabled={isSaving}
                  className="flex-1 text-sm px-2 py-1 rounded border border-border bg-white text-ink outline-none focus:border-ink/40"
                />
              ) : (
                <span
                  className={`flex-1 text-sm ${
                    board.id === activeBoardId
                      ? "text-ink font-medium"
                      : "text-ink/80"
                  }`}
                >
                  {board.name}
                  {board.id === activeBoardId && (
                    <span className="ml-2 text-[10px] font-medium text-muted border border-border rounded px-1 py-0.5">
                      active
                    </span>
                  )}
                </span>
              )}

              <div className="flex items-center gap-1">
                <button
                  onClick={() => startRename(board)}
                  className="text-xs text-muted hover:text-ink transition-colors px-2 py-1 rounded hover:bg-ink/5"
                >
                  Rename
                </button>

                {confirmDeleteId === board.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={async () => {
                        await onDelete(board.id);
                        setConfirmDeleteId(null);
                      }}
                      className="text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs text-muted hover:text-ink px-2 py-1 rounded hover:bg-ink/5 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(board.id)}
                    disabled={boards.length === 1}
                    className="text-xs text-muted hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                    title={boards.length === 1 ? "Can't delete the last board" : "Delete board"}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
