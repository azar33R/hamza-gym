"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin";
import type { PlanType } from "@/lib/constants";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const VALID_PLAN_TYPES: PlanType[] = [
  "1-day",
  "1-month",
  "3-month",
  "6-month",
  "1-year",
];

export async function upsertPlan(
  planId: string | null,
  data: {
    plan_type: string;
    label: string;
    price_egp: number;
    cardio_price: number;
    duration_months: number;
    features: string[];
    is_active: boolean;
    sort_order: number;
  }
) {
  await requireAdmin();

  if (!VALID_PLAN_TYPES.includes(data.plan_type as PlanType)) {
    return { error: "Invalid plan type." };
  }
  if (!data.label.trim()) return { error: "Label is required." };
  if (data.duration_months < 0) return { error: "Duration must be ≥ 0." };

  const supabase = serviceClient();
  const payload = {
    plan_type: data.plan_type as PlanType,
    label: data.label.trim(),
    price_egp: data.price_egp,
    cardio_price: data.cardio_price,
    duration_months: data.duration_months,
    features: data.features,
    is_active: data.is_active,
    sort_order: data.sort_order,
  };

  let error;
  if (planId) {
    ({ error } = await supabase.from("plans").update(payload).eq("id", planId));
  } else {
    ({ error } = await supabase.from("plans").insert(payload));
  }

  if (error) return { error: error.message };
  revalidatePath("/admin/plans");
  revalidatePath("/admin");
  revalidatePath("/billing");
  return { error: null };
}

export async function deletePlan(planId: string) {
  await requireAdmin();
  const supabase = serviceClient();
  const { error } = await supabase.from("plans").delete().eq("id", planId);
  if (error) return { error: error.message };
  revalidatePath("/admin/plans");
  revalidatePath("/admin");
  revalidatePath("/billing");
  return { error: null };
}
