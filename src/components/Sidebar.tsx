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
import CreateJoinModal from "./CreateJoinModal";

export type Panel = "board" | "analytics" | "settings" | "profile" | "admin";

interface Props {
  boards: Board[];
  activeBoardId: string;
  activePanel: Panel;
  onPanelChange: (panel: Panel) => void;
  onBoardSwitch: (id: string) => void;
  onCreateBoard: (name: string) => Promise<void>;
  onJoinBoard: (inviteInput: string) => Promise<void>;
  onReorder: (ids: string[]) => Promise<void>;
  onSupportClick: () => void;
  onBoardHover?: (id: string) => void;
  isAdmin?: boolean;
}

function IconBarChart() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="8" width="3" height="7" rx="0.5" />
      <rect x="6" y="4" width="3" height="11" rx="0.5" />
      <rect x="11" y="1" width="3" height="14" rx="0.5" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M2.93 2.93l1.06 1.06M12.01 12.01l1.06 1.06M2.93 13.07l1.06-1.06M12.01 3.99l1.06-1.06" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="5" r="3" />
      <path d="M1.5 14.5c0-3.314 2.91-6 6.5-6s6.5 2.686 6.5 6" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="6.5" y1="1" x2="6.5" y2="12" />
      <line x1="1" y1="6.5" x2="12" y2="6.5" />
    </svg>
  );
}

function IconHelp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function GripDots() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
      <circle cx="2.5" cy="2.5" r="1.2" />
      <circle cx="7.5" cy="2.5" r="1.2" />
      <circle cx="2.5" cy="7" r="1.2" />
      <circle cx="7.5" cy="7" r="1.2" />
      <circle cx="2.5" cy="11.5" r="1.2" />
      <circle cx="7.5" cy="11.5" r="1.2" />
    </svg>
  );
}

function SortableBoardItem({
  board,
  isActive,
  onClick,
  onHover,
}: {
  board: Board;
  isActive: boolean;
  onClick: () => void;
  onHover?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: board.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group flex items-center gap-1 rounded-lg">
      <button
        {...attributes}
        {...listeners}
        tabIndex={-1}
        aria-label="Drag to reorder"
        className="opacity-0 group-hover:opacity-40 hover:!opacity-80 transition-opacity cursor-grab active:cursor-grabbing touch-none text-muted flex-shrink-0 px-0.5 py-1"
      >
        <GripDots />
      </button>
      <button
        onClick={onClick}
        onMouseEnter={onHover && !isActive ? () => onHover(board.id) : undefined}
        className={`flex-1 flex items-center px-2 py-1.5 rounded-lg text-sm transition-colors text-left min-w-0 ${
          isActive
            ? "bg-ink/8 text-ink font-medium"
            : "text-ink/70 hover:bg-ink/5 hover:text-ink"
        }`}
      >
        <span className="truncate">{board.name}</span>
      </button>
    </div>
  );
}

export default function Sidebar({
  boards,
  activeBoardId,
  activePanel,
  onPanelChange,
  onBoardSwitch,
  onCreateBoard,
  onJoinBoard,
  onReorder,
  onSupportClick,
  onBoardHover,
  isAdmin = false,
}: Props) {
  const [newBoardName, setNewBoardName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateJoinOpen, setIsCreateJoinOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = boards.findIndex((b) => b.id === active.id);
    const newIndex = boards.findIndex((b) => b.id === over.id);
    const reordered = arrayMove(boards, oldIndex, newIndex);
    await onReorder(reordered.map((b) => b.id));
  };

  const handleCreateBoard = async () => {
    const name = newBoardName.trim();
    if (!name) return;
    setIsCreating(true);
    try {
      await onCreateBoard(name);
      setNewBoardName("");
      setIsCreateJoinOpen(false);
      onPanelChange("board");
      setMobileOpen(false);
    } finally {
      setIsCreating(false);
    }
  };

  const desktopNavItems: { id: Panel; label: string; icon: React.ReactNode }[] = [
    { id: "analytics", label: "Analytics", icon: <IconBarChart /> },
    { id: "settings", label: "Boards", icon: <IconSettings /> },
    { id: "profile", label: "Settings", icon: <IconUser /> },
    ...(isAdmin ? [{ id: "admin" as Panel, label: "Admin", icon: <IconShield /> }] : []),
  ];

  const mobileNavItems: { id: Panel; label: string; icon: React.ReactNode }[] = [
    { id: "board", label: "Board", icon: <IconSettings /> },
    ...desktopNavItems,
  ];

  const sidebarContent = (
    <>
      <div className="px-4 border-b border-border/60 flex items-center justify-between" style={{ paddingTop: 29, paddingBottom: 24.75 }}>
        <span className="text-lg font-bold tracking-tight text-ink">kanbedu</span>
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden p-1 rounded-lg text-muted hover:text-ink hover:bg-ink/5 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <div className="px-3 mb-1">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted">Boards</span>
            <button onClick={() => setIsCreateJoinOpen(true)} className="text-muted hover:text-ink transition-colors" title="New board">
              <IconPlus />
            </button>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={boards.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              {boards.map((board) => (
                <SortableBoardItem
                  key={board.id}
                  board={board}
                  isActive={activeBoardId === board.id && activePanel === "board"}
                  onClick={() => {
                    onBoardSwitch(board.id);
                    onPanelChange("board");
                    setMobileOpen(false);
                  }}
                  onHover={onBoardHover}
                />
              ))}
            </SortableContext>
          </DndContext>

          
        </div>
      </div>

      <div className="py-3 border-t border-border/60 px-3 space-y-0.5">
        {desktopNavItems.map((item) => (
          <button
            key={item.id}
            onClick={() => { onPanelChange(item.id); setMobileOpen(false); }}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
              activePanel === item.id
                ? "bg-ink/8 text-ink font-medium"
                : "text-ink/70 hover:bg-ink/5 hover:text-ink"
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
        <button
          onClick={() => { onSupportClick(); setMobileOpen(false); }}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-ink/70 hover:bg-ink/5 hover:text-ink transition-colors"
        >
          <IconHelp />
          Support
        </button>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden md:flex w-56 flex-shrink-0 flex-col bg-paper border-r border-border/70 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-paper flex flex-col shadow-modal">
            {sidebarContent}
          </aside>
        </div>
      )}

      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-40 md:hidden p-2 rounded-xl bg-card-bg border border-border shadow-card text-ink"
        aria-label="Open menu"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-paper border-t border-border/70 safe-area-bottom">
        <div className="flex items-center justify-around py-1.5">
          {mobileNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { onPanelChange(item.id); setMobileOpen(false); }}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                activePanel === item.id ? "text-ink" : "text-muted"
              }`}
            >
              {item.icon}
              <span className="text-[10px]">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
      <CreateJoinModal
        isOpen={isCreateJoinOpen}
        onClose={() => setIsCreateJoinOpen(false)}
        onCreate={async (name: string) => {
          await onCreateBoard(name);
          setIsCreateJoinOpen(false);
          setNewBoardName("");
          onPanelChange("board");
          setMobileOpen(false);
        }}
        onJoin={async (inviteInput: string) => {
          await onJoinBoard(inviteInput);
          setIsCreateJoinOpen(false);
          setMobileOpen(false);
        }}
      />
    </>
  );
}
