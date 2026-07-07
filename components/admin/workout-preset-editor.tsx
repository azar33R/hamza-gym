"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveWorkoutPreset } from "@/lib/workout-preset-actions";
import type { WorkoutPreset, PresetExercise } from "@/lib/constants";

type PresetExerciseInput = { name: string; sets: number; reps: number };

type Props = {
  trigger: React.ReactNode;
  preset?: WorkoutPreset | null;
};

export function WorkoutPresetEditor({ trigger, preset }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(preset?.name ?? "");
  const [description, setDescription] = useState(preset?.description ?? "");
  const [emoji, setEmoji] = useState(preset?.emoji ?? "🏋️");
  const [exercises, setExercises] = useState<PresetExerciseInput[]>(
    preset?.exercises?.length
      ? preset.exercises.map((e) => ({ name: e.name, sets: e.sets, reps: e.reps }))
      : [{ name: "", sets: 3, reps: 10 }]
  );

  function updateExercise(idx: number, field: keyof PresetExerciseInput, value: string | number) {
    setExercises((prev) =>
      prev.map((e, i) =>
        i === idx ? { ...e, [field]: field === "name" ? value : Number(value) } : e
      )
    );
  }
  function addExercise() {
    setExercises((prev) => [...prev, { name: "", sets: 3, reps: 10 }]);
  }
  function removeExercise(idx: number) {
    setExercises((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean: PresetExercise[] = exercises
      .map((e) => ({ name: e.name.trim(), sets: Number(e.sets), reps: Number(e.reps) }))
      .filter((e) => e.name);
    startTransition(async () => {
      const res = await saveWorkoutPreset(preset?.id ?? null, {
        name,
        description,
        emoji,
        exercises: clean,
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(preset ? t("workouts_admin.preset_updated") : t("workouts_admin.preset_created"));
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {preset ? t("workouts_admin.edit_preset") : t("workouts_admin.new_preset")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="w-20 shrink-0 space-y-2">
              <Label htmlFor="p-emoji">{t("workouts_admin.emoji")}</Label>
              <Input
                id="p-emoji"
                value={emoji}
                maxLength={4}
                onChange={(e) => setEmoji(e.target.value)}
                className="text-center text-lg"
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="p-name">{t("common.name")}</Label>
              <Input
                id="p-name"
                required
                placeholder={t("workouts_admin.name_ph")}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-desc">{t("common.description")}</Label>
            <Textarea
              id="p-desc"
              placeholder={t("workouts_admin.notes_ph")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>{t("common.exercises")}</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addExercise}
                className="gap-1"
              >
                <Plus className="h-4 w-4" /> {t("common.add")}
              </Button>
            </div>
            <div className="space-y-2">
              {exercises.map((ex, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-lg bg-zinc-950/40 p-2"
                >
                  <Input
                    placeholder={t("workouts_admin.exercise_name_ph")}
                    value={ex.name}
                    onChange={(e) => updateExercise(idx, "name", e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min={1}
                    placeholder={t("common.sets")}
                    value={ex.sets}
                    onChange={(e) => updateExercise(idx, "sets", e.target.value)}
                    className="w-20"
                  />
                  <Input
                    type="number"
                    min={1}
                    placeholder={t("common.reps")}
                    value={ex.reps}
                    onChange={(e) => updateExercise(idx, "reps", e.target.value)}
                    className="w-20"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-zinc-400 hover:text-destructive"
                    onClick={() => removeExercise(idx)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {preset ? t("common.save_changes") : t("workouts_admin.create_preset")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
