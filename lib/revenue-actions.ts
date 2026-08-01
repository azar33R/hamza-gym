"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createSSRClient } from "@/lib/supabase/server";
import { requireAdmin, requireStaffOrAdmin } from "@/lib/admin";
import type { ManualRevenue, PlanType } from "@/lib/types";

// Server-only client (service role) — bypasses RLS so staff + admin can read
// the full financial picture for analytics. The function itself is gated by
// requireStaffOrAdmin, so this is safe.
function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export type AddManualRevenueInput = {
  log_date?: string; // YYYY-MM-DD, defaults to today
  quantity: number;
  amount: number; // EGP total collected
  note?: string;
  type?: string; // defaults to "day_pass"
};

export async function addManualRevenue(
  input: AddManualRevenueInput
): Promise<{ error: string | null }> {
  const { profile } = await requireAdmin();
  if (!profile) return { error: "Not authorized." };

  const quantity = Math.max(1, Math.floor(Number(input.quantity) || 1));
  const amount = Math.max(0, Number(input.amount) || 0);
  const logDate =
    input.log_date && /^\d{4}-\d{2}-\d{2}$/.test(input.log_date)
      ? input.log_date
      : new Date().toISOString().split("T")[0];

  const supabase = await createSSRClient();
  const { error } = await supabase.from("manual_revenue").insert({
    type: input.type ?? "day_pass",
    log_date: logDate,
    quantity,
    amount,
    note: input.note?.trim() || null,
    created_by: profile.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/admin/settings/revenue");
  return { error: null };
}

export type RevenuePoint = { date: string; revenue: number; dayPass: number };
export type RevenueByPlan = {
  plan_type: PlanType;
  label: string;
  revenue: number;
  count: number;
};
export type RecentRevenue = {
  date: string;
  plan_type: string;
  label: string;
  amount: number;
  source: "payment" | "day_pass";
  quantity: number;
};

export type RevenueAnalytics = {
  totals: {
    totalRevenue: number;
    monthRevenue: number;
    pendingRevenue: number;
    dayPassRevenue: number;
  };
  daily: RevenuePoint[];
  byPlan: RevenueByPlan[];
  dayPasses: { date: string; quantity: number; amount: number }[];
  recent: RecentRevenue[];
  manualEntries: ManualRevenue[];
};

function ymd(d: Date): string {
  return d.toISOString().split("T")[0];
}

export async function getRevenueAnalytics(): Promise<RevenueAnalytics> {
  await requireStaffOrAdmin();
  const supabase = serviceClient();

  // Plans for pricing + labels.
  const { data: plans } = await supabase
    .from("plans")
    .select("plan_type, label, price_egp");
  const planMap = new Map<string, { label: string; price: number }>();
  for (const p of plans ?? []) {
    planMap.set(p.plan_type as string, {
      label: p.label,
      price: Number(p.price_egp) || 0,
    });
  }

  // Every paid activation — cash, approved Vodafone, or access code — records a
  // subscriptions row. This is the source of truth for collected revenue.
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("plan_type, created_at");

  // Pending Vodafone requests = money not yet collected.
  const { data: payments } = await supabase
    .from("payment_requests")
    .select("plan_type, cardio_price_snapshot")
    .eq("status", "pending");

  // Manual cash entries (day passes etc.).
  const { data: manual } = await supabase
    .from("manual_revenue")
    .select("*")
    .order("log_date", { ascending: false });

  const manualRows = (manual ?? []) as ManualRevenue[];

  let totalRevenue = 0;
  let monthRevenue = 0;
  let pendingRevenue = 0;
  let dayPassRevenue = 0;
  const byPlanMap = new Map<string, RevenueByPlan>();
  const dailyMap = new Map<string, RevenuePoint>();
  const dayPassMap = new Map<string, { quantity: number; amount: number }>();
  const recent: RecentRevenue[] = [];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  for (const s of (subs ?? []) as { plan_type: string; created_at: string }[]) {
    const plan = planMap.get(s.plan_type as string);
    if (!plan) continue;
    const price = plan.price;
    const date = (s.created_at as string).split("T")[0];

    totalRevenue += price;
    if (new Date(date) >= monthStart) monthRevenue += price;

    if (s.plan_type === "1-day") {
      dayPassRevenue += price;
      const dp = dayPassMap.get(date) ?? { quantity: 0, amount: 0 };
      dp.quantity += 1;
      dp.amount += price;
      dayPassMap.set(date, dp);
    }

    const bp =
      byPlanMap.get(s.plan_type as string) ??
      ({
        plan_type: s.plan_type as PlanType,
        label: plan.label,
        revenue: 0,
        count: 0,
      } as RevenueByPlan);
    bp.revenue += price;
    bp.count += 1;
    byPlanMap.set(s.plan_type as string, bp);

    const dp =
      dailyMap.get(date) ?? ({ date, revenue: 0, dayPass: 0 } as RevenuePoint);
    dp.revenue += price;
    dailyMap.set(date, dp);

    recent.push({
      date,
      plan_type: s.plan_type as string,
      label: plan.label,
      amount: price,
      source: s.plan_type === "1-day" ? "day_pass" : "payment",
      quantity: 1,
    });
  }

  // Pending Vodafone requests.
  for (const pay of payments ?? []) {
    const plan = planMap.get(pay.plan_type as string);
    const price = (plan?.price ?? 0) + (Number(pay.cardio_price_snapshot) || 0);
    pendingRevenue += price;
  }

  // Manual cash entries.
  for (const m of manualRows) {
    const amt = Number(m.amount) || 0;
    dayPassRevenue += amt;
    totalRevenue += amt;
    const date = m.log_date;
    if (new Date(date) >= monthStart) monthRevenue += amt;

    const dp =
      dailyMap.get(date) ?? ({ date, revenue: 0, dayPass: 0 } as RevenuePoint);
    dp.dayPass += amt;
    dp.revenue += amt;
    dailyMap.set(date, dp);

    const dpm = dayPassMap.get(date) ?? { quantity: 0, amount: 0 };
    dpm.quantity += m.quantity;
    dpm.amount += amt;
    dayPassMap.set(date, dpm);

    recent.push({
      date,
      plan_type: m.type,
      label: m.type === "day_pass" ? "1-Day Pass" : m.type,
      amount: amt,
      source: "day_pass",
      quantity: m.quantity,
    });
  }

  // ---- Build last 30 days series ----
  const daily: RevenuePoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = ymd(d);
    daily.push(dailyMap.get(key) ?? { date: key, revenue: 0, dayPass: 0 });
  }

  // ---- Last 14 days of 1-day passes ----
  const dayPasses: { date: string; quantity: number; amount: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = ymd(d);
    dayPasses.push({ date: key, ...(dayPassMap.get(key) ?? { quantity: 0, amount: 0 }) });
  }

  recent.sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    totals: {
      totalRevenue: Math.round(totalRevenue),
      monthRevenue: Math.round(monthRevenue),
      pendingRevenue: Math.round(pendingRevenue),
      dayPassRevenue: Math.round(dayPassRevenue),
    },
    daily,
    byPlan: Array.from(byPlanMap.values()).sort((a, b) => b.revenue - a.revenue),
    dayPasses,
    recent: recent.slice(0, 25),
    manualEntries: manualRows.slice(0, 50),
  };
}

export async function deleteManualRevenue(
  id: string
): Promise<{ error: string | null }> {
  const { profile } = await requireAdmin();
  if (!profile) return { error: "Not authorized." };

  const supabase = await createSSRClient();
  const { error } = await supabase.from("manual_revenue").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/settings/revenue");
  return { error: null };
}
