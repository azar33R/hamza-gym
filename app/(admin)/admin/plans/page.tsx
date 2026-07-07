import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Check, X } from "lucide-react";
import { PlanEditor } from "@/components/admin/plan-editor";
import { DeletePlanButton } from "@/components/admin/delete-plan-button";
import { getT } from "@/lib/i18n/server";
import type { Plan } from "@/lib/types";

export default async function PlansPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data } = await supabase
    .from("plans")
    .select("*")
    .order("sort_order", { ascending: true });

  const plans = (data as Plan[]) ?? [];

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">{t("plans.title")}</h1>
          <p className="text-sm text-zinc-400">{t("plans.subtitle")}</p>
        </div>
        <PlanEditor
          trigger={
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> {t("plans.new_plan")}
            </Button>
          }
        />
      </header>

      {plans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-zinc-400">
          {t("plans.no_plans")}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {plans.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-50">{p.label}</h2>
                  <p className="mt-1 text-2xl font-bold text-primary">
                    {p.price_egp}{" "}
                    <span className="text-sm font-normal text-zinc-400">{t("common.egp")}</span>
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {p.duration_months === 0
                      ? t("plans.one_day_pass")
                      : p.duration_months === 1
                      ? t("plans.1_month", { n: p.duration_months })
                      : t("plans.n_months", { n: p.duration_months })}
                  </p>
                </div>
                <Badge variant={p.is_active ? "success" : "muted"}>
                  {p.is_active ? (
                    <>
                      <Check className="me-1 h-3 w-3" /> {t("plans.active_badge")}
                    </>
                  ) : (
                    <>
                      <X className="me-1 h-3 w-3" /> {t("plans.hidden_badge")}
                    </>
                  )}
                </Badge>
              </div>

              {p.features.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm text-zinc-400">
                  {p.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 flex gap-2">
                <PlanEditor
                  plan={p}
                  trigger={
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <Pencil className="h-4 w-4" /> {t("common.edit")}
                    </Button>
                  }
                />
                <DeletePlanButton planId={p.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
