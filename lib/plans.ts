import { createClient } from "@/lib/supabase/server";
import type { Plan } from "@/lib/types";
import type { PlanType } from "@/lib/constants";

// Fetch the active plan catalog, ordered by sort_order.
export async function getActivePlans(): Promise<Plan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error || !data) return [];
  return data as Plan[];
}

// Fetch all plans (including inactive), ordered by sort_order.
export async function getAllPlans(): Promise<Plan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error || !data) return [];
  return data as Plan[];
}

// Number of days a plan grants access to (used for expiry display). A day-based
// duration wins; otherwise fall back to months (0 months = 1-day pass).
export function planDurationDays(
  plan: Pick<Plan, "duration_months" | "duration_days">
): number {
  if (plan.duration_days && plan.duration_days > 0) return plan.duration_days;
  if (plan.duration_months <= 0) return 1; // 1-day pass
  return plan.duration_months * 30;
}

// Monthly-normalized price for MRR. 1-day pass contributes 0 to recurring rev.
export function planMonthlyValue(
  plan: Pick<Plan, "price_egp" | "duration_months" | "duration_days">
): number {
  if (plan.duration_days && plan.duration_days > 0) {
    // A single day is a drop-in, not recurring revenue — excluding it stops a
    // 30 EGP day pass from being reported as 900 EGP/month.
    if (plan.duration_days <= 1) return 0;
    // Normalize a 15-day plan to a 30-day month so MRR stays comparable.
    return Number(plan.price_egp) / (plan.duration_days / 30);
  }
  if (plan.duration_months <= 0) return 0;
  return Number(plan.price_egp) / plan.duration_months;
}

// Look up a single plan by type.
export async function getPlanByType(planType: PlanType): Promise<Plan | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plans")
    .select("*")
    .eq("plan_type", planType)
    .maybeSingle();
  return (data as Plan | null) ?? null;
}
