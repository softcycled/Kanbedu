"use client";

interface SortOption {
  key: string;
  label: string;
}

interface Props {
  options: SortOption[];
  value: string;
  onChange: (key: string) => void;
}

export default function SortPills({ options, value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors ${
            value === opt.key
              ? "bg-ink text-paper"
              : "bg-ink/8 text-ink/70 hover:bg-ink/12 hover:text-ink"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
