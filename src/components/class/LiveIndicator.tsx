export default function LiveIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted flex-shrink-0">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Live
    </span>
  );
}
