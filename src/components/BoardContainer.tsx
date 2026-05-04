"use client";

import { useState, useCallback } from "react";
import { Task, Board } from "@/lib/types";
import BoardComp from "./Board";
import Sidebar, { Panel } from "./Sidebar";
import Header from "./Header";
import AnalyticsPanel from "./AnalyticsPanel";
import SettingsPanel from "./SettingsPanel";
import ProfilePanel from "./ProfilePanel";

interface Props {
  initialTasks: Task[];
  initialBoards: Board[];
  initialBoardId: string;
}

export default function BoardContainer({
  initialTasks,
  initialBoards,
  initialBoardId,
}: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [boards, setBoards] = useState<Board[]>(initialBoards);
  const [activeBoardId, setActiveBoardId] = useState(initialBoardId);
  const [activePanel, setActivePanel] = useState<Panel>("board");

  const handleBoardSwitch = useCallback(async (boardId: string) => {
    // Fetch tasks for the new board before switching
    const res = await fetch(`/api/tasks?boardId=${boardId}`);
    const newTasks = res.ok ? await res.json() : [];
    // Batch: both updates apply in same render so Board remounts with correct data
    setActiveBoardId(boardId);
    setTasks(newTasks);
    setActivePanel("board");
  }, []);

  const handleCreateBoard = useCallback(async (name: string) => {
    const res = await fetch("/api/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const board: Board = await res.json();
    setBoards((prev) => [...prev, board]);
    await handleBoardSwitch(board.id);
  }, [handleBoardSwitch]);

  const handleRenameBoard = useCallback(async (boardId: string, name: string) => {
    const res = await fetch(`/api/boards/${boardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const updated: Board = await res.json();
    setBoards((prev) => prev.map((b) => (b.id === boardId ? updated : b)));
  }, []);

  const handleDeleteBoard = useCallback(async (boardId: string) => {
    if (boards.length === 1) return;
    const res = await fetch(`/api/boards/${boardId}`, { method: "DELETE" });
    if (!res.ok) return;
    const remaining = boards.filter((b) => b.id !== boardId);
    setBoards(remaining);
    if (activeBoardId === boardId) {
      await handleBoardSwitch(remaining[0].id);
    }
  }, [boards, activeBoardId, handleBoardSwitch]);

  const activeBoard = boards.find((b) => b.id === activeBoardId);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        boards={boards}
        activeBoardId={activeBoardId}
        activePanel={activePanel}
        onPanelChange={setActivePanel}
        onBoardSwitch={handleBoardSwitch}
        onCreateBoard={handleCreateBoard}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {activePanel === "board" && (
          <>
            <Header boardName={activeBoard?.name ?? ""} />
            <main className="flex-1 px-8 pt-8 overflow-hidden flex flex-col">
              <BoardComp
                key={activeBoardId}
                boardId={activeBoardId}
                initialTasks={tasks}
                onTasksUpdate={setTasks}
              />
            </main>
          </>
        )}
        {activePanel === "analytics" && (
          <AnalyticsPanel tasks={tasks} boardName={activeBoard?.name ?? ""} />
        )}
        {activePanel === "settings" && (
          <SettingsPanel
            boards={boards}
            activeBoardId={activeBoardId}
            onRename={handleRenameBoard}
            onDelete={handleDeleteBoard}
          />
        )}
        {activePanel === "profile" && <ProfilePanel />}
      </div>
    </div>
  );
}

