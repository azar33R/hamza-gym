import { createClient } from "@/lib/supabase/server";
import { getRevenueAnalytics } from "@/lib/revenue-actions";
import { getMembershipCounts } from "@/lib/membership-counts";
import { MetricCard } from "@/components/admin/metric-card";
import { SegmentBar } from "@/components/admin/segment-bar";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { DailyPinCard } from "@/components/admin/daily-pin-card";
import { DayPassDialog } from "@/components/admin/day-pass-dialog";
import { DollarSign, Users, UserPlus, Clock } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { requireStaffOrAdmin } from "@/lib/admin";

// Main admin dashboard — server component.
export default async function AdminHomePage() {
  const { role } = await requireStaffOrAdmin();
  const supabase = await createClient();
  const t = await getT();

  // Today's check-in PIN (gym_settings is RLS-readable by staff/admin).
  const { data: gymSettings } = await supabase
    .from("gym_settings")
    .select("daily_pin, updated_at")
    .eq("id", 1)
    .single();

  // Revenue analytics (MRR + the 30-day series) and effective-status member
  // counts, in parallel.
  const [analytics, m] = await Promise.all([
    getRevenueAnalytics(),
    getMembershipCounts(),
  ]);

  const isAdmin = role === "admin";

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-50">
            {t("admin.dashboard")}
          </h1>
          <p className="text-sm text-zinc-400">{t("admin.overview_sub")}</p>
        </div>
        <DayPassDialog />
      </header>

      {/* Today's check-in PIN — compact strip */}
      {gymSettings && (
        <DailyPinCard pin={gymSettings.daily_pin} updatedAt={gymSettings.updated_at} />
      )}

      {/* Metric cards — always 4 slots so the grid never shifts by role */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isAdmin ? (
          <MetricCard
            label={t("admin.mrr")}
            value={`${Math.round(analytics.totals.mrr)} ${t("common.egp")}`}
            icon={<DollarSign className="h-3.5 w-3.5" />}
            maskable
            href="/admin/settings/revenue"
          />
        ) : (
          <MetricCard
            label={t("clients.title")}
            value={m.total}
            icon={<Users className="h-3.5 w-3.5" />}
            maskable
            href="/admin/clients"
          />
        )}
        <MetricCard
          label={t("admin.active_members")}
          value={m.active}
          icon={<Users className="h-3.5 w-3.5" />}
          maskable
          href="/admin/clients?tab=active"
        />
        <MetricCard
          label={t("admin.new_signups")}
          value={m.newSignups}
          icon={<UserPlus className="h-3.5 w-3.5" />}
          maskable
          href="/admin/clients"
        />
        <MetricCard
          label={t("admin.outstanding")}
          value={m.outstanding}
          icon={<Clock className="h-3.5 w-3.5" />}
          maskable
          hint={t("admin.outstanding_hint", {
            expired: m.lapsed,
            pending: m.awaiting,
          })}
          href="/admin/triage"
        />
      </div>

      {/* 30-day revenue — a real series instead of a single fat bar */}
      <RevenueChart points={analytics.daily} />

      {/* Membership split — effective status, same source as the clients page */}
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-[13px] font-medium text-zinc-400">
          {t("admin.active_vs_inactive")}
        </h2>
        <SegmentBar
          segments={[
            { label: t("admin.active"), value: m.active, color: "hsl(83, 81%, 54%)" },
            {
              label: t("admin.inactive_expired"),
              value: m.inactive,
              color: "hsl(240, 5%, 32%)",
            },
          ]}
        />
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
          <span>
            {t("admin.outstanding_split", { lapsed: m.lapsed, neverPaid: m.neverPaid })}
          </span>
          <span>{t("admin.total_members", { n: m.total })}</span>
        </div>
      </section>
    </div>
  );
}
