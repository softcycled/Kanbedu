import { nameToColor } from "@/lib/avatarColor";

interface AvatarProps {
  name?: string | null;
  color?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZES: Record<string, string> = {
  xs: "w-4 h-4 text-[8px]",
  sm: "w-5 h-5 text-[9px]",
  md: "w-6 h-6 text-[10px]",
  lg: "w-7 h-7 text-[11px]",
  xl: "w-10 h-10 text-sm",
};

function getTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.57 ? "#1C1917" : "#FAFAF9";
}

export default function Avatar({ name, color, size = "md", className = "" }: AvatarProps) {
  const sizeClass = SIZES[size];

  if (!name) {
    return (
      <span className={`${sizeClass} rounded-full flex items-center justify-center font-bold flex-shrink-0 bg-border text-muted ${className}`}>
        ?
      </span>
    );
  }

  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const bg = color ?? nameToColor(name);
  const textColor = getTextColor(bg);

  return (
    <span
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold flex-shrink-0 ${className}`}
      style={{ backgroundColor: bg, color: textColor }}
    >
      {initial}
    </span>
  );
}
