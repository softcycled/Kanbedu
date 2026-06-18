"use client";

import SearchIcon from "../SearchIcon";

interface Props {
  value: string;
  onChange: (v: string) => void;
  suggestion?: string | null;
  placeholder?: string;
}

export default function GroupSearchBar({
  value,
  onChange,
  suggestion,
  placeholder = "Search groups…",
}: Props) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          <SearchIcon />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-36 bg-ink/5 border border-border/60 hover:border-border focus:border-ink/30 focus:bg-column-bg rounded-lg pl-9 pr-3 py-1 text-sm text-ink placeholder:text-muted outline-none transition-colors"
        />
      </div>
      {suggestion && (
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
