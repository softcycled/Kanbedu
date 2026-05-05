"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Board } from "@/lib/types";
import DeleteBoardModal from "./DeleteBoardModal";

function DragHandle() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" className="text-muted/50">
      <circle cx="4.5" cy="3" r="1.2" /><circle cx="9.5" cy="3" r="1.2" />
      <circle cx="4.5" cy="7" r="1.2" /><circle cx="9.5" cy="7" r="1.2" />
      <circle cx="4.5" cy="11" r="1.2" /><circle cx="9.5" cy="11" r="1.2" />
    </svg>
  );
}

function SortableBoardRow({
  board,
  activeBoardId,
  renamingId,
  renameValue,
  isSaving,
  canDelete,
  onStartRename,
  onRenameChange,
  onRenameKeyDown,
  onRenameBlur,
  onDeleteClick,
}: {
  board: Board;
  activeBoardId: string;
  renamingId: string | null;
  renameValue: string;
  isSaving: boolean;
  canDelete: boolean;
  onStartRename: (board: Board) => void;
  onRenameChange: (v: string) => void;
  onRenameKeyDown: (e: React.KeyboardEvent, boardId: string) => void;
  onRenameBlur: (boardId: string) => void;
  onDeleteClick: (board: Board) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: board.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-4 py-3 border-b border-border last:border-b-0 bg-card-bg"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none text-muted hover:text-ink/50 transition-colors mr-1 flex-shrink-0"
        tabIndex={-1}
        aria-label="Drag to reorder"
      >
        <DragHandle />
      </button>

      {renamingId === board.id ? (
        <input
          autoFocus
          type="text"
          value={renameValue}
          onChange={(e) => onRenameChange(e.target.value)}
          onKeyDown={(e) => onRenameKeyDown(e, board.id)}
          onBlur={() => onRenameBlur(board.id)}
          disabled={isSaving}
          className="flex-1 text-sm px-2 py-1 rounded border border-border bg-white text-ink outline-none focus:border-ink/40"
        />
      ) : (
        <span
          className={`flex-1 text-sm ${
            board.id === activeBoardId ? "text-ink font-medium" : "text-ink/80"
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
          onClick={() => onStartRename(board)}
          className="text-xs text-muted hover:text-ink transition-colors px-2 py-1 rounded hover:bg-ink/5"
        >
          Rename
        </button>
        <button
          onClick={() => onDeleteClick(board)}
          disabled={!canDelete}
          className="text-xs text-muted hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
          title={!canDelete ? "Can't delete the last board" : "Delete board"}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

interface Props {
  boards: Board[];
  activeBoardId: string;
  onRename: (boardId: string, name: string) => Promise<void>;
  onDelete: (boardId: string) => Promise<void>;
  onReorder: (ids: string[]) => Promise<void>;
}

export default function SettingsPanel({
  boards,
  activeBoardId,
  onRename,
  onDelete,
  onReorder,
}: Props) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingBoard, setDeletingBoard] = useState<Board | null>(null);

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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = boards.findIndex((b) => b.id === active.id);
    const newIndex = boards.findIndex((b) => b.id === over.id);
    const reordered = arrayMove(boards, oldIndex, newIndex);
    await onReorder(reordered.map((b) => b.id));
  };

  return (
    <>
      <div className="flex-1 px-10 py-8 overflow-y-auto">
        <h2 className="text-xl font-bold text-ink mb-1">Settings</h2>
        <p className="text-sm text-muted mb-8">Manage your boards</p>

        <div className="max-w-md">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
            Boards
          </h3>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={boards.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <div className="bg-card-bg rounded-xl border border-border overflow-hidden">
                {boards.map((board) => (
                  <SortableBoardRow
                    key={board.id}
                    board={board}
                    activeBoardId={activeBoardId}
                    renamingId={renamingId}
                    renameValue={renameValue}
                    isSaving={isSaving}
                    canDelete={boards.length > 1}
                    onStartRename={startRename}
                    onRenameChange={setRenameValue}
                    onRenameKeyDown={(e, id) => {
                      if (e.key === "Enter") saveRename(id);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    onRenameBlur={saveRename}
                    onDeleteClick={setDeletingBoard}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>

      <DeleteBoardModal
        board={deletingBoard}
        isOpen={deletingBoard !== null}
        onClose={() => setDeletingBoard(null)}
        onConfirmDelete={onDelete}
      />
    </>
  );
}
