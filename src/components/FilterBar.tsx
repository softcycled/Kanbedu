"use client";

import { useState, useRef, useEffect } from "react";
import { BoardMemberData, Tag } from "@/lib/types";
import { getTextColorForBg } from "@/lib/labelPalette";

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

export default function FilterBar({
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleSelection = (list: string[], item: string, setter: (val: string[]) => void) => {
    if (list.includes(item)) {
      setter(list.filter((i) => i !== item));
    } else {
      setter([...list, item]);
    }
  };

  const hasFilters = searchQuery || selectedAssignees.length > 0 || selectedTags.length > 0 || selectedPriorities.length > 0;

  const clearAll = () => {
    setSearchQuery("");
    setSelectedAssignees([]);
    setSelectedTags([]);
    setSelectedPriorities([]);
  };

  return (
    <div ref={containerRef} className="flex items-center gap-2 ml-auto flex-wrap justify-end">
      {/* Search */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tasks…"
          className="w-48 bg-column-bg/50 border border-border/50 rounded-xl pl-9 pr-4 py-1 text-sm text-ink outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 transition-all"
        />
      </div>

      {/* Assignees Dropdown */}
      <div className="relative">
        <button
          onClick={() => setOpenDropdown(openDropdown === "assignee" ? null : "assignee")}
          className={`flex items-center gap-2 px-3 py-1 rounded-xl border text-sm font-medium transition-all ${
            selectedAssignees.length > 0 
              ? "bg-accent/10 border-accent/30 text-accent" 
              : "bg-paper border-border/60 text-muted hover:text-ink hover:border-border"
          }`}
        >
          <span>Assignee</span>
          {selectedAssignees.length > 0 && (
            <span className="bg-accent text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
              {selectedAssignees.length}
            </span>
          )}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform ${openDropdown === "assignee" ? "rotate-180" : ""}`}>
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </button>

        {openDropdown === "assignee" && (
          <div className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-56 bg-card-bg border border-border rounded-xl shadow-modal z-50 p-2 space-y-1">
            <div 
              onClick={() => toggleSelection(selectedAssignees, "unassigned", setSelectedAssignees)}
              className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-column-bg cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-border flex items-center justify-center text-[10px] text-muted font-bold">?</div>
                <span className="text-sm text-ink">Unassigned</span>
              </div>
              {selectedAssignees.includes("unassigned") && <CheckIcon />}
            </div>
            {members.map((m) => (
              <div 
                key={m.id}
                onClick={() => toggleSelection(selectedAssignees, m.id, setSelectedAssignees)}
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-column-bg cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: m.color, color: getTextColorForBg(m.color) }}>
                    {m.name.charAt(0)}
                  </div>
                  <span className="text-sm text-ink">{m.name}</span>
                </div>
                {selectedAssignees.includes(m.id) && <CheckIcon />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tags Dropdown */}
      <div className="relative">
        <button
          onClick={() => setOpenDropdown(openDropdown === "tags" ? null : "tags")}
          className={`flex items-center gap-2 px-3 py-1 rounded-xl border text-sm font-medium transition-all ${
            selectedTags.length > 0 
              ? "bg-accent/10 border-accent/30 text-accent" 
              : "bg-paper border-border/60 text-muted hover:text-ink hover:border-border"
          }`}
        >
          <span>Tags</span>
          {selectedTags.length > 0 && (
            <span className="bg-accent text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
              {selectedTags.length}
            </span>
          )}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform ${openDropdown === "tags" ? "rotate-180" : ""}`}>
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </button>

        {openDropdown === "tags" && (
          <div className="absolute left-0 mt-2 w-56 bg-card-bg border border-border rounded-xl shadow-modal z-50 p-2 space-y-1">
            {tags.length === 0 && <p className="px-3 py-4 text-center text-xs text-muted">No tags found.</p>}
            {tags.map((t) => (
              <div 
                key={t.id}
                onClick={() => toggleSelection(selectedTags, t.id, setSelectedTags)}
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-column-bg cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                  <span className="text-sm text-ink">{t.name}</span>
                </div>
                {selectedTags.includes(t.id) && <CheckIcon />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Priority Dropdown */}
      <div className="relative">
        <button
          onClick={() => setOpenDropdown(openDropdown === "priority" ? null : "priority")}
          className={`flex items-center gap-2 px-3 py-1 rounded-xl border text-sm font-medium transition-all ${
            selectedPriorities.length > 0 
              ? "bg-accent/10 border-accent/30 text-accent" 
              : "bg-paper border-border/60 text-muted hover:text-ink hover:border-border"
          }`}
        >
          <span>Priority</span>
          {selectedPriorities.length > 0 && (
            <span className="bg-accent text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
              {selectedPriorities.length}
            </span>
          )}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform ${openDropdown === "priority" ? "rotate-180" : ""}`}>
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </button>

        {openDropdown === "priority" && (
          <div className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-48 bg-card-bg border border-border rounded-xl shadow-modal z-50 p-2 space-y-1">
            {["low", "medium", "high", "urgent"].map((p) => (
              <div 
                key={p}
                onClick={() => toggleSelection(selectedPriorities, p, setSelectedPriorities)}
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-column-bg cursor-pointer transition-colors"
              >
                <span className="text-sm text-ink capitalize">{p}</span>
                {selectedPriorities.includes(p) && <CheckIcon />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Results Count & Clear */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted font-medium whitespace-nowrap">
          {hasFilters ? (
            <span>Showing {filteredTasksCount} of {totalTasks} tasks</span>
          ) : (
            <span>{totalTasks} tasks</span>
          )}
        </span>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="text-xs font-bold text-accent hover:text-accent/80 transition-colors px-2 py-1"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
