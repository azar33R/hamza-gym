"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dumbbell,
  Lock,
  Plus,
  Pencil,
  Trash2,
  Wand2,
  UserCheck,
  BookOpen,
  Loader2,
  CalendarDays,
  MessageSquarePlus,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ActiveWorkout } from "@/components/subscriber/active-workout";
import { PlanEditor } from "@/components/subscriber/plan-editor";
import { WeeklyPlanner } from "@/components/subscriber/weekly-planner";
import { deleteMyPlan, type MyExerciseInput } from "@/lib/user-workout-actions";
import type { ResolvedDay } from "@/lib/weekly-schedule-actions";
import type { Exercise, Machine, UserWorkoutTemplate } from "@/lib/types";
import type { WorkoutPreset } from "@/lib/constants";

type SelectedPlan = {
  templateId: string | null;
  name: string;
  exercises: Exercise[];
};

type EditorSeed = {
  id: string | null;
  name: string;
  description: string;
  exercises: MyExerciseInput[];
};

type CoachTemplateLite = {
  id: string;
  name: string;
  description: string | null;
  exercises: Exercise[];
};

type CoachLite = { id: string; full_name: string | null };

type Props = {
  presets: WorkoutPreset[];
  myPlans: UserWorkoutTemplate[];
  coachTemplate: CoachTemplateLite | null;
  coachTemplates: CoachTemplateLite[];
  weeklySchedule: ResolvedDay[];
  coaches: CoachLite[];
  machines: Machine[];
  checkedInToday: boolean;
};

const emptySeed: EditorSeed = {
  id: null,
  name: "",
  description: "",
  exercises: [],
};

