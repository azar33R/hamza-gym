import { createClient } from "@/lib/supabase/server";
import { planMonthlyValue } from "@/lib/plans";
import type { Plan, PlanType } from "@/lib/types";
import { MetricCard } from "@/components/admin/metric-card";
import { SegmentBar } from "@/components/admin/segment-bar";
import { DailyPinCard } from "@/components/admin/daily-pin-card";
import { DayPassDialog } from "@/components/admin/day-pass-dialog";
import { DollarSign, Users, UserPlus, Clock } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { requireStaffOrAdmin } from "@/lib/admin";

// Main admin dashboard — server component.
export default async function AdminHomePage() {
  const { role } = await requireStaffOrAdmin();
  const supabase = await createClient();

  // Today's check-in PIN (gym_settings is RLS-readable by staff/admin).
  const { data: gymSettings } = await supabase
    .from("gym_settings")
    .select("daily_pin, updated_at")
    .eq("id", 1)
    .single();

  // MRR: sum monthly-normalized price across all subscriptions.
  const { data: allSubs } = await supabase
    .from("subscriptions")
    .select("plan_type");

  // Get all plans for price lookup.
  const { data: plans } = await supabase
    .from("plans")
    .select("plan_type, price_egp, duration_months");

  const planMap = new Map<PlanType, Pick<Plan, "plan_type" | "price_egp" | "duration_months">>(
    (plans ?? []).map((p: Pick<Plan, "plan_type" | "price_egp" | "duration_months">) => [p.plan_type as PlanType, p])
  );

  let mrr = 0;
  for (const sub of allSubs ?? []) {
    const plan = planMap.get(sub.plan_type);
    if (plan) {
      mrr += planMonthlyValue(plan);
    }
  }

  // 2) Active vs Inactive counts
  const { count: activeCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("subscription_status", "active");

  const { count: inactiveCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .in("subscription_status", ["inactive", "expired"]);

  const { count: totalCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  // 3) New sign-ups in last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const { count: newSignups } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .gte("created_at", thirtyDaysAgo.toISOString());

  // 4) Outstanding: expired + pending payment requests
  const { count: expiredCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("subscription_status", "expired");

  const { count: pendingPayments } = await supabase
    .from("payment_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const outstanding = (expiredCount ?? 0) + (pendingPayments ?? 0);

  const t = await getT();
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
            {t("admin.dashboard")}
          </h1>
          <p className="text-sm text-zinc-400">
            {t("admin.overview_sub")}
          </p>
        </div>
        <DayPassDialog />
      </header>

      {/* Daily check-in PIN */}
      {gymSettings && (
        <DailyPinCard pin={gymSettings.daily_pin} updatedAt={gymSettings.updated_at} />
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3">
        {role === "admin" && (
          <MetricCard
            label={t("admin.mrr")}
            value={`${Math.round(mrr)} EGP`}
            icon={<DollarSign className="h-4 w-4" />}
            revealable
          />
        )}
        <MetricCard
          label={t("admin.new_signups")}
          value={newSignups ?? 0}
          icon={<UserPlus className="h-4 w-4" />}
        />
        <MetricCard
          label={t("admin.active_members")}
          value={activeCount ?? 0}
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          label={t("admin.outstanding")}
          value={outstanding}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      {/* Active vs Inactive bar */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-medium text-zinc-400">
          {t("admin.active_vs_inactive")}
        </h2>
        <SegmentBar
          segments={[
            { label: t("admin.active"), value: activeCount ?? 0, color: "hsl(83, 81%, 54%)" },
            { label: t("admin.inactive_expired"), value: inactiveCount ?? 0, color: "hsl(240, 4%, 16%)" },
          ]}
        />
        <p className="mt-3 text-xs text-zinc-500">
          {t("admin.total_members", { n: totalCount ?? 0 })}
        </p>
      </section>
    </div>
  );
}
