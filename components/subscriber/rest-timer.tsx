"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import {
  Droplets,
  SkipForward,
  Timer as TimerIcon,
  Play,
  BellRing,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitLift } from "@/lib/workout-session-actions";
import { POINT_REWARDS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const PRESETS = [60, 90, 120];

export function RestTimer({
  exerciseName,
  onComplete,
}: {
  exerciseName: string;
  onComplete: () => void;
}) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<"setup" | "counting">("setup");
  const [duration, setDuration] = useState(90);
  const [remaining, setRemaining] = useState(90);
  const [maxInput, setMaxInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [alarming, setAlarming] = useState(false);
  const doneRef = useRef(false);
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  function playBeepBurst() {
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate([200, 100, 200, 100, 300]);
      } catch { /* no-op */ }
    }
    const ctx = audioRef.current;
    if (!ctx) return;
    const beepAt = (t: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    };
    try {
      const now = ctx.currentTime;
      beepAt(now);
      beepAt(now + 0.35);
      beepAt(now + 0.7);
    } catch { /* no-op */ }
  }

  const startLoopingAlarm = useCallback(() => {
    playBeepBurst();
    if (alarmIntervalRef.current) return;
    alarmIntervalRef.current = setInterval(playBeepBurst, 1500);
  }, []);

  useEffect(() => {
    if (phase !== "counting") return;
    if (remaining <= 0) {
      if (!doneRef.current) {
        doneRef.current = true;
        setAlarming(true);
        startLoopingAlarm();
      }
      return;
    }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining, phase, startLoopingAlarm]);

  function pickDuration(d: number) {
    setDuration(d);
    setRemaining(d);
  }

  function logMax() {
    const w = Number(maxInput);
    if (!w || w <= 0) return;
    startTransition(async () => {
      const res = await submitLift(exerciseName, w);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.status === "rejected") {
        toast.error(res.reason ?? t("workout.lift_rejected"));
        return;
      }
      fireConfetti();
      toast.success(
        t("workout.lift_submitted", { ratio: res.ratio ?? "" }),
        {
          description: t("workout.lift_reward", { points: POINT_REWARDS.PR_BONUS }),
          duration: 5000,
        }
      );
      setMaxInput("");
    });
  }

  function beginRest() {
    setPhase("counting");
    primeAudio();
  }

  function primeAudio() {
    try {
      if (!audioRef.current) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        audioRef.current = new Ctor();
      }
      if (audioRef.current.state === "suspended") {
        void audioRef.current.resume();
      }
    } catch {
      // AudioContext unavailable — vibration + visual fallback still fire.
    }
  }

  function stopAlarm() {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate(0);
      } catch {
        /* no-op */
      }
    }
    setAlarming(false);
    onComplete();
  }

  useEffect(() => {
    return () => {
      if (alarmIntervalRef.current) {
        clearInterval(alarmIntervalRef.current);
        alarmIntervalRef.current = null;
      }
      audioRef.current?.close().catch(() => {});
      audioRef.current = null;
    };
  }, []);

  function fireConfetti() {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.5 },
      colors: ["#84cc16", "#a3e635", "#fbbf24", "#ecfccb"],
    });
  }

  if (phase === "setup") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 px-6 backdrop-blur">
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-primary">
          {t("workout.set_complete")}
        </p>
        <h2 className="mb-6 text-center text-xl font-bold text-zinc-50">
          {exerciseName}
        </h2>

        <div className="w-full max-w-xs space-y-2">
          <Label htmlFor="maxw" className="text-xs text-zinc-400">
            {t("workout.max_weight_label", { name: exerciseName })}
          </Label>
          <div className="flex gap-2">
            <Input
              id="maxw"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder={t("workout.max_weight_placeholder")}
              value={maxInput}
              onChange={(e) => setMaxInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") logMax();
              }}
            />
            <Button
              onClick={logMax}
              disabled={pending || !maxInput}
              className="gap-1.5"
            >
              {pending ? t("workout.logging") : t("workout.log")}
            </Button>
          </div>
        </div>

        <p className="mt-8 mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
          {t("workout.rest_duration")}
        </p>
        <div className="flex gap-2">
          {PRESETS.map((d) => (
            <Button
              key={d}
              size="sm"
              variant={duration === d ? "secondary" : "outline"}
              onClick={() => pickDuration(d)}
              className="gap-1.5"
            >
              <TimerIcon className="h-3.5 w-3.5" />
              {d}s
            </Button>
          ))}
        </div>

        <Button
          size="lg"
          onClick={beginRest}
          className="mt-8 gap-2 px-8"
        >
          <Play className="h-4 w-4" /> {t("workout.start_rest", { duration })}
        </Button>

        <Button
          variant="ghost"
          onClick={onComplete}
          className="mt-4 gap-2 text-zinc-400"
        >
          <SkipForward className="h-4 w-4" /> {t("workout.skip_rest")}
        </Button>
      </div>
    );
  }

  if (remaining <= 0) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background/95 px-6 backdrop-blur">
        <span className="flex h-20 w-20 animate-pulse items-center justify-center rounded-full bg-primary/20">
          <BellRing className="h-10 w-10 text-primary" />
        </span>
        <h2 className="text-2xl font-extrabold text-zinc-50">{t("workout.rest_over")}</h2>
        <p className="text-sm text-zinc-400">{t("workout.stop_alarm_hint")}</p>
        <Button
          size="lg"
          onClick={stopAlarm}
          className="mt-2 gap-2 bg-destructive px-10 py-6 text-lg font-bold hover:bg-destructive/90"
        >
          <BellRing className="h-5 w-5" /> {t("workout.stop_alarm")}
        </Button>
      </div>
    );
  }

  const progress = duration > 0 ? ((duration - remaining) / duration) * 100 : 100;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 px-6 backdrop-blur">
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-primary">
        {t("workout.rest_title")}
      </p>

      <div className="relative flex h-48 w-48 items-center justify-center">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="hsl(240 4% 16%)"
            strokeWidth="6"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 45}`}
            strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
            className={cn(
              "transition-all duration-1000 ease-linear",
              remaining <= 3 && "animate-pulse"
            )}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span
            className={cn(
              "font-mono text-5xl font-black text-zinc-50",
              remaining <= 3 && "text-primary"
            )}
          >
            {remaining}
          </span>
          <span className="text-xs text-zinc-500">{t("workout.seconds")}</span>
        </div>
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-zinc-500">
        <BellRing className="h-3 w-3" /> {t("workout.alarm_at_zero")}
      </p>

      <div className="mt-6 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-zinc-300">
        <Droplets className="h-4 w-4 text-cyan-400" />
        {t("workout.drink_water")}
      </div>

      <Button
        variant="ghost"
        onClick={stopAlarm}
        className="mt-8 gap-2 text-zinc-400"
      >
        <SkipForward className="h-4 w-4" /> {t("workout.skip_rest")}
      </Button>
    </div>
  );
}
