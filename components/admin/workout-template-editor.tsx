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
import { saveWorkoutTemplate } from "@/lib/workout-actions";
import type { ExerciseInput } from "@/lib/workout-actions";
import { MachinePicker } from "@/components/admin/machine-picker";
import type { WorkoutTemplate } from "@/lib/types";

type Props = {
  trigger: React.ReactNode;
  template?: WorkoutTemplate | null;
};

export function WorkoutTemplateEditor({ trigger, template }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [exercises, setExercises] = useState<ExerciseInput[]>(
    template?.exercises?.length
      ? template.exercises
      : [{ name: "", sets: 3, reps: 10, machine_id: null, photo_url: null }]
  );

  function updateExercise(idx: number, field: keyof ExerciseInput, value: string | number) {
    setExercises((prev) =>
      prev.map((e, i) =>
        i === idx
          ? { ...e, [field]: field === "name" ? value : Number(value) }
          : e
      )
    );
  }

  function attachMachine(
    idx: number,
    m: { id: string; name: string; photo_url: string | null } | null
  ) {
    setExercises((prev) =>
      prev.map((e, i) =>
        i === idx
          ? {
              ...e,
              machine_id: m?.id ?? null,
              photo_url: m?.photo_url ?? null,
              // Autofill the exercise name from the machine if blank.
              name: e.name.trim() || m?.name || e.name,
            }
          : e
      )
    );
  }

  function addExercise() {
    setExercises((prev) => [
      ...prev,
      { name: "", sets: 3, reps: 10, machine_id: null, photo_url: null },
    ]);
  }
  function removeExercise(idx: number) {
    setExercises((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveWorkoutTemplate(
        template?.id ?? null,
        name,
        description,
        exercises
      );
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(template ? t("workouts_admin.template_updated") : t("workouts_admin.template_created"));
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
            {template ? t("workouts_admin.edit_template") : t("workouts_admin.new_template")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="w-name">{t("common.name")}</Label>
            <Input
              id="w-name"
              required
              placeholder={t("workouts_admin.name_ph")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="w-desc">{t("common.description")}</Label>
            <Textarea
              id="w-desc"
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
                  className="space-y-2 rounded-lg bg-zinc-950/40 p-2"
                >
                  {/* Row 1: machine link */}
                  <div className="flex items-center justify-between">
                    <MachinePicker
                      selected={
                        ex.machine_id
                          ? { id: ex.machine_id, name: ex.name, photo_url: ex.photo_url ?? null }
                          : null
                      }
                      onSelect={(m) => attachMachine(idx, m)}
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
                  {/* Row 2: name + sets + reps */}
                  <div className="flex items-center gap-2">
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
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {template ? t("common.save_changes") : t("workouts_admin.create_template")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
