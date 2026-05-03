"use client";

import { useState } from "react";
import { Board } from "@/lib/types";

export type Panel = "board" | "analytics" | "settings" | "profile";

interface Props {
  boards: Board[];
  activeBoardId: string;
  activePanel: Panel;
  onPanelChange: (panel: Panel) => void;
  onBoardSwitch: (id: string) => void;
  onCreateBoard: (name: string) => Promise<void>;
}

// ── Icons ──────────────────────────────────────────────────────
function IconLayout() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="6" height="9" rx="1" />
      <rect x="9" y="1" width="6" height="4" rx="1" />
      <rect x="9" y="7" width="6" height="8" rx="1" />
    </svg>
  );
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

// ── Component ──────────────────────────────────────────────────
export default function Sidebar({
  boards,
  activeBoardId,
  activePanel,
  onPanelChange,
  onBoardSwitch,
  onCreateBoard,
}: Props) {
  const [isAddingBoard, setIsAddingBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateBoard = async () => {
    const name = newBoardName.trim();
    if (!name) return;
    setIsCreating(true);
    try {
      await onCreateBoard(name);
      setNewBoardName("");
      setIsAddingBoard(false);
    } finally {
      setIsCreating(false);
    }
  };

  const navItems: { id: Panel; label: string; icon: React.ReactNode }[] = [
    { id: "analytics", label: "Analytics", icon: <IconBarChart /> },
    { id: "settings", label: "Settings", icon: <IconSettings /> },
    { id: "profile", label: "Profile", icon: <IconUser /> },
  ];

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-paper border-r border-border/70 h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 pt-6 pb-5 border-b border-border/60">
        <span className="text-lg font-bold tracking-tight text-ink">kanbedu</span>
      </div>

      {/* Boards section */}
      <div className="flex-1 overflow-y-auto py-4">
        <div className="px-3 mb-1">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted">
              Boards
            </span>
            <button
              onClick={() => setIsAddingBoard(true)}
              className="text-muted hover:text-ink transition-colors"
              title="New board"
            >
              <IconPlus />
            </button>
          </div>

          {boards.map((board) => (
            <button
              key={board.id}
              onClick={() => {
                onBoardSwitch(board.id);
                onPanelChange("board");
              }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors text-left ${
                activeBoardId === board.id && activePanel === "board"
                  ? "bg-ink/8 text-ink font-medium"
                  : "text-ink/70 hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <IconLayout />
              <span className="truncate">{board.name}</span>
            </button>
          ))}

          {/* Add board input */}
          {isAddingBoard && (
            <div className="mt-1">
              <input
                autoFocus
                type="text"
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateBoard();
                  if (e.key === "Escape") {
                    setIsAddingBoard(false);
                    setNewBoardName("");
                  }
                }}
                onBlur={() => {
                  if (!newBoardName.trim()) {
                    setIsAddingBoard(false);
                  }
                }}
                placeholder="Board name…"
                disabled={isCreating}
                className="w-full px-2 py-1.5 text-sm rounded-lg border border-border bg-white/60 text-ink placeholder-muted/60 outline-none focus:border-ink/30"
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="py-3 border-t border-border/60 px-3">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onPanelChange(item.id)}
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
      </div>
    </aside>
  );
}
