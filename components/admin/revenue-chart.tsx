"use client";

import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RevenuePoint } from "@/lib/revenue-actions";
import { useI18n } from "@/lib/i18n/client";

// 30-day revenue column chart, drawn with plain divs (no chart dependency).
// Stacks day-pass revenue on top of membership revenue per day.
export function RevenueChart({
  points,
  className,
}: {
  points: RevenuePoint[];
  className?: string;
}) {
  const { t, locale } = useI18n();
  const ar = locale.startsWith("ar");

  const days = useMemo(() => points.slice(-30), [points]);
  const max = useMemo(
    () => Math.max(1, ...days.map((d) => d.revenue)),
    [days]
  );
  const total = useMemo(() => days.reduce((s, d) => s + d.revenue, 0), [days]);

  const fmt = (n: number) =>
    ar ? n.toLocaleString("ar-EG-u-nu-arab") : n.toLocaleString("en-US");

  if (days.length === 0 || total === 0) {
    return (
      <div
        className={cn(
          "flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-sm text-zinc-500",
          className
        )}
      >
        {t("admin.revenue.no_data")}
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-medium text-zinc-400">
          {t("admin.revenue.last_30_days")}
        </h2>
        <span className="flex items-center gap-1 text-sm font-bold text-zinc-50">
          <TrendingUp className="h-3.5 w-3.5 text-primary" />
          {fmt(total)} {t("common.egp")}
        </span>
      </div>

      {/* Columns. h-28 with each column as a flex-end justify-end stack. */}
      <div className="flex h-28 items-end gap-[2px]">
        {days.map((d) => {
          const memberH = (d.revenue / max) * 100;
          const passH = (d.dayPass / max) * 100;
          return (
            <div
              key={d.date}
              className="group relative flex h-full flex-1 flex-col justify-end"
              title={`${d.date} — ${fmt(d.revenue)} ${t("common.egp")}`}
            >
              {passH > 0 && (
                <div
                  className="w-full rounded-t-[2px] bg-zinc-700"
                  style={{ height: `${passH}%` }}
                />
              )}
              <div
                className={cn(
                  "w-full transition-colors",
                  passH > 0 ? "rounded-b-[2px]" : "rounded-[2px]",
                  d.revenue > 0
                    ? "bg-primary/80 group-hover:bg-primary"
                    : "bg-white/[0.04]"
                )}
                style={{ height: `${Math.max(memberH - passH, d.revenue > 0 ? 2 : 0)}%` }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-600">
        <span>{days[0]?.date}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm bg-primary/80" />
            {t("admin.revenue.source_payment")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm bg-zinc-700" />
            {t("admin.revenue.source_day_pass")}
          </span>
        </span>
        <span>{days[days.length - 1]?.date}</span>
      </div>
    </div>
  );
}
