import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Plus, Pencil } from "lucide-react";
import { WorkoutTemplateEditor } from "@/components/admin/workout-template-editor";
import { DeleteTemplateButton } from "@/components/admin/delete-template-button";
import { getT } from "@/lib/i18n/server";
import type { WorkoutTemplate } from "@/lib/types";

export default async function WorkoutsPage() {
  const t = await getT();
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("workout_templates")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
            {t("workouts_admin.title")}
          </h1>
          <p className="text-sm text-zinc-400">
            {t("workouts_admin.subtitle")}
          </p>
        </div>
        <WorkoutTemplateEditor
          trigger={
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> {t("workouts_admin.new_template")}
            </Button>
          }
        />
      </header>

      {(templates?.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
          <p className="text-sm text-zinc-400">{t("workouts_admin.no_templates")}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {t("workouts_admin.no_templates_desc")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {(templates as WorkoutTemplate[]).map((t) => (
            <div
              key={t.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-zinc-50">{t.name}</h2>
                  {t.description && (
                    <p className="mt-0.5 text-sm text-zinc-400">{t.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {t.exercises?.map((ex, i) => (
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
                    template={t}
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
                  <DeleteTemplateButton templateId={t.id} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
