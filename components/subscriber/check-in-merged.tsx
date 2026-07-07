"use client";

import { useState } from "react";
import { MapPin, CalendarDays, Dumbbell } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { CheckInModal } from "@/components/subscriber/check-in-modal";

export function CheckInMerged({
  workoutsThisWeek,
  lastWorkoutLabel,
}: {
  workoutsThisWeek: number;
  lastWorkoutLabel: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-lime-500/30">
          <MapPin className="h-7 w-7" />
        </span>
        <div>
          <p className="font-semibold text-zinc-50">{t("checkin.ready_title")}</p>
          <p className="text-sm text-zinc-400">
            {t("checkin.desc")}
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => setOpen(true)}
          className="mt-1 w-full py-6 text-base"
        >
          {t("checkin.at_gym")}
        </Button>
        <CheckInModal
          open={open}
          onOpenChange={setOpen}
          onSuccess={() => {}}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/5 bg-black/20 p-3">
          <CalendarDays className="h-4 w-4 text-primary" />
          <p className="mt-1.5 text-xl font-extrabold text-zinc-50">{workoutsThisWeek}</p>
          <p className="text-[10px] text-zinc-500">{t("checkin.workouts_this_week")}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-black/20 p-3">
          <Dumbbell className="h-4 w-4 text-primary" />
          <p className="mt-1.5 text-xl font-extrabold text-zinc-50">{lastWorkoutLabel}</p>
          <p className="text-[10px] text-zinc-500">{t("checkin.last_workout")}</p>
        </div>
      </div>
    </>
  );
}
