"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Cpu,
  Flag,
  Dumbbell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RestTimer } from "@/components/subscriber/rest-timer";
import {
  startWorkoutSession,
  logSet,
  completeWorkout,
} from "@/lib/workout-session-actions";
import type { Exercise, Machine } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useOffline } from "@/lib/offline/context";
import {
  queueOfflineWorkout,
} from "@/lib/offline/queue";
import { useI18n } from "@/lib/i18n/client";
import { XP_REWARDS } from "@/lib/constants";

type Props = {
  templateId: string | null;
  templateName: string;
  exercises: Exercise[];
  machines: Machine[];
};

type Step = {
  exerciseIndex: number;
  setNumber: number;
};

// The active workout logger. Steps through each exercise set-by-set, shows the
// machine cue, fires the rest timer on "Complete Set", and persists everything.
export function ActiveWorkout({
  templateId,
  templateName,
  exercises,
  machines,
}: Props) {
  const router = useRouter();
  const { isOnline } = useOffline();
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState<Step>({ exerciseIndex: 0, setNumber: 1 });
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [resting, setResting] = useState(false);
  const [doneSets, setDoneSets] = useState<Set<string>>(new Set());
  const [swapOpen, setSwapOpen] = useState(false);
  const [machineOverrides, setMachineOverrides] = useState<Record<number, Machine | null>>({});
  const { t } = useI18n();
  const [finished, setFinished] = useState(false);
  // Offline: accumulate set logs locally, flush as one bundled op on finish.
  const [offlineSets, setOfflineSets] = useState<{
    exerciseName: string;
    setNumber: number;
    weight: number | null;
    reps: number | null;
    machineId: string | null;
  }[]>([]);
  const [offlineStartedAt, setOfflineStartedAt] = useState<string | null>(null);

  const ex = exercises[step.exerciseIndex];
  const currentMachine =
    machineOverrides[step.exerciseIndex] ??
    machines.find((m) => m.id === ex?.machine_id) ??
    null;

  function start() {
    startTransition(async () => {
      if (isOnline) {
        const res = await startWorkoutSession(templateId);
        if (res.error || !res.sessionId) {
          toast.error(res.error ?? t("workout.could_not_start"));
          return;
        }
        setSessionId(res.sessionId);
        setStarted(true);
      } else {
        // Offline: just record the start time. The entire workout (session +
        // set_logs + completion) is queued as one atomic op on finish, so there
        // are no dangling FK references to a client-generated id.
        setOfflineStartedAt(new Date().toISOString());
        setOfflineSets([]);
        setStarted(true);
        toast.info(t("workout.offline_sync"));
      }
    });
  }

  function completeSet() {
    if (!ex) return;
    const key = `${step.exerciseIndex}:${step.setNumber}`;
    startTransition(async () => {
      if (isOnline && sessionId) {
        const res = await logSet({
          sessionId,
          exerciseName: ex.name,
          setNumber: step.setNumber,
          weight: null,
          reps: ex.reps,
          machineId: currentMachine?.id ?? ex.machine_id ?? null,
        });
        if (res.error) {
          toast.error(res.error);
          return;
        }
      } else if (!isOnline) {
        // Offline: accumulate the set locally.
        setOfflineSets((prev) => [
          ...prev,
          {
            exerciseName: ex.name,
            setNumber: step.setNumber,
            weight: null,
            reps: ex.reps,
            machineId: currentMachine?.id ?? ex.machine_id ?? null,
          },
        ]);
      }
      setDoneSets((prev) => new Set(prev).add(key));
      // Kick off the rest timer.
      setResting(true);
    });
  }

  function nextStep() {
    const isLastSet = step.setNumber >= (ex?.sets ?? 1);
    if (isLastSet) {
      const isLastExercise = step.exerciseIndex >= exercises.length - 1;
      if (isLastExercise) {
        finish();
        return;
      }
      setStep({ exerciseIndex: step.exerciseIndex + 1, setNumber: 1 });
    } else {
      setStep({ ...step, setNumber: step.setNumber + 1 });
    }
  }

  function finish() {
    if (!sessionId && !offlineStartedAt) return;
    startTransition(async () => {
      if (isOnline && sessionId) {
        const res = await completeWorkout(sessionId);
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success(t("workout.complete_points", { points: res.pointsAwarded }));
      } else if (!isOnline && offlineStartedAt) {
        // Offline: queue the entire workout (session + all sets + completion)
        // as ONE atomic op. The sync engine creates the session row first,
        // then inserts set_logs linked to it, then awards XP. No dangling FKs.
        await queueOfflineWorkout({
          templateId,
          templateName,
          startedAt: offlineStartedAt,
          completedAt: new Date().toISOString(),
          sets: offlineSets,
        });
        toast.success(t("workout.offline_complete_points", { points: XP_REWARDS.WORKOUT_COMPLETE }));
      }
      setFinished(true);
      router.refresh();
    });
  }

  function applySwap(m: Machine | null) {
    setMachineOverrides((prev) => ({ ...prev, [step.exerciseIndex]: m }));
    setSwapOpen(false);
  }

  // Alternative machines by primary muscle (for the swap button).
  const swapSuggestions = currentMachine?.primary_muscle
    ? machines.filter(
        (m) =>
          m.id !== currentMachine.id &&
          m.primary_muscle === currentMachine.primary_muscle
      )
    : machines.filter((m) => m.id !== currentMachine?.id).slice(0, 4);

  // ---- Pre-start screen ----
  if (!started) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold text-zinc-50">{templateName}</h2>
          <p className="mt-1 text-sm text-zinc-400">
            {t("workout.exercise_count", { count: exercises.length })} ·{" "}
            {t("workout.sets_total", { count: exercises.reduce((s, e) => s + e.sets, 0) })}
          </p>
          <ul className="mt-4 space-y-2">
            {exercises.map((e, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="flex-1 text-zinc-200">{e.name}</span>
                <span className="text-zinc-500">
                  {e.sets} × {e.reps}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <Button size="lg" className="w-full gap-2" onClick={start} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Dumbbell className="h-4 w-4" />}
          {t("workout.start")}
        </Button>
      </div>
    );
  }

  // ---- Finished screen ----
  if (finished) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-10 text-center">
        <span className="flex h-16 w-16 animate-pop-in items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-8 w-8" />
        </span>
        <h2 className="text-xl font-bold text-zinc-50">{t("workout.session_complete")}</h2>
        <p className="text-sm text-zinc-400">
          {t("workout.session_complete_desc")}
        </p>
        <Button asChild className="mt-2 gap-2">
          <a href="/dashboard">{t("active.back_home")}</a>
        </Button>
      </div>
    );
  }

  if (!ex) return null;

  // ---- Active set screen ----
  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>
          {t("workout.exercise_of", { current: step.exerciseIndex + 1, total: exercises.length })}
        </span>
        <span>
          {t("workout.set_of", { current: step.setNumber, total: ex.sets })}
        </span>
      </div>
      <div className="flex gap-1">
        {exercises.map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full",
              i < step.exerciseIndex
                ? "bg-primary"
                : i === step.exerciseIndex
                ? "bg-primary/60"
                : "bg-zinc-800"
            )}
          />
        ))}
      </div>

      {/* Machine cue */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {currentMachine?.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentMachine.photo_url}
            alt={currentMachine.name}
            className="max-h-72 w-full object-contain"
          />
        ) : ex.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ex.photo_url} alt={ex.name} className="max-h-72 w-full object-contain" />
        ) : (
          <div className="flex h-44 items-center justify-center bg-zinc-950">
            <Cpu className="h-10 w-10 text-zinc-700" />
          </div>
        )}
        <div className="p-4">
          <h2 className="text-xl font-bold text-zinc-50">{ex.name}</h2>
          <p className="text-sm text-zinc-400">
            {t("workout.target", { sets: ex.sets, reps: ex.reps })}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSwapOpen(true)}
            className="mt-3 gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {currentMachine ? t("workout.swap_machine") : t("workout.pick_machine")}
          </Button>
        </div>
      </div>

      {/* Complete set — planned reps shown as a bold static badge */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-400">{t("workout.planned_reps")}</span>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 font-mono text-lg font-black text-primary">
            {ex.reps}
          </span>
        </div>

        <Button
          size="lg"
          className="mt-4 w-full gap-2"
          onClick={completeSet}
          disabled={pending}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {t("workout.complete_set")}
        </Button>
      </div>

      {/* Set dots */}
      <div className="flex items-center justify-center gap-1.5">
        {Array.from({ length: ex.sets }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-2 w-2 rounded-full",
              doneSets.has(`${step.exerciseIndex}:${i + 1}`)
                ? "bg-primary"
                : "bg-zinc-700"
            )}
          />
        ))}
      </div>

      {/* Navigation */}
      <div className="flex gap-2">
        <Button
          variant="ghost"
          className="flex-1"
          disabled={step.exerciseIndex === 0 && step.setNumber === 1}
          onClick={() =>
            setStep((s) =>
              s.setNumber > 1
                ? { ...s, setNumber: s.setNumber - 1 }
                : s.exerciseIndex > 0
                ? {
                    exerciseIndex: s.exerciseIndex - 1,
                    setNumber: exercises[s.exerciseIndex - 1].sets,
                  }
                : s
            )
          }
        >
          <ChevronLeft className="h-4 w-4" /> {t("workout.prev")}
        </Button>
        <Button
          variant="ghost"
          className="gap-2 text-destructive hover:text-destructive"
          onClick={finish}
        >
          <Flag className="h-4 w-4" /> {t("workout.finish")}
        </Button>
        <Button variant="ghost" className="flex-1" onClick={nextStep}>
          {t("workout.next")} <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Swap dialog */}
      <Dialog open={swapOpen} onOpenChange={setSwapOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("workout.swap_machine")}</DialogTitle>
          </DialogHeader>
          {swapSuggestions.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">
              {t("workout.no_alternatives")}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {swapSuggestions.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => applySwap(m)}
                  className="overflow-hidden rounded-lg border border-border bg-zinc-950 text-start transition-colors hover:border-primary/50"
                >
                  <div className="aspect-square bg-zinc-900">
                    {m.photo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.photo_url} alt={m.name} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <p className="truncate px-2 py-1 text-xs text-zinc-300">{m.name}</p>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rest timer overlay — on close (natural finish or skip), advance to
          the next set/exercise so the user isn't stuck on the completed set. */}
      {resting && (
        <RestTimer
          exerciseName={ex.name}
          onComplete={() => {
            setResting(false);
            nextStep();
          }}
        />
      )}
    </div>
  );
}
