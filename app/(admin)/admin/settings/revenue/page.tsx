import { getT } from "@/lib/i18n/server";
import { requireStaffOrAdmin } from "@/lib/admin";
import { getRevenueAnalytics } from "@/lib/revenue-actions";
import { MetricCard } from "@/components/admin/metric-card";
import { DayPassDialog } from "@/components/admin/day-pass-dialog";
import {
  DollarSign,
  TrendingUp,
  Clock,
  Ticket,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function fmt(n: number): string {
  return `${n.toLocaleString()} EGP`;
}

function maxOf(nums: number[]): number {
  return nums.reduce((m, v) => (v > m ? v : m), 0);
}

export default async function RevenueAnalysisPage() {
  const t = await getT();
  await requireStaffOrAdmin();
  const data = await getRevenueAnalytics();

  const dailyMax = maxOf(data.daily.map((d) => d.revenue));
  const planMax = maxOf(data.byPlan.map((p) => p.revenue));
  const passMax = maxOf(data.dayPasses.map((d) => d.quantity));
  const dayPassTotalQty = data.dayPasses.reduce((s, d) => s + d.quantity, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/settings"
            className="mb-2 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("admin_settings.title")}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
            {t("admin.revenue.title")}
          </h1>
          <p className="text-sm text-zinc-400">{t("admin.revenue.subtitle")}</p>
        </div>
        <DayPassDialog />
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label={t("admin.revenue.total")}
          value={fmt(data.totals.totalRevenue)}
          icon={<DollarSign className="h-4 w-4" />}
          revealable
        />
        <MetricCard
          label={t("admin.revenue.this_month")}
          value={fmt(data.totals.monthRevenue)}
          icon={<TrendingUp className="h-4 w-4" />}
          revealable
        />
        <MetricCard
          label={t("admin.revenue.pending")}
          value={fmt(data.totals.pendingRevenue)}
          icon={<Clock className="h-4 w-4" />}
          revealable
        />
        <MetricCard
          label={t("admin.revenue.day_pass_revenue")}
          value={fmt(data.totals.dayPassRevenue)}
          icon={<Ticket className="h-4 w-4" />}
          revealable
        />
      </div>

      {/* Revenue — last 30 days */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-medium text-zinc-400">
          {t("admin.revenue.last_30_days")}
        </h2>
        <div className="flex h-40 items-end gap-1">
          {data.daily.map((d) => {
            const h = dailyMax > 0 ? (d.revenue / dailyMax) * 100 : 0;
            return (
              <div
                key={d.date}
                className="group flex flex-1 flex-col items-center justify-end"
                title={`${d.date} · ${fmt(d.revenue)}`}
              >
                <div
                  className="w-full rounded-t bg-primary/70 transition-all group-hover:bg-primary"
                  style={{ height: `${Math.max(h, d.revenue > 0 ? 4 : 1)}%` }}
                />
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-zinc-600">
          {t("admin.revenue.last_30_days_hint")}
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Revenue by plan */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-medium text-zinc-400">
            {t("admin.revenue.by_plan")}
          </h2>
          {data.byPlan.length === 0 ? (
            <p className="text-sm text-zinc-500">{t("admin.revenue.no_data")}</p>
          ) : (
            <div className="space-y-3">
              {data.byPlan.map((p) => {
                const w = planMax > 0 ? (p.revenue / planMax) * 100 : 0;
                return (
                  <div key={p.plan_type}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-zinc-300">{p.label}</span>
                      <span className="text-zinc-500">
                        {fmt(p.revenue)} · {p.count}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${w}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 1-day passes per day */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-1 text-sm font-medium text-zinc-400">
            {t("admin.revenue.day_passes_14")}
          </h2>
          <p className="mb-4 text-xs text-zinc-600">
            {t("admin.revenue.day_passes_14_hint", { n: dayPassTotalQty })}
          </p>
          <div className="flex h-40 items-end gap-1">
            {data.dayPasses.map((d) => {
              const h = passMax > 0 ? (d.quantity / passMax) * 100 : 0;
              return (
                <div
                  key={d.date}
                  className="group flex flex-1 flex-col items-center justify-end"
                  title={`${d.date} · ${d.quantity}`}
                >
                  <div
                    className="w-full rounded-t bg-amber-500/70 transition-all group-hover:bg-amber-500"
                    style={{ height: `${Math.max(h, d.quantity > 0 ? 4 : 1)}%` }}
                  />
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Recent revenue */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-medium text-zinc-400">
          {t("admin.revenue.recent")}
        </h2>
        {data.recent.length === 0 ? (
          <p className="text-sm text-zinc-500">{t("admin.revenue.no_data")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-start text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-2 py-2 text-start font-medium">
                    {t("admin.revenue.col_date")}
                  </th>
                  <th className="px-2 py-2 text-start font-medium">
                    {t("admin.revenue.col_source")}
                  </th>
                  <th className="px-2 py-2 text-start font-medium">
                    {t("admin.revenue.col_plan")}
                  </th>
                  <th className="px-2 py-2 text-end font-medium">
                    {t("admin.revenue.col_amount")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="px-2 py-2 text-zinc-400">{r.date}</td>
                    <td className="px-2 py-2">
                      <span
                        className={
                          r.source === "day_pass"
                            ? "rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400"
                            : "rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary"
                        }
                      >
                        {r.source === "day_pass"
                          ? t("admin.revenue.source_day_pass")
                          : t("admin.revenue.source_payment")}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-zinc-200">
                      {r.label}
                      {r.quantity > 1 ? ` ×${r.quantity}` : ""}
                    </td>
                    <td className="px-2 py-2 text-end font-medium text-zinc-50">
                      {fmt(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
