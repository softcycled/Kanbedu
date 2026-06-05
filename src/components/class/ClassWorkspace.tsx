"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import GroupBoardView from "./GroupBoardView";

const MonitorPanel = dynamic(() => import("./MonitorPanel"), { ssr: false, loading: () => <div /> });
const RosterPanel = dynamic(() => import("./RosterPanel"), { ssr: false, loading: () => <div /> });
const PresetEditor = dynamic(() => import("./PresetEditor"), { ssr: false, loading: () => <div /> });
const ClassSettingsPanel = dynamic(() => import("./ClassSettingsPanel"), { ssr: false, loading: () => <div /> });

export interface WorkspaceGroup {
  id: string;
  name: string;
  boardId: string;
  realtimeSecret: string | null;
}

interface Props {
  classId: string;
  name: string;
  term: string | null;
  archived: boolean;
  role: "educator" | "ta" | "student";
  ownerId: string;
  currentUserId: string;
  joinCode?: string;
  // Educator: all groups. Student: only their own (one entry) or none.
  groups: WorkspaceGroup[];
  myGroupId?: string | null;
  myGroupName?: string | null;
}

type Tab = "monitor" | "roster" | "preset" | "settings";

function BackBar({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="flex-shrink-0 flex items-center gap-3 px-6 md:px-10 py-3 border-b border-border/60">
      <button onClick={onBack} className="text-sm text-muted hover:text-ink transition-colors flex items-center gap-1">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        Back
      </button>
      <span className="text-sm font-medium text-ink truncate">{title}</span>
    </div>
  );
}

export default function ClassWorkspace(props: Props) {
  const { classId, name, term, archived, role, ownerId, currentUserId, joinCode, groups, myGroupId, myGroupName } = props;
  const isEducator = role === "educator" || role === "ta";
  const [tab, setTab] = useState<Tab>("monitor");
  const [openBoard, setOpenBoard] = useState<{ boardId: string; name: string; secret: string | null } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (openBoard) setOpenBoard(null);
      else router.push("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openBoard, router]);

  // Opening a board takes the board info from the caller (Roster/Monitor always
  // have fresh data), since groups created in-session aren't in the page-load
  // `groups` prop. The realtime secret is only known for groups present at load;
  // newly created ones simply open without live updates until the next reload.
  const openGroupBoard = useCallback(
    (g: { id: string; name: string; boardId: string }) => {
      const known = groups.find((gr) => gr.boardId === g.boardId || gr.id === g.id);
      setOpenBoard({ boardId: g.boardId, name: g.name, secret: known?.realtimeSecret ?? null });
    },
    [groups]
  );

  const header = (
    <header className="flex-shrink-0 flex items-center justify-between px-6 md:px-10 pt-6 pb-4 border-b border-border/60">
      <div className="flex items-center gap-3 min-w-0">
        <Link href="/" className="text-lg font-bold tracking-tight text-ink hover:opacity-70 transition-opacity">kanbedu</Link>
        <span className="text-muted">/</span>
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-ink truncate">{name}</h1>
          {term && <p className="text-[11px] text-muted -mt-0.5">{term}</p>}
        </div>
        {archived && <span className="text-[10px] px-2 py-0.5 rounded-full bg-ink/10 text-muted">Archived</span>}
      </div>
      <Link href="/" className="text-xs text-muted hover:text-ink transition-colors">← Back to app</Link>
    </header>
  );

  // ---- Student view: their board, or the lobby waiting screen ----
  if (!isEducator) {
    const myBoard = groups.find((g) => g.id === myGroupId) || groups[0];
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        {header}
        {myGroupId && myBoard ? (
          <GroupBoardView
            boardId={myBoard.boardId}
            boardName={myGroupName || myBoard.name}
            currentUserId={currentUserId}
            realtimeSecret={myBoard.realtimeSecret}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="w-12 h-12 rounded-full bg-ink/5 flex items-center justify-center mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-muted"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></svg>
            </div>
            <h2 className="text-base font-semibold text-ink">You&apos;re in {name}</h2>
            <p className="text-sm text-muted mt-1 max-w-sm">Waiting to be placed into a group. Your teacher will assign you shortly — your group board will appear here.</p>
          </div>
        )}
      </div>
    );
  }

  // ---- Educator view ----
  if (openBoard) {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        {header}
        <BackBar onBack={() => setOpenBoard(null)} title={openBoard.name} />
        <GroupBoardView
          boardId={openBoard.boardId}
          boardName={openBoard.name}
          currentUserId={currentUserId}
          realtimeSecret={openBoard.secret}
        />
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "monitor", label: "Monitor" },
    { id: "roster", label: "Roster" },
    { id: "preset", label: "Preset" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {header}

      <nav className="flex-shrink-0 flex items-center gap-1 px-6 md:px-10 border-b border-border/60">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2.5 text-sm transition-colors border-b-2 -mb-px ${
              tab === t.id ? "border-ink text-ink font-medium" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "monitor" && <MonitorPanel classId={classId} onOpenBoard={openGroupBoard} />}
      {tab === "roster" && <RosterPanel classId={classId} ownerId={ownerId} onOpenBoard={openGroupBoard} />}
      {tab === "preset" && <PresetEditor classId={classId} />}
      {tab === "settings" && (
        <ClassSettingsPanel
          classId={classId}
          initialName={name}
          initialTerm={term}
          archived={archived}
          joinCode={joinCode || ""}
        />
      )}
    </div>
  );
}
