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

// Number of days a plan grants access to (used for expiry display).
export function planDurationDays(plan: Pick<Plan, "duration_months">): number {
  if (plan.duration_months <= 0) return 1; // 1-day pass
  return plan.duration_months * 30;
}

// Monthly-normalized price for MRR. 1-day pass contributes 0 to recurring rev.
export function planMonthlyValue(plan: Pick<Plan, "price_egp" | "duration_months">): number {
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
