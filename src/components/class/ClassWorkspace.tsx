"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import GroupBoardView from "./GroupBoardView";

function PanelSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6 space-y-3" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-14 rounded-xl bg-border/30 dark:bg-border/20 motion-safe:animate-pulse" />
      ))}
    </div>
  );
}

const MonitorPanel = dynamic(() => import("./MonitorPanel"), { ssr: false, loading: () => <PanelSkeleton /> });
const IntegrityPanel = dynamic(() => import("./IntegrityPanel"), { ssr: false, loading: () => <PanelSkeleton /> });
const ParticipationPanel = dynamic(() => import("./ParticipationPanel"), { ssr: false, loading: () => <PanelSkeleton /> });
const RosterPanel = dynamic(() => import("./RosterPanel"), { ssr: false, loading: () => <PanelSkeleton /> });
const PresetEditor = dynamic(() => import("./PresetEditor"), { ssr: false, loading: () => <PanelSkeleton /> });
const ClassSettingsPanel = dynamic(() => import("./ClassSettingsPanel"), { ssr: false, loading: () => <PanelSkeleton /> });

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

type Tab = "monitor" | "integrity" | "participation" | "roster" | "preset" | "settings";


export default function ClassWorkspace(props: Props) {
  const { classId, name, term, archived, ownerId, currentUserId, joinCode, groups } = props;
  const [tab, setTab] = useState<Tab>("monitor");
  // Track which tabs have ever been opened so we can keep them mounted after
  // first visit — switching back is instant with no re-fetch.
  const [visitedTabs, setVisitedTabs] = useState<Set<Tab>>(new Set<Tab>(["monitor"]));
  const [openBoard, setOpenBoard] = useState<{ boardId: string; name: string; secret: string | null } | null>(null);
  // Bumped whenever Roster creates/deletes a group, so Monitor and Integrity
  // (which stay mounted across tab switches) refetch instead of showing stale data.
  const [groupsVersion, setGroupsVersion] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      // Don't hijack Esc while a modal (e.g. a delete confirmation) is open —
      // the user expects Esc to dismiss the dialog, not leave the class.
      if (document.querySelector("[data-modal-open]")) return;
      if (openBoard) { setOpenBoard(null); } else { router.push("/"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openBoard, router]); // openBoard in deps so the closure sees current value

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
      <Link href="/" className="text-sm text-muted hover:text-ink transition-colors">Back</Link>
    </header>
  );

  // ---- Educator view ----
  if (openBoard) {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <header className="flex-shrink-0 flex items-center justify-between px-6 md:px-10 pt-6 pb-4 border-b border-border/60">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="text-lg font-bold tracking-tight text-ink hover:opacity-70 transition-opacity">kanbedu</Link>
            <span className="text-muted">/</span>
            <button onClick={() => setOpenBoard(null)} className="text-base font-semibold text-ink/60 hover:text-ink transition-colors truncate">{name}</button>
            <span className="text-muted">/</span>
            <span className="text-base font-semibold text-ink truncate">{openBoard.name}</span>
          </div>
          <button onClick={() => setOpenBoard(null)} className="text-sm text-muted hover:text-ink transition-colors flex-shrink-0">Back</button>
        </header>
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
    { id: "integrity", label: "Integrity" },
    { id: "participation", label: "Participation" },
    { id: "roster", label: "Roster" },
    { id: "preset", label: "Preset" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {header}

      <div className="flex-shrink-0 relative border-b border-border/60">
        <nav className="flex items-center gap-1 px-3 md:px-10 overflow-x-auto no-scrollbar">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setVisitedTabs((prev) => prev.has(t.id) ? prev : new Set([...prev, t.id]));
              }}
              className={`flex-shrink-0 whitespace-nowrap px-3 py-2.5 text-sm transition-colors border-b-2 -mb-px ${
                tab === t.id ? "border-ink text-ink font-medium" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-paper to-transparent md:hidden" />
      </div>

      {archived && (
        <div className="flex-shrink-0 flex items-center gap-2 px-6 md:px-10 py-2 text-[11px] font-medium bg-amber-50 border-b border-amber-200 text-amber-900 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-200">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" /></svg>
          This class is archived. Management is read-only. Unarchive it in Settings to make changes.
        </div>
      )}

      <div className={tab === "monitor" ? "flex-1 flex flex-col overflow-hidden" : "hidden"}>
        {visitedTabs.has("monitor") && <MonitorPanel classId={classId} onOpenBoard={openGroupBoard} reloadSignal={groupsVersion} />}
      </div>
      <div className={tab === "integrity" ? "flex-1 flex flex-col overflow-hidden" : "hidden"}>
        {visitedTabs.has("integrity") && <IntegrityPanel classId={classId} onOpenBoard={openGroupBoard} reloadSignal={groupsVersion} />}
      </div>
      <div className={tab === "participation" ? "flex-1 flex flex-col overflow-hidden" : "hidden"}>
        {visitedTabs.has("participation") && <ParticipationPanel classId={classId} onOpenBoard={openGroupBoard} reloadSignal={groupsVersion} />}
      </div>
      <div className={tab === "roster" ? "flex-1 flex flex-col overflow-hidden" : "hidden"}>
        {visitedTabs.has("roster") && (
          <RosterPanel
            classId={classId}
            ownerId={ownerId}
            onOpenBoard={openGroupBoard}
            onChanged={() => setGroupsVersion((v) => v + 1)}
            readOnly={archived}
          />
        )}
      </div>
      <div className={tab === "preset" ? "flex-1 flex flex-col overflow-hidden" : "hidden"}>
        {visitedTabs.has("preset") && <PresetEditor classId={classId} readOnly={archived} />}
      </div>
      <div className={tab === "settings" ? "flex-1 flex flex-col overflow-hidden" : "hidden"}>
        {visitedTabs.has("settings") && (
          <ClassSettingsPanel
            classId={classId}
            initialName={name}
            initialTerm={term}
            archived={archived}
            joinCode={joinCode || ""}
          />
        )}
      </div>
    </div>
  );
}
