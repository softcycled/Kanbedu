"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import CreateJoinClassModal from "./CreateJoinClassModal";
import ConfirmModal from "./ConfirmModal";
import Avatar from "./Avatar";

export interface ClassSummary {
  id: string;
  name: string;
  term: string | null;
  archived: boolean;
  role: string;
  // The caller's own group board reference (students only). Lets a student
  // open their group board inside the app shell instead of a separate page.
  myGroupId?: string | null;
  groupName?: string | null;
  boardId?: string | null;
  realtimeSecret?: string | null;
}

export type Panel = "board" | "analytics" | "settings" | "profile" | "admin" | "help";

interface Props {
  boards: Board[];
  activeBoardId: string;
  activePanel: Panel;
  classes: ClassSummary[];
  activeClassId?: string | null;
  onClassSelect: (c: ClassSummary) => void;
  onClassesReload: () => void;
  onPanelChange: (panel: Panel) => void;
  onBoardSwitch: (id: string) => void;
  onCreateBoard: (name: string) => Promise<void>;
  onJoinBoard: (inviteInput: string) => Promise<void>;
  onReorder: (ids: string[]) => Promise<void>;
  onClassReorder: (ids: string[]) => Promise<void>;
  onBoardHover?: (id: string) => void;
  isAdmin?: boolean;
  // Mobile drawer open state is owned by the shell (BoardContainer) so the board
  // can slide off to reveal this full-screen sidebar and a header trigger can open it.
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
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

function IconSignOut() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
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
      <button
        {...attributes}
        {...listeners}
        tabIndex={-1}
        aria-label="Drag to reorder"
        className="opacity-0 group-hover:opacity-50 hover:!opacity-90 transition-opacity cursor-grab active:cursor-grabbing touch-none text-muted flex-shrink-0 px-0.5 py-1"
      >
        <GripDots />
      </button>
    </div>
  );
}

