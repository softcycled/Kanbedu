"use client";

import { useRef, useState, useEffect } from "react";
import SearchIcon from "../SearchIcon";

interface Props {
  value: string;
  onChange: (v: string) => void;
  suggestion?: string | null;
  suggestions?: string[];
  placeholder?: string;
}

export default function GroupSearchBar({
  value,
  onChange,
  suggestion,
  suggestions,
  placeholder = "Search groups…",
}: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const showDropdown = open && suggestions && suggestions.length > 0 && value.trim().length > 0;

  return (
    <div ref={containerRef} className="flex flex-col items-end gap-1">
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          <SearchIcon />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); } }}
          placeholder={placeholder}
          className="w-36 bg-ink/5 border border-border/60 hover:border-border focus:border-ink/30 focus:bg-column-bg rounded-lg pl-9 pr-3 py-1 text-sm text-ink placeholder:text-muted outline-none transition-colors"
        />
        {showDropdown && (
          <div className="absolute right-0 top-full mt-1.5 z-50 min-w-full w-max max-w-48 bg-card-bg border border-border rounded-xl shadow-modal overflow-hidden">
            {suggestions!.map((name) => (
              <button
                key={name}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(name);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-ink/70 hover:text-ink hover:bg-ink/10 transition-all duration-100 border-l-2 border-transparent hover:border-ink/30"
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>
      {!showDropdown && suggestion && (
        <button
          onClick={() => onChange(suggestion)}
          className="text-[11px] text-muted hover:text-ink transition-colors"
        >
          Did you mean <span className="font-medium underline">{suggestion}</span>?
        </button>
      )}
    </div>
  );
}
