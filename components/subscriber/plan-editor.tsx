"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveMyPlan, type MyExerciseInput } from "@/lib/user-workout-actions";
import { MachinePicker } from "@/components/admin/machine-picker";
import { useI18n } from "@/lib/i18n/client";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // id of the plan being edited; null = creating a new plan.
  id: string | null;
  // Seed values when the dialog opens (preset, existing plan, or empty).
  initialName?: string;
  initialDescription?: string;
  initialExercises?: MyExerciseInput[];
};

const EMPTY_EXERCISE: MyExerciseInput = {
  name: "",
  sets: 3,
  reps: 10,
  machine_id: null,
  photo_url: null,
};

// Subscriber-facing plan editor. Saves to the member's own
// user_workout_templates via saveMyPlan. Reuses MachinePicker so it looks and
// behaves like the coach template editor.
export function PlanEditor({
  open,
  onOpenChange,
  id,
  initialName = "",
  initialDescription = "",
  initialExercises,
}: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [exercises, setExercises] = useState<MyExerciseInput[]>(
    initialExercises && initialExercises.length
      ? initialExercises
      : [{ ...EMPTY_EXERCISE }]
  );

  // Reset to the seed values every time the dialog opens (covers preset/customize
  // and edit reuse of a single component instance).
  useEffect(() => {
    if (open) {
      setName(initialName);
      setDescription(initialDescription);
      setExercises(
        initialExercises && initialExercises.length
          ? initialExercises
          : [{ ...EMPTY_EXERCISE }]
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function updateExercise(
    idx: number,
    field: keyof MyExerciseInput,
    value: string | number
  ) {
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
    setExercises((prev) => [...prev, { ...EMPTY_EXERCISE }]);
  }
  function removeExercise(idx: number) {
    setExercises((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveMyPlan(id, name, description, exercises);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(id ? t("editor.plan_updated") : t("editor.plan_saved"));
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {id ? t("editor.edit_plan") : t("editor.new_plan")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="p-name">{t("common.name")}</Label>
            <Input
              id="p-name"
              required
              placeholder={t("editor.name_ph")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-desc">{t("common.description")}</Label>
            <Textarea
              id="p-desc"
              placeholder={t("editor.desc_ph")}
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
                  <div className="flex items-center justify-between">
                    <MachinePicker
                      selected={
                        ex.machine_id
                          ? {
                              id: ex.machine_id,
                              name: ex.name,
                              photo_url: ex.photo_url ?? null,
                            }
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
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder={t("editor.exercise_name_ph")}
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
            {id ? t("common.save_changes") : t("editor.save_plan")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
