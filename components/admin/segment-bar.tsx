"use client";

// Simple pure-CSS segmented progress bar for Active vs Inactive.
export function SegmentBar({
  segments,
  className,
}: {
  segments: { label: string; value: number; color: string }[];
  className?: string;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  return (
    <div className={className}>
      <div className="flex h-3 overflow-hidden rounded-full bg-zinc-900 ring-1 ring-inset ring-white/5">
        {segments.map((seg) => {
          const pct = total > 0 ? (seg.value / total) * 100 : 0;
          return (
            <div
              key={seg.label}
              className="transition-all duration-500 first:rounded-s-full last:rounded-e-full"
              style={{
                width: `${pct}%`,
                backgroundColor: seg.color,
                minWidth: seg.value > 0 ? "6px" : "0",
              }}
            />
          );
        })}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {segments.map((seg) => (
          <span key={seg.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-zinc-400">{seg.label}</span>
            <span className="font-bold text-zinc-100">{seg.value}</span>
            <span className="text-zinc-500">
              ({total > 0 ? Math.round((seg.value / total) * 100) : 0}%)
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
