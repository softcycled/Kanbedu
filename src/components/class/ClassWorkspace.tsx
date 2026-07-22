"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import GroupBoardView from "./GroupBoardView";
import { trackEvent } from "@/lib/analytics";
import { DropdownMenu, DropdownItem } from "../ui/DropdownMenu";

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

function TabBar({ tabs, tab, setTab, setVisitedTabs }: {
  tabs: { id: Tab; label: string }[];
  tab: Tab;
  setTab: (t: Tab) => void;
  setVisitedTabs: React.Dispatch<React.SetStateAction<Set<Tab>>>;
}) {
  const navRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollLeft > 8);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="flex-shrink-0 relative border-b border-border/60">
      <nav ref={navRef} className="flex items-center gap-1 px-3 md:px-10 overflow-x-auto no-scrollbar">
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
      {scrolled && <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-paper to-transparent md:hidden" />}
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-paper to-transparent md:hidden" />
    </div>
  );
}


// Discord-style board title for the educator's per-group view: the group name
// doubles as a dropdown trigger (mirrors BoardHeaderMenu on personal boards).
// Only action is renaming — invite/leave don't apply here, the class-level
// Settings tab already owns those.
function GroupTitleMenu({ name, onRename }: { name: string; onRename: (newName: string) => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) { inputRef.current?.focus(); inputRef.current?.select(); }
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        defaultValue={name}
        aria-label="Group name"
        onBlur={(e) => { setEditing(false); onRename(e.target.value); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { e.stopPropagation(); setEditing(false); }
        }}
        className="text-base md:text-xl font-bold tracking-tight text-ink bg-transparent outline-none border-b border-border focus:border-ink/30 min-w-0 w-full max-w-[60vw] md:max-w-xs"
      />
    );
  }

  return (
    <div className="relative min-w-0">
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        aria-label="Group board menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 -mx-1.5 px-1.5 py-0.5 rounded-lg hover:bg-ink/5 transition-colors min-w-0"
      >
        <span className="text-base md:text-xl font-bold tracking-tight text-ink truncate">{name}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`flex-shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <DropdownMenu open={open} onClose={() => setOpen(false)} anchorRef={triggerRef} className="w-[212px]">
        <DropdownItem
          onClick={() => { setOpen(false); setEditing(true); }}
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          }
        >
          Rename group
        </DropdownItem>
      </DropdownMenu>
    </div>
  );
}

export default function ClassWorkspace(props: Props) {
  const { classId, name, term, archived, ownerId, currentUserId, joinCode, groups } = props;
  const [tab, setTab] = useState<Tab>("monitor");
  // Track which tabs have ever been opened so we can keep them mounted after
  // first visit — switching back is instant with no re-fetch.
  const [visitedTabs, setVisitedTabs] = useState<Set<Tab>>(new Set<Tab>(["monitor"]));
  const [openBoard, setOpenBoard] = useState<{ boardId: string; name: string; secret: string | null; groupId: string; focusTaskId?: string } | null>(null);
  // Bumped whenever Roster creates/deletes a group, so Monitor and Integrity
  // (which stay mounted across tab switches) refetch instead of showing stale data.
  const [groupsVersion, setGroupsVersion] = useState(0);
  const router = useRouter();

  useEffect(() => {
    trackEvent("panel_view", { panel: tab, context: "class" });
  }, [tab]);

  useEffect(() => {
    if (openBoard) trackEvent("board_view", { boardType: "class" });
  }, [openBoard?.boardId]);

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
    (g: { id: string; name: string; boardId: string; focusTaskId?: string }) => {
      const known = groups.find((gr) => gr.boardId === g.boardId || gr.id === g.id);
      setOpenBoard({ boardId: g.boardId, name: g.name, secret: known?.realtimeSecret ?? null, groupId: g.id, focusTaskId: g.focusTaskId });
    },
    [groups]
  );

  // Renames the currently-open group from its board-header dropdown. Optimistic
  // with rollback; also bumps groupsVersion so Monitor/Integrity/Roster show the
  // new name when the educator switches back to those tabs.
  const renameOpenGroupBoard = useCallback(async (newName: string) => {
    setOpenBoard((current) => {
      if (!current) return current;
      const trimmed = newName.trim();
      if (!trimmed || trimmed === current.name) return current;

      const prevName = current.name;
      fetch(`/api/classes/${classId}/groups`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: current.groupId, name: trimmed }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("rename failed");
          setGroupsVersion((v) => v + 1);
        })
        .catch(() => {
          setOpenBoard((c) => (c && c.groupId === current.groupId ? { ...c, name: prevName } : c));
        });

      return { ...current, name: trimmed };
    });
  }, [classId]);

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
        <header className="flex-shrink-0 flex items-center justify-between px-4 md:px-10 pt-4 md:pt-6 pb-4 border-b border-border/60">
          {/* Mobile: compact back button — board has its own title row */}
          <button onClick={() => setOpenBoard(null)} className="flex items-center gap-1.5 min-w-0 md:hidden text-sm font-medium text-muted hover:text-ink transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><path d="M15 18l-6-6 6-6"/></svg>
            <span className="truncate">{name}</span>
          </button>
          {/* Desktop: breadcrumb back to the class; the group name itself lives in
              the board's own header row below as a dropdown (Rename group). */}
          <div className="hidden md:flex items-center gap-3 min-w-0">
            <Link href="/" className="text-lg font-bold tracking-tight text-ink hover:opacity-70 transition-opacity">kanbedu</Link>
            <span className="text-muted">/</span>
            <button onClick={() => setOpenBoard(null)} className="text-base font-semibold text-ink/60 hover:text-ink transition-colors truncate">{name}</button>
          </div>
          <button onClick={() => setOpenBoard(null)} className="hidden md:block text-sm text-muted hover:text-ink transition-colors flex-shrink-0">Back</button>
        </header>
        <GroupBoardView
          boardId={openBoard.boardId}
          boardName={openBoard.name}
          currentUserId={currentUserId}
          realtimeSecret={openBoard.secret}
          headerTitle={<GroupTitleMenu name={openBoard.name} onRename={renameOpenGroupBoard} />}
          canViewTrash
          focusTaskId={openBoard.focusTaskId}
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

      <TabBar tabs={tabs} tab={tab} setTab={setTab} setVisitedTabs={setVisitedTabs} />

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
            role={props.role === "ta" ? "ta" : "educator"}
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
