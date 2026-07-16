"use client";

import { useState, useRef, useEffect, memo } from "react";
import { BoardMemberData, Tag } from "@/lib/types";
import Avatar from "./Avatar";
import SearchIcon from "./SearchIcon";
import { DropdownMenu, DropdownItem } from "./ui/DropdownMenu";

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
  tags: Pick<Tag, "id" | "name" | "color">[];
  totalTasks: number;
  filteredTasksCount: number;
  // Public/read-only board views never expose assignee data, so the whole
  // Assignee filter (button + dropdown + mobile section) is skipped.
  hideAssignee?: boolean;
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
  hideAssignee = false,
}: Props) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const assigneeTriggerRef = useRef<HTMLButtonElement>(null);
  const tagsTriggerRef = useRef<HTMLButtonElement>(null);
  const priorityTriggerRef = useRef<HTMLButtonElement>(null);
  // Local state for the input so typing feels instant; debounced propagation avoids
  // re-filtering the full task list on every keystroke.
  const [inputValue, setInputValue] = useState(searchQuery);

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
    label: React.ReactNode,
    icon?: React.ReactNode
  ) => (
    <DropdownItem key={key} checked={checked} onClick={onClick} icon={icon}>
      {label}
    </DropdownItem>
  );

  const assigneeRows = (
    <>
      {optionRow(
        "unassigned",
        selectedAssignees.includes("unassigned"),
        () => toggleSelection(selectedAssignees, "unassigned", setSelectedAssignees),
        "Unassigned",
        <Avatar size="sm" />
      )}
      {members.map((m) =>
        optionRow(
          m.id,
          selectedAssignees.includes(m.id),
          () => toggleSelection(selectedAssignees, m.id, setSelectedAssignees),
          m.name,
          <Avatar name={m.name} color={m.color} size="sm" />
        )
      )}
    </>
  );

  const tagRows = (
    <>
      {tags.length === 0 && <p className="px-2.5 py-4 text-center text-xs text-muted">No tags found.</p>}
      {tags.map((t) =>
        optionRow(
          t.id,
          selectedTags.includes(t.id),
          () => toggleSelection(selectedTags, t.id, setSelectedTags),
          t.name,
          <div className="w-[11px] h-[11px] rounded-full" style={{ backgroundColor: t.color }} />
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
          <span className="capitalize">{p}</span>
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
      <div className="hidden sm:flex items-center gap-2 ml-auto flex-wrap justify-end">
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
        {!hideAssignee && (
          <div className="relative">
            <button ref={assigneeTriggerRef} onClick={() => setOpenDropdown(openDropdown === "assignee" ? null : "assignee")} aria-expanded={openDropdown === "assignee"} aria-haspopup="menu" className={filterButtonClass(selectedAssignees.length > 0)}>
              <span>Assignee</span>
              {selectedAssignees.length > 0 && countBadge(selectedAssignees.length)}
              {chevron(openDropdown === "assignee")}
            </button>
            <DropdownMenu open={openDropdown === "assignee"} onClose={() => setOpenDropdown(null)} anchorRef={assigneeTriggerRef} align="right" className="w-56 sm:left-0 sm:right-auto">
              {assigneeRows}
            </DropdownMenu>
          </div>
        )}

        {/* Tags */}
        <div className="relative">
          <button ref={tagsTriggerRef} onClick={() => setOpenDropdown(openDropdown === "tags" ? null : "tags")} aria-expanded={openDropdown === "tags"} aria-haspopup="menu" className={filterButtonClass(selectedTags.length > 0)}>
            <span>Tags</span>
            {selectedTags.length > 0 && countBadge(selectedTags.length)}
            {chevron(openDropdown === "tags")}
          </button>
          <DropdownMenu open={openDropdown === "tags"} onClose={() => setOpenDropdown(null)} anchorRef={tagsTriggerRef} align="left" className="w-56">
            {tagRows}
          </DropdownMenu>
        </div>

        {/* Priority */}
        <div className="relative">
          <button ref={priorityTriggerRef} onClick={() => setOpenDropdown(openDropdown === "priority" ? null : "priority")} aria-expanded={openDropdown === "priority"} aria-haspopup="menu" className={filterButtonClass(selectedPriorities.length > 0)}>
            <span>Priority</span>
            {selectedPriorities.length > 0 && countBadge(selectedPriorities.length)}
            {chevron(openDropdown === "priority")}
          </button>
          <DropdownMenu open={openDropdown === "priority"} onClose={() => setOpenDropdown(null)} anchorRef={priorityTriggerRef} align="right" className="w-48 sm:left-0 sm:right-auto">
            {priorityRows}
          </DropdownMenu>
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
              {!hideAssignee && (
                <div>
                  <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-muted">Assignee</p>
                  <div className="space-y-1">{assigneeRows}</div>
                </div>
              )}
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

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}