function SortableClassItem({
  cls,
  isActive,
  archived,
  onClick,
}: {
  cls: ClassSummary;
  isActive: boolean;
  archived?: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: cls.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const isEducator = cls.role === "educator" || cls.role === "ta";

  return (
    <div ref={setNodeRef} style={style} className="group flex items-center gap-1 rounded-lg">
      <button
        onClick={onClick}
        className={`flex-1 flex items-center px-2 py-1.5 rounded-lg text-sm transition-colors text-left min-w-0 ${
          isActive
            ? "bg-ink/8 text-ink font-medium"
            : archived
            ? "text-ink/40 hover:bg-ink/5 hover:text-ink/60"
            : "text-ink/70 hover:bg-ink/5 hover:text-ink"
        }`}
      >
        <span className="truncate">{cls.name}</span>
        {archived ? (
          <span className="ml-auto text-[9px] uppercase tracking-wide text-muted/60 flex-shrink-0 pl-1">archived</span>
        ) : isEducator ? (
          <span className="ml-auto text-[9px] uppercase tracking-wide text-muted/70 flex-shrink-0 pl-1">teaching</span>
        ) : !cls.boardId ? (
          <span className="ml-auto text-[9px] uppercase tracking-wide text-muted/60 flex-shrink-0 pl-1">waiting</span>
        ) : null}
      </button>
      <button
        {...attributes}
        {...listeners}
        tabIndex={-1}
        aria-label="Drag to reorder"
        className="opacity-0 group-hover:opacity-50 hover:!opacity-90 transition-opacity cursor-grab active:cursor-grabbing touch-none text-muted flex-shrink-0 px-0.5 py-1"
      >
        <GripDots />
      </button>
    </div>
  );
}

export default function Sidebar({
  boards,
  activeBoardId,
  activePanel,
  classes,
  activeClassId,
  onClassSelect,
  onClassesReload,
  onPanelChange,
  onBoardSwitch,
  onCreateBoard,
  onJoinBoard,
  onReorder,
  onClassReorder,
  onBoardHover,
  isAdmin = false,
  mobileOpen,
  onMobileOpenChange,
}: Props) {
  const [newBoardName, setNewBoardName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateJoinOpen, setIsCreateJoinOpen] = useState(false);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [classModalMode, setClassModalMode] = useState<"options" | "create" | "join">("options");
  const [showArchivedBoards, setShowArchivedBoards] = useState(false);
  const [showArchivedClasses, setShowArchivedClasses] = useState(false);
  // Mobile drawer open state is controlled by the shell. Local alias keeps the
  // existing call sites (which close the drawer after a selection) terse.
  const setMobileOpen = onMobileOpenChange;

  const router = useRouter();
  const [account, setAccount] = useState<{ name: string; email: string; handle: string | null; color: string } | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [popupView, setPopupView] = useState<"menu" | "notifications">("menu");
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<{ id: string; title: string; body: string; read: boolean; createdAt: string }[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) {
          setAccount({ name: d.name ?? "", email: d.email ?? "", handle: d.handle ?? null, color: d.color ?? "#4A90A4" });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!accountOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as Element).closest?.('[data-account-section]')) setAccountOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setAccountOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  };

  // Reset popup state on close
  useEffect(() => {
    if (!accountOpen) { setPopupView("menu"); }
  }, [accountOpen]);

  // Poll unread count
  useEffect(() => {
    const fetchCount = () =>
      fetch("/api/notifications").then((r) => r.ok ? r.json() : null).then((d) => d && setUnreadCount(d.unreadCount)).catch(() => {});
    fetchCount();
    const id = setInterval(fetchCount, 30000);
    return () => clearInterval(id);
  }, []);

  const openNotifications = () => {
    setPopupView("notifications");
    setNotifLoading(true);
    fetch("/api/notifications")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) { setNotifications(d.notifications); setUnreadCount(d.unreadCount); } })
      .catch(() => {})
      .finally(() => setNotifLoading(false));
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    setNotifications((p) => p.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const isEducatorOf = (c: ClassSummary) => c.role === "educator" || c.role === "ta";
  const educatorClasses = classes.filter((c) => isEducatorOf(c) && !c.archived);
  const studentClasses = classes.filter((c) => !isEducatorOf(c) && !c.archived);
  const archivedEducatorClasses = classes.filter((c) => isEducatorOf(c) && c.archived);
  const archivedStudentClasses = classes.filter((c) => !isEducatorOf(c) && c.archived);

  const openClassModal = (mode: "create" | "join") => {
    setClassModalMode(mode);
    setIsClassModalOpen(true);
  };

  const renderClassItem = (c: ClassSummary, archived = false) => {
    const isActive = activeClassId === c.id;
    return (
      <button
        key={c.id}
        onClick={() => { onClassSelect(c); setMobileOpen(false); }}
        className={`w-full flex items-center px-2 py-1.5 rounded-lg text-sm transition-colors text-left min-w-0 ${
          isActive
            ? "bg-ink/8 text-ink font-medium"
            : archived
            ? "text-ink/40 hover:bg-ink/5 hover:text-ink/60"
            : "text-ink/70 hover:bg-ink/5 hover:text-ink"
        }`}
      >
        <span className="truncate">{c.name}</span>
        {archived ? (
          <span className="ml-auto text-[9px] uppercase tracking-wide text-muted/60 flex-shrink-0 pl-1">archived</span>
        ) : (c.role === "educator" || c.role === "ta") ? (
          <span className="ml-auto text-[9px] uppercase tracking-wide text-muted/70 flex-shrink-0 pl-1">teaching</span>
        ) : null}
      </button>
    );
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

  const handleClassDragEnd = (list: ClassSummary[]) => async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = list.findIndex((c) => c.id === active.id);
    const newIndex = list.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(list, oldIndex, newIndex);
    await onClassReorder(reordered.map((c) => c.id));
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

  // Board settings ("Manage") now lives in the board-name dropdown in the board
  // header (see BoardHeaderMenu), so it is intentionally not a footer nav item.
  // "Settings" here opens the profile/account panel.
  const desktopNavItems: { id: Panel; label: string; icon: React.ReactNode }[] = [
    { id: "analytics", label: "Analytics", icon: <IconBarChart /> },
    { id: "profile", label: "Settings", icon: <IconSettings /> },
    ...(isAdmin ? [{ id: "admin" as Panel, label: "Admin", icon: <IconShield /> }] : []),
    { id: "help", label: "Help", icon: <IconHelp /> },
  ];

  const sidebarContent = (
    <>
      <div className="px-4 border-b border-border/60 flex items-center justify-between" style={{ paddingTop: 29, paddingBottom: 24.75 }}>
        <button
          onClick={() => { onPanelChange("board"); setMobileOpen(false); }}
          aria-label="Go to board"
          className="text-lg font-bold tracking-tight text-ink hover:opacity-70 transition-opacity"
        >
          kanbedu
        </button>
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

          <DndContext id="sidebar-boards" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={boards.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              {boards.map((board) => (
                <SortableBoardItem
                  key={board.id}
                  board={board}
                  isActive={activeBoardId === board.id && activePanel === "board" && !activeClassId}
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

        {/* Class Boards — classes the user is a student in */}
        <div className="px-3 mt-4">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted">Class Boards</span>
            <button onClick={() => openClassModal("join")} className="text-muted hover:text-ink transition-colors" title="Join a class">
              <IconPlus />
            </button>
          </div>
          {studentClasses.length === 0 && archivedStudentClasses.length === 0 ? (
            <button
              onClick={() => openClassModal("join")}
              className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-muted hover:bg-ink/5 hover:text-ink transition-colors"
            >
              + Join a class
            </button>
          ) : (
            <>
              <DndContext id="sidebar-student-classes" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleClassDragEnd(studentClasses)}>
                <SortableContext items={studentClasses.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  {studentClasses.map((c) => (
                    <SortableClassItem
                      key={c.id}
                      cls={c}
                      isActive={activeClassId === c.id}
                      onClick={() => { onClassSelect(c); setMobileOpen(false); }}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              {archivedStudentClasses.length > 0 && (
                <>
                  <button
                    onClick={() => setShowArchivedBoards((v) => !v)}
                    className="w-full text-left px-2 py-1 mt-0.5 rounded-lg text-[11px] text-muted/70 hover:text-ink transition-colors"
                  >
                    {showArchivedBoards ? "Hide archived" : `Show archived (${archivedStudentClasses.length})`}
                  </button>
                  {showArchivedBoards && archivedStudentClasses.map((c) => renderClassItem(c, true))}
                </>
              )}
            </>
          )}
        </div>

        {/* Classes — classes the user created / teaches */}
        <div className="px-3 mt-4">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted">Classes</span>
            <button onClick={() => openClassModal("create")} className="text-muted hover:text-ink transition-colors" title="Create a class">
              <IconPlus />
            </button>
          </div>
          {educatorClasses.length === 0 && archivedEducatorClasses.length === 0 ? (
            <button
              onClick={() => openClassModal("create")}
              className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-muted hover:bg-ink/5 hover:text-ink transition-colors"
            >
              + Create a class
            </button>
          ) : (
            <>
              <DndContext id="sidebar-educator-classes" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleClassDragEnd(educatorClasses)}>
                <SortableContext items={educatorClasses.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  {educatorClasses.map((c) => (
                    <SortableClassItem
                      key={c.id}
                      cls={c}
                      isActive={activeClassId === c.id}
                      onClick={() => { onClassSelect(c); setMobileOpen(false); }}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              {archivedEducatorClasses.length > 0 && (
                <>
                  <button
                    onClick={() => setShowArchivedClasses((v) => !v)}
                    className="w-full text-left px-2 py-1 mt-0.5 rounded-lg text-[11px] text-muted/70 hover:text-ink transition-colors"
                  >
                    {showArchivedClasses ? "Hide archived" : `Show archived (${archivedEducatorClasses.length})`}
                  </button>
                  {showArchivedClasses && archivedEducatorClasses.map((c) => renderClassItem(c, true))}
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="py-3 border-t border-border/60 px-3 space-y-0.5">
        {desktopNavItems.map((item) => (
          <button
            key={item.id}
            onClick={() => { onPanelChange(item.id); setMobileOpen(false); }}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
              activePanel === item.id && !activeClassId
                ? "bg-ink/8 text-ink font-medium"
                : "text-ink/70 hover:bg-ink/5 hover:text-ink"
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      <div data-account-section="" className="relative border-t border-border/60 py-3">
        {accountOpen && account && (
          <div className="absolute bottom-full left-3 right-3 mb-1.5 rounded-xl border border-border bg-card-bg shadow-modal py-1.5 z-20 overflow-hidden">

            {popupView === "menu" && (
              <>
                <div className="px-3 py-2 border-b border-border/60">
                  <p className="text-sm font-medium text-ink truncate">{account.name || "Your account"}</p>
                  <p className="text-xs text-muted truncate">{account.handle ? `@${account.handle}` : account.email}</p>
                </div>

                <button
                  onClick={openNotifications}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-ink/80 hover:bg-ink/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M9 2a6 6 0 0 1 6 6v3.5l1.5 2.5H1.5L3 11.5V8A6 6 0 0 1 9 2z" />
                      <path d="M7 15.5a2 2 0 0 0 4 0" />
                    </svg>
                    Notifications
                  </div>
                  {unreadCount > 0 && (
                    <span className="min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded-full bg-red-500 text-white px-1">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => { setAccountOpen(false); setConfirmSignOut(true); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink/80 hover:text-red-500 hover:bg-red-500/8 transition-colors"
                >
                  <IconSignOut />
                  Sign out
                </button>
              </>
            )}

            {popupView === "notifications" && (
              <>
                <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
                  <button onClick={() => setPopupView("menu")} className="flex items-center gap-1.5 text-xs text-muted hover:text-ink transition-colors">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M8 2L4 6l4 4" />
                    </svg>
                    Back
                  </button>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-xs text-muted hover:text-ink transition-colors">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifLoading && notifications.length === 0 ? (
                    <p className="px-3 py-4 text-xs text-muted text-center">Loading…</p>
                  ) : notifications.length === 0 ? (
                    <p className="px-3 py-4 text-xs text-muted text-center">No notifications yet</p>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className={`px-3 py-2.5 border-b border-border/40 last:border-0 ${!n.read ? "bg-[var(--c-accent-lt)] dark:bg-accent/5" : ""}`}>
                        <div className="flex items-start gap-2">
                          <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${!n.read ? "bg-accent" : "bg-transparent"}`} />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-ink leading-snug">{n.title}</p>
                            {n.body && <p className="text-xs text-muted mt-0.5 line-clamp-2">{n.body}</p>}
                            <p className="text-[10px] text-muted/60 mt-0.5">{timeAgo(n.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

          </div>
        )}

        <button
          onClick={() => setAccountOpen((v) => !v)}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-ink/5 transition-colors text-left"
          aria-label="Account menu"
        >
          <div className="relative flex-shrink-0">
            {account ? (
              <Avatar name={account.name} color={account.color} size="lg" />
            ) : (
              <span className="w-7 h-7 rounded-full bg-ink/10 motion-safe:animate-pulse" />
            )}
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-card-bg" />
            )}
          </div>
          <span className="flex-1 min-w-0 text-sm font-medium text-ink truncate">
            {account ? account.name || "Account" : ""}
          </span>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`flex-shrink-0 text-muted transition-transform ${accountOpen ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

    </>
  );

  return (
    <>
      <aside className="hidden md:flex w-60 flex-shrink-0 flex-col bg-paper border-r border-border/70 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar — full-screen base layer. The board (main) sits on top at
          a higher z-index and slides off to the right to reveal this. It is only
          interactive once revealed; otherwise the board fully occludes it. */}
      <aside
        className={`fixed inset-0 z-20 bg-paper flex flex-col md:hidden ${mobileOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!mobileOpen}
      >
        {sidebarContent}
      </aside>
      <ConfirmModal
        isOpen={confirmSignOut}
        title="Sign out"
        message="Are you sure you want to sign out of Kanbedu?"
        confirmLabel="Sign out"
        cancelLabel="Cancel"
        danger
        onClose={() => setConfirmSignOut(false)}
        onConfirm={handleSignOut}
      />
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
      <CreateJoinClassModal
        isOpen={isClassModalOpen}
        onClose={() => setIsClassModalOpen(false)}
        onCreated={onClassesReload}
        defaultMode={classModalMode}
      />
    </>
  );
}
