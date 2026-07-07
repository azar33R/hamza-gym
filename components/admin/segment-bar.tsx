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
      <div className="flex h-3 overflow-hidden rounded-full bg-zinc-800">
        {segments.map((seg) => {
          const pct = total > 0 ? (seg.value / total) * 100 : 0;
          return (
            <div
              key={seg.label}
              className="transition-all duration-500"
              style={{
                width: `${pct}%`,
                backgroundColor: seg.color,
                minWidth: pct > 0 ? "4px" : "0",
              }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-400">
        {segments.map((seg) => (
          <span key={seg.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: seg.color }}
            />
            {seg.label} ({total > 0 ? Math.round((seg.value / total) * 100) : 0}%)
          </span>
        ))}
      </div>
    </div>
  );
}
