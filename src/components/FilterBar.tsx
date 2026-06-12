"use client";

import { useState, useRef, useEffect, memo } from "react";
import { BoardMemberData, Tag } from "@/lib/types";
import Avatar from "./Avatar";

interface Props {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedAssignees: string[];
  setSelectedAssignees: (ids: string[]) => void;
  selectedTags: string[];
  setSelectedTags: (ids: string[]) => void;
  selectedPriorities: string[];
  setSelectedPriorities: (ps: string[]) => void;
  members: BoardMemberData[];
  tags: Tag[];
  totalTasks: number;
  filteredTasksCount: number;
}

function FilterBar({
  searchQuery,
  setSearchQuery,
  selectedAssignees,
  setSelectedAssignees,
  selectedTags,
  setSelectedTags,
  selectedPriorities,
  setSelectedPriorities,
  members,
  tags,
  totalTasks,
  filteredTasksCount,
}: Props) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // Local state for the input so typing feels instant; debounced propagation avoids
  // re-filtering the full task list on every keystroke.
  const [inputValue, setInputValue] = useState(searchQuery);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!openDropdown) return;
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("keydown", keyHandler);
    return () => document.removeEventListener("keydown", keyHandler);
  }, [openDropdown]);

  // Propagate search to parent after 150 ms of inactivity
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(inputValue), 150);
    return () => clearTimeout(timer);
  }, [inputValue, setSearchQuery]);

  const toggleSelection = (list: string[], item: string, setter: (val: string[]) => void) => {
    if (list.includes(item)) {
      setter(list.filter((i) => i !== item));
    } else {
      setter([...list, item]);
    }
  };

  const hasFilters = searchQuery || selectedAssignees.length > 0 || selectedTags.length > 0 || selectedPriorities.length > 0;
  const activeFilterCount = selectedAssignees.length + selectedTags.length + selectedPriorities.length;

  const clearAll = () => {
    setInputValue("");
    setSearchQuery("");
    setSelectedAssignees([]);
    setSelectedTags([]);
    setSelectedPriorities([]);
  };

  // A single selectable row, reused by desktop dropdowns and the mobile sheet.
  const optionRow = (
    key: string,
    checked: boolean,
    onClick: () => void,
    content: React.ReactNode
  ) => (
    <button
      key={key}
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-column-bg cursor-pointer transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <div className="flex items-center gap-2">{content}</div>
      {checked && <CheckIcon />}
    </button>
  );

  const assigneeRows = (
    <>
      {optionRow(
        "unassigned",
        selectedAssignees.includes("unassigned"),
        () => toggleSelection(selectedAssignees, "unassigned", setSelectedAssignees),
        <>
          <Avatar size="sm" />
          <span className="text-sm text-ink">Unassigned</span>
        </>
      )}
      {members.map((m) =>
        optionRow(
          m.id,
          selectedAssignees.includes(m.id),
          () => toggleSelection(selectedAssignees, m.id, setSelectedAssignees),
          <>
            <Avatar name={m.name} color={m.color} size="sm" />
            <span className="text-sm text-ink">{m.name}</span>
          </>
        )
      )}
    </>
  );

  const tagRows = (
    <>
      {tags.length === 0 && <p className="px-3 py-4 text-center text-xs text-muted">No tags found.</p>}
      {tags.map((t) =>
        optionRow(
          t.id,
          selectedTags.includes(t.id),
          () => toggleSelection(selectedTags, t.id, setSelectedTags),
          <>
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
            <span className="text-sm text-ink">{t.name}</span>
          </>
        )
      )}
    </>
  );

  const priorityRows = (
    <>
      {["low", "medium", "high", "urgent"].map((p) =>
        optionRow(
          p,
          selectedPriorities.includes(p),
          () => toggleSelection(selectedPriorities, p, setSelectedPriorities),
          <span className="text-sm text-ink capitalize">{p}</span>
        )
      )}
    </>
  );

  const filterButtonClass = (active: boolean) =>
    `flex items-center gap-2 px-3 py-1 rounded-xl border text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
      active ? "bg-accent/10 border-accent/30 text-accent" : "bg-paper border-border/60 text-muted hover:text-ink hover:border-border"
    }`;

  const chevron = (open: boolean) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform ${open ? "rotate-180" : ""}`}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );

  const countBadge = (n: number) => (
    <span className="bg-accent text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{n}</span>
  );

  return (
    <>
      {/* ── Desktop / tablet: inline controls ─────────────────────── */}
      <div ref={containerRef} className="hidden sm:flex items-center gap-2 ml-auto flex-wrap justify-end">
        {/* Search */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <SearchIcon />
          </div>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search tasks…"
            className="w-28 sm:w-48 bg-ink/5 border border-border/60 hover:border-border focus:border-ink/30 focus:bg-column-bg rounded-lg pl-9 pr-4 py-1 text-sm text-ink outline-none transition-colors"
          />
        </div>

        {/* Assignees */}
        <div className="relative">
          <button onClick={() => setOpenDropdown(openDropdown === "assignee" ? null : "assignee")} aria-expanded={openDropdown === "assignee"} aria-haspopup="menu" className={filterButtonClass(selectedAssignees.length > 0)}>
            <span>Assignee</span>
            {selectedAssignees.length > 0 && countBadge(selectedAssignees.length)}
            {chevron(openDropdown === "assignee")}
          </button>
          {openDropdown === "assignee" && (
            <div role="menu" className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-56 bg-card-bg border border-border rounded-xl shadow-modal z-50 overflow-hidden">
              {assigneeRows}
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="relative">
          <button onClick={() => setOpenDropdown(openDropdown === "tags" ? null : "tags")} aria-expanded={openDropdown === "tags"} aria-haspopup="menu" className={filterButtonClass(selectedTags.length > 0)}>
            <span>Tags</span>
            {selectedTags.length > 0 && countBadge(selectedTags.length)}
            {chevron(openDropdown === "tags")}
          </button>
          {openDropdown === "tags" && (
            <div role="menu" className="absolute left-0 mt-2 w-56 bg-card-bg border border-border rounded-xl shadow-modal z-50 overflow-hidden">
              {tagRows}
            </div>
          )}
        </div>

        {/* Priority */}
        <div className="relative">
          <button onClick={() => setOpenDropdown(openDropdown === "priority" ? null : "priority")} aria-expanded={openDropdown === "priority"} aria-haspopup="menu" className={filterButtonClass(selectedPriorities.length > 0)}>
            <span>Priority</span>
            {selectedPriorities.length > 0 && countBadge(selectedPriorities.length)}
            {chevron(openDropdown === "priority")}
          </button>
          {openDropdown === "priority" && (
            <div role="menu" className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-48 bg-card-bg border border-border rounded-xl shadow-modal z-50 overflow-hidden">
              {priorityRows}
            </div>
          )}
        </div>

        {/* Count + clear */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted font-medium whitespace-nowrap">
            {hasFilters ? <span>Showing {filteredTasksCount} of {totalTasks} tasks</span> : <span>{totalTasks} tasks</span>}
          </span>
          {hasFilters && (
            <button onClick={clearAll} className="text-xs font-bold text-accent hover:text-accent/80 transition-colors px-2 py-1">Clear</button>
          )}
        </div>
      </div>

      {/* ── Mobile: search + a single Filters button that opens a sheet ── */}
      <div className="flex sm:hidden items-center gap-2 ml-auto flex-1 min-w-0">
        <div className="relative flex-1 min-w-0">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <SearchIcon />
          </div>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search…"
            className="w-full bg-column-bg/50 border border-border/50 rounded-xl pl-9 pr-3 py-1.5 text-sm text-ink outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 transition-all"
          />
        </div>
        <button onClick={() => setMobileOpen(true)} className={`${filterButtonClass(activeFilterCount > 0)} flex-shrink-0 py-1.5`} aria-label="Open filters">
          <FilterIcon />
          <span>Filters</span>
          {activeFilterCount > 0 && countBadge(activeFilterCount)}
        </button>
      </div>

      {/* Mobile sheet */}
      {mobileOpen && (
        <div role="dialog" aria-modal="true" aria-label="Filters" className="sm:hidden fixed inset-0 z-50" data-modal-open>
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[82vh] overflow-y-auto bg-card-bg rounded-t-2xl border-t border-border safe-area-bottom">
            <div className="sticky top-0 bg-card-bg flex items-center justify-between px-4 py-3 border-b border-border/60">
              <span className="text-sm font-semibold text-ink">Filters</span>
              <div className="flex items-center gap-3">
                {hasFilters && <button onClick={clearAll} className="text-xs font-bold text-accent">Clear all</button>}
                <button onClick={() => setMobileOpen(false)} className="text-muted hover:text-ink p-1" aria-label="Close filters">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            </div>
            <div className="p-3 space-y-4">
              <div>
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-muted">Assignee</p>
                <div className="space-y-1">{assigneeRows}</div>
              </div>
              <div>
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-muted">Tags</p>
                <div className="space-y-1">{tagRows}</div>
              </div>
              <div>
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-muted">Priority</p>
                <div className="space-y-1">{priorityRows}</div>
              </div>
              <p className="text-center text-xs text-muted pt-1">
                {hasFilters ? `Showing ${filteredTasksCount} of ${totalTasks} tasks` : `${totalTasks} tasks`}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default memo(FilterBar);

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
