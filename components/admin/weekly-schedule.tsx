"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assignWorkout, removeWorkout } from "@/lib/schedule-actions";
import { cn } from "@/lib/utils";

type ScheduledItem = {
  id: string;
  scheduled_date: string;
  template_id: string;
};

// Shows the current week (Mon–Sun starting today) with assignment controls.
export function WeeklySchedule({
  userId,
  templates,
  existing = [],
}: {
  userId: string;
  templates: { id: string; name: string }[];
  existing?: ScheduledItem[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Build this week's 7 days starting Monday.
  const today = new Date();
  const day = today.getDay(); // 0 = Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      iso: d.toISOString().split("T")[0],
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      date: d.getDate(),
      isToday: i === 6 - (day === 0 ? 0 : 6 - day) || d.toDateString() === today.toDateString(),
    };
  });

  // index existing workouts by date
  const byDate = new Map(existing.map((e) => [e.scheduled_date, e]));
  const [selectedTemplate, setSelectedTemplate] = useState<string>(
    templates[0]?.id ?? ""
  );

  function handleAssign(dateIso: string) {
    if (!selectedTemplate) {
      toast.error(t("admin.weekly_schedule.pick_template_first"));
      return;
    }
    startTransition(async () => {
      const res = await assignWorkout(userId, selectedTemplate, dateIso);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(t("admin.weekly_schedule.workout_assigned"));
        router.refresh();
      }
    });
  }

  function handleRemove(workoutId: string) {
    startTransition(async () => {
      const res = await removeWorkout(workoutId);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(t("admin.weekly_schedule.workout_removed"));
        router.refresh();
      }
    });
  }

  const templateName = (id: string) =>
    templates.find((t) => t.id === id)?.name ?? "Workout";

  return (
    <div>
      <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
        <SelectTrigger className="mb-3">
          <SelectValue placeholder={t("admin.weekly_schedule.select_template_ph")} />
        </SelectTrigger>
        <SelectContent>
          {templates.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const item = byDate.get(d.iso);
          return (
            <div
              key={d.iso}
              className={cn(
                "flex min-h-[88px] flex-col rounded-lg border border-border bg-zinc-950/40 p-1.5",
                d.isToday && "border-primary/50"
              )}
            >
              <div className="text-center">
                <p className="text-[10px] uppercase text-zinc-400">{d.label}</p>
                <p className="text-sm font-semibold text-zinc-200">{d.date}</p>
              </div>
              {item ? (
                <div className="mt-1 flex-1 rounded bg-primary/15 px-1 py-0.5 text-center">
                  <p className="truncate text-[9px] font-medium text-primary">
                    {templateName(item.template_id)}
                  </p>
                  <button
                    onClick={() => handleRemove(item.id)}
                    disabled={pending}
                    className="mx-auto mt-0.5 flex text-zinc-400 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleAssign(d.iso)}
                  disabled={pending}
                  className="mt-1 flex-1 rounded text-[10px] text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                >
                  +
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        {t("admin.weekly_schedule.tap_hint")}
      </p>
    </div>
  );
}
