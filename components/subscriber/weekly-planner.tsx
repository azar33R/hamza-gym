"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, CalendarDays } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import {
  assignMyDay,
  removeMyDay,
  type ResolvedDay,
  type ScheduleSourceType,
} from "@/lib/weekly-schedule-actions";
import type { Exercise } from "@/lib/types";
import { cn } from "@/lib/utils";

type PickablePlan = {
  value: string;
  label: string;
};

type Props = {
  schedule: ResolvedDay[];
  presets: PickablePlan[];
  customPlans: PickablePlan[];
  coachTemplates: PickablePlan[];
  onRefresh?: () => void;
};

const DAY_KEYS = ["common.day_sun", "common.day_mon", "common.day_tue", "common.day_wed", "common.day_thu", "common.day_fri", "common.day_sat"];

export function WeeklyPlanner({
  schedule,
  presets,
  customPlans,
  coachTemplates,
  onRefresh,
}: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const firstAvailable =
    presets[0]?.value ??
    customPlans[0]?.value ??
    coachTemplates[0]?.value ??
    "";
  const [selected, setSelected] = useState<string>(firstAvailable);

  const byDay = new Map(schedule.map((d) => [d.dayOfWeek, d]));
  const todayDow = new Date().getDay();

  function handleAssign(dayOfWeek: number) {
    if (!selected) {
      toast.error(t("workout.pick_plan"));
      return;
    }
    const [sourceType, ...rest] = selected.split(":");
    const sourceId = rest.join(":");
    startTransition(async () => {
      const res = await assignMyDay(
        dayOfWeek,
        sourceType as ScheduleSourceType,
        sourceId
      );
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(t("workout.day_set", { day: t(DAY_KEYS[dayOfWeek]) }));
        onRefresh?.();
      }
    });
  }

  function handleRemove(dayOfWeek: number) {
    startTransition(async () => {
      const res = await removeMyDay(dayOfWeek);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(t("workout.day_cleared", { day: t(DAY_KEYS[dayOfWeek]) }));
        onRefresh?.();
      }
    });
  }

  const totalAssigned = schedule.length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-zinc-100">
            {t("workout.weekly_split_title")}
          </h2>
        </div>
        <p className="mt-1 text-xs text-zinc-400">
          {t("workout.weekly_split_desc")}{" "}
          {totalAssigned > 0
            ? t("workout.days_set", { count: totalAssigned })
            : t("workout.no_days_set")}
        </p>

        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={pending}
          className="mt-3 flex h-10 w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="" disabled>
            {t("workout.select_plan_placeholder")}
          </option>
          {presets.length > 0 && (
            <optgroup label={t("workout.presets")}>
              {presets.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </optgroup>
          )}
          {customPlans.length > 0 && (
            <optgroup label={t("workout.my_plans")}>
              {customPlans.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </optgroup>
          )}
          {coachTemplates.length > 0 && (
            <optgroup label={t("workout.coach_templates")}>
              {coachTemplates.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>

        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 0].map((dow) => {
            const item = byDay.get(dow);
            return (
              <div
                key={dow}
                className={cn(
                  "flex min-h-[92px] flex-col rounded-lg border border-border bg-zinc-950/40 p-1.5",
                  dow === todayDow && "border-primary/50"
                )}
              >
                <div className="text-center">
                  <p className="text-[10px] uppercase text-zinc-400">
                    {t(DAY_KEYS[dow])}
                  </p>
                </div>
                {item ? (
                  <div className="mt-1 flex-1 rounded bg-primary/15 px-1 py-0.5 text-center">
                    <p className="truncate text-[9px] font-medium text-primary">
                      {item.name}
                    </p>
                    <p className="text-[8px] text-primary/70">
                      {item.exercises.length} {t("workout.ex_short")}
                    </p>
                    <button
                      onClick={() => handleRemove(dow)}
                      disabled={pending}
                      className="mx-auto mt-0.5 flex text-zinc-400 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleAssign(dow)}
                    disabled={pending || !selected}
                    className="mt-1 flex min-h-[60px] w-full items-center justify-center rounded text-base leading-none text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-40"
                  >
                    +
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <TodayCard schedule={schedule} todayDow={todayDow} />
    </div>
  );
}

function TodayCard({
  schedule,
  todayDow,
}: {
  schedule: ResolvedDay[];
  todayDow: number;
}) {
  const { t } = useI18n();
  const today = schedule.find((d) => d.dayOfWeek === todayDow);
  if (!today) return null;

  const totalSets = today.exercises.reduce((s, e: Exercise) => s + e.sets, 0);
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
        {t("workout.today")}
      </p>
      <h3 className="mt-0.5 font-semibold text-zinc-50">{today.name}</h3>
      <p className="mt-0.5 text-xs text-zinc-400">
        {t("workout.exercise_sets_summary", { count: today.exercises.length, sets: totalSets })}
      </p>
    </div>
  );
}