export function WorkoutChooser({
  presets,
  myPlans,
  coachTemplate,
  coachTemplates,
  weeklySchedule,
  coaches,
  machines,
  checkedInToday,
}: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<SelectedPlan | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [seed, setSeed] = useState<EditorSeed>(emptySeed);
  const [weekKey, setWeekKey] = useState(0);
  const tPresets = presets;

  if (selected) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelected(null)}
          className="text-sm text-zinc-400 hover:text-zinc-50"
        >
          {t("workout.back_to_plans")}
        </button>
        <ActiveWorkout
          templateId={selected.templateId}
          templateName={selected.name}
          exercises={selected.exercises}
          machines={machines}
        />
      </div>
    );
  }

  function startPlan(plan: SelectedPlan) {
    if (!checkedInToday) {
      toast.error(t("workout.checkin_required"));
      return;
    }
    setSelected(plan);
  }

  function openEditor(s: EditorSeed) {
    setSeed(s);
    setEditorOpen(true);
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteMyPlan(id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(t("workout.plan_deleted"));
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-50">
            <Dumbbell className="h-6 w-6 text-primary" /> {t("workout.title")}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {t("workout.desc")}
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => openEditor(emptySeed)}
        >
          <Plus className="h-4 w-4" /> {t("workout.new_plan")}
        </Button>
      </header>

      {!checkedInToday && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <Lock className="h-4 w-4 shrink-0" />
          {t("workout.checkin_hint")}
        </div>
      )}

      <Tabs defaultValue="coach">
        <TabsList className="w-full">
          <TabsTrigger value="coach" className="flex-1 gap-1.5">
            <UserCheck className="h-3.5 w-3.5" /> {t("workout.tab_coach")}
          </TabsTrigger>
          <TabsTrigger value="presets" className="flex-1 gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> {t("workout.tab_presets")}
          </TabsTrigger>
          <TabsTrigger value="mine" className="flex-1 gap-1.5">
            <Dumbbell className="h-3.5 w-3.5" /> {t("workout.tab_my_plans")}
          </TabsTrigger>
          <TabsTrigger value="week" className="flex-1 gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" /> {t("workout.tab_week")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="coach" className="space-y-3">
          {coachTemplate && (
            <PlanCard
              name={coachTemplate.name}
              description={coachTemplate.description ?? undefined}
              exercises={coachTemplate.exercises}
              onStart={() =>
                startPlan({
                  templateId: coachTemplate.id,
                  name: coachTemplate.name,
                  exercises: coachTemplate.exercises,
                })
              }
              checkedInToday={checkedInToday}
              badge={t("workout.coach_today")}
            />
          )}

          {coachTemplates.length > 0 && (
            <div className="space-y-3 pt-1">
              <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {t("workout.coach_templates")}
              </h3>
              {coachTemplates.map((tpl) => (
                <PlanCard
                  key={tpl.id}
                  name={tpl.name}
                  description={tpl.description ?? undefined}
                  exercises={tpl.exercises}
                  onStart={() =>
                    startPlan({
                      templateId: tpl.id,
                      name: tpl.name,
                      exercises: tpl.exercises,
                    })
                  }
                  checkedInToday={checkedInToday}
                />
              ))}
            </div>
          )}

          {coaches.length === 1 && (
            <div className="rounded-2xl border border-dashed border-border bg-card/40 p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <MessageSquarePlus className="h-4 w-4" />
                </span>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-zinc-100">
                    {t("workout.request_plan_title")}
                  </h3>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {t("workout.request_plan_desc")}
                  </p>
                  <Button asChild size="sm" variant="outline" className="mt-3 gap-1.5">
                    <a href={`/chat/${coaches[0].id}`}>{t("workout.request_plan")}</a>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {coaches.length > 1 && (
            <div className="space-y-2">
              <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {t("workout.request_plan_title")}
              </h3>
              <p className="px-1 text-xs text-zinc-400">
                {t("workout.request_plan_desc")}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {coaches.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
                  >
                    <span className="text-sm font-medium text-zinc-100">
                      {c.full_name ?? t("common.unknown")}
                    </span>
                    <Button asChild size="sm" variant="outline" className="gap-1.5">
                      <a href={`/chat/${c.id}`}>{t("workout.request_plan_coach")}</a>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!coachTemplate && coachTemplates.length === 0 && coaches.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
              <UserCheck className="mx-auto h-8 w-8 text-zinc-600" />
              <p className="mt-2 text-sm font-medium text-zinc-300">
                {t("workout.no_coach_plans")}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {t("workout.no_coach_plans_hint")}
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="presets" className="space-y-3">
          {tPresets.map((p) => (
            <PlanCard
              key={p.id}
              emoji={p.emoji}
              name={p.name}
              description={p.description}
              exercises={p.exercises}
              onStart={() =>
                startPlan({
                  templateId: null,
                  name: p.name,
                  exercises: p.exercises,
                })
              }
              checkedInToday={checkedInToday}
              onCustomize={() =>
                openEditor({
                  id: null,
                  name: p.name,
                  description: p.description,
                  exercises: p.exercises.map((e) => ({ ...e })),
                })
              }
            />
          ))}
        </TabsContent>

        <TabsContent value="mine" className="space-y-3">
          {myPlans.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
              <Wand2 className="mx-auto h-8 w-8 text-zinc-600" />
              <p className="mt-2 text-sm font-medium text-zinc-300">
                {t("workout.no_saved_plans")}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {t("workout.no_saved_plans_hint")}
              </p>
              <Button
                size="sm"
                className="mt-4 gap-1.5"
                onClick={() => openEditor(emptySeed)}
              >
                <Plus className="h-4 w-4" /> {t("workout.create_plan")}
              </Button>
            </div>
          ) : (
            myPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                name={plan.name}
                description={plan.description ?? undefined}
                exercises={plan.exercises}
                onStart={() =>
                  startPlan({
                    templateId: null,
                    name: plan.name,
                    exercises: plan.exercises,
                  })
                }
                checkedInToday={checkedInToday}
                onEdit={() =>
                  openEditor({
                    id: plan.id,
                    name: plan.name,
                    description: plan.description ?? "",
                    exercises: plan.exercises.map((e) => ({ ...e })),
                  })
                }
                onDelete={() => handleDelete(plan.id)}
                deletePending={pending}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="week" className="space-y-3">
          <WeeklyPlanner
            key={weekKey}
            schedule={weeklySchedule}
            presets={tPresets.map((p) => ({
              value: `preset:${p.id}`,
              label: p.emoji ? `${p.emoji} ${p.name}` : p.name,
            }))}
            customPlans={myPlans.map((p) => ({
              value: `custom:${p.id}`,
              label: p.name,
            }))}
            coachTemplates={coachTemplates.map((tpl) => ({
              value: `coach:${tpl.id}`,
              label: tpl.name,
            }))}
            onRefresh={() => setWeekKey((k) => k + 1)}
          />
        </TabsContent>
      </Tabs>

      <PlanEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        id={seed.id}
        initialName={seed.name}
        initialDescription={seed.description}
        initialExercises={seed.exercises}
      />
    </div>
  );
}

function PlanCard({
  name,
  description,
  exercises,
  emoji,
  badge,
  onStart,
  onCustomize,
  onEdit,
  onDelete,
  deletePending,
  checkedInToday,
}: {
  name: string;
  description?: string;
  exercises: { name: string; sets: number; reps: number }[];
  emoji?: string;
  badge?: string;
  onStart: () => void;
  onCustomize?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  deletePending?: boolean;
  checkedInToday: boolean;
}) {
  const { t } = useI18n();
  const totalSets = exercises.reduce((s, e) => s + (e.sets || 0), 0);
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {badge && (
            <span className="mb-1 inline-block rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              {badge}
            </span>
          )}
          <h2 className="flex items-center gap-2 font-semibold text-zinc-50">
            {emoji && <span>{emoji}</span>}
            <span className="truncate">{name}</span>
          </h2>
          {description && (
            <p className="mt-0.5 text-sm text-zinc-400">{description}</p>
          )}
          <p className="mt-1 text-xs text-zinc-500">
            {t("workout.exercise_summary", { count: exercises.length, sets: totalSets })}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {exercises.map((ex, i) => (
          <span
            key={i}
            className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
          >
            {ex.name} · {ex.sets}×{ex.reps}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button
          className="flex-1 gap-1.5"
          onClick={onStart}
          disabled={!checkedInToday}
          title={!checkedInToday ? t("workout.checkin_required_title") : undefined}
        >
          {!checkedInToday ? (
            <Lock className="h-4 w-4" />
          ) : (
            <Dumbbell className="h-4 w-4" />
          )}
          {t("workout.start")}
        </Button>
        {onCustomize && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCustomize}
            className="gap-1.5"
          >
            <Wand2 className="h-3.5 w-3.5" /> {t("workout.customize")}
          </Button>
        )}
        {onEdit && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            className="h-9 w-9 text-zinc-400 hover:text-zinc-50"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
        {onDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-zinc-400 hover:text-destructive"
                disabled={deletePending}
              >
                {deletePending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("workout.delete_plan_title")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("workout.delete_plan_body", { name })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={onDelete}
                >
                  {t("workout.delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
