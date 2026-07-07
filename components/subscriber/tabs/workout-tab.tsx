"use client";

import { useEffect, useState } from "react";
import { getWorkoutData, type WorkoutPageData } from "@/app/(subscriber)/tab-actions";
import { WORKOUT_PRESETS } from "@/lib/constants";
import { WorkoutChooser } from "@/components/subscriber/workout-chooser";
import { useTabContext } from "@/app/(subscriber)/tab-context";

export function WorkoutTab() {
  const [data, setData] = useState<WorkoutPageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { notifyReady, initialTab } = useTabContext();
  const id = "workout" as const;

  useEffect(() => {
    getWorkoutData().then((res) => {
      if (res.error) setError(res.error);
      else setData(res.data);
      if (initialTab === id) notifyReady(id);
    });
  }, [initialTab, notifyReady]);

  if (error) {
    if (initialTab === id) notifyReady(id);
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-zinc-500">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <WorkoutChooser
      presets={WORKOUT_PRESETS}
      myPlans={data.myPlans}
      coachTemplate={data.coachTemplate}
      coachTemplates={data.coachTemplates}
      weeklySchedule={data.weeklySchedule}
      coaches={data.coaches}
      machines={data.machines}
      checkedInToday={data.checkedInToday}
    />
  );
}
