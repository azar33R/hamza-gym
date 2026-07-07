import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Plus, Pencil } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { WorkoutTemplateEditor } from "@/components/admin/workout-template-editor";
import { DeleteTemplateButton } from "@/components/admin/delete-template-button";
import { WorkoutPresetEditor } from "@/components/admin/workout-preset-editor";
import { DeletePresetButton } from "@/components/admin/delete-preset-button";
import { getT } from "@/lib/i18n/server";
import { getWorkoutPresets } from "@/lib/workout-preset-actions";
import type { WorkoutTemplate } from "@/lib/types";

export default async function WorkoutsPage() {
  const t = await getT();
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("workout_templates")
    .select("*")
    .order("created_at", { ascending: false });

  const presets = await getWorkoutPresets();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
          {t("workouts_admin.title")}
        </h1>
        <p className="text-sm text-zinc-400">
          {t("workouts_admin.subtitle")}
        </p>
      </header>

      <Tabs defaultValue="templates">
        <TabsList className="w-full">
          <TabsTrigger value="templates" className="flex-1">
            {t("workouts_admin.tab_templates")}
          </TabsTrigger>
          <TabsTrigger value="presets" className="flex-1">
            {t("workouts_admin.tab_presets")}
          </TabsTrigger>
        </TabsList>

        {/* ---- Coach templates ---- */}
        <TabsContent value="templates" className="mt-6 space-y-4">
          <div className="flex justify-end">
            <WorkoutTemplateEditor
              trigger={
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" /> {t("workouts_admin.new_template")}
                </Button>
              }
            />
          </div>

          {(templates?.length ?? 0) === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
              <p className="text-sm text-zinc-400">{t("workouts_admin.no_templates")}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {t("workouts_admin.no_templates_desc")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(templates as WorkoutTemplate[]).map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold text-zinc-50">{tmpl.name}</h2>
                      {tmpl.description && (
                        <p className="mt-0.5 text-sm text-zinc-400">{tmpl.description}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {tmpl.exercises?.map((ex, i) => (
                          <span
                            key={i}
                            className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
                          >
                            {ex.name} · {ex.sets}×{ex.reps}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <WorkoutTemplateEditor
                        template={tmpl}
                        trigger={
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 text-zinc-400 hover:text-zinc-50"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        }
                      />
                      <DeleteTemplateButton templateId={tmpl.id} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ---- Gym-wide presets (admin-editable) ---- */}
        <TabsContent value="presets" className="mt-6 space-y-4">
          <div className="flex justify-end">
            <WorkoutPresetEditor
              trigger={
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" /> {t("workouts_admin.new_preset")}
                </Button>
              }
            />
          </div>

          {presets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
              <p className="text-sm text-zinc-400">{t("workouts_admin.no_presets")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {presets.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="flex items-center gap-2 font-semibold text-zinc-50">
                        <span className="text-lg">{p.emoji}</span>
                        {p.name}
                      </h2>
                      {p.description && (
                        <p className="mt-0.5 text-sm text-zinc-400">{p.description}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {p.exercises.map((ex, i) => (
                          <span
                            key={i}
                            className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
                          >
                            {ex.name} · {ex.sets}×{ex.reps}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <WorkoutPresetEditor
                        preset={p}
                        trigger={
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 text-zinc-400 hover:text-zinc-50"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        }
                      />
                      <DeletePresetButton presetId={p.id} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
