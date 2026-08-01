"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUser } from "@/lib/push";
import type { PlanType, PaymentMethod } from "@/lib/constants";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Activate via physical cash — admin manual override. The coach can pick a
// custom start date (past or future); default is today.
export async function activateViaCash(
  userId: string,
  planType: PlanType,
  startDate?: string | null
) {
  const supabase = serviceClient();

  const { error } = await supabase.rpc("activate_subscription", {
    p_user_id: userId,
    p_plan_type: planType,
    p_method: "manual_coach" as PaymentMethod,
    p_start_date: startDate || null,
  });

  if (error) return { error: error.message };

  await sendPushToUser(
    userId,
    { title: "Membership Activated! 💪", body: "Your coach has activated your plan." },
    "payment",
    null,
    "/dashboard"
  );

  revalidatePath("/admin/clients");
  revalidatePath("/admin");
  return { error: null };
}

// Edit an existing subscription's period — extend or shorten it. Updates the
// most recent subscription row and flips the member back to active since the
// coach is intentionally setting the period.
export async function updateSubscriptionDates(
  userId: string,
  startDate: string,
  endDate: string
): Promise<{ error: string | null }> {
  if (!startDate || !endDate) {
    return { error: "Both start and end dates are required." };
  }
  if (new Date(endDate) < new Date(startDate)) {
    return { error: "End date can't be before start date." };
  }

  const supabase = serviceClient();

  // Find the current (most recent) subscription.
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub) {
    return { error: "No subscription to edit. Use Activate via Cash first." };
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({ start_date: startDate, end_date: endDate })
    .eq("id", sub.id);
  if (error) return { error: error.message };

  await supabase
    .from("profiles")
    .update({ subscription_status: "active" })
    .eq("id", userId);

  revalidatePath("/admin/clients");
  revalidatePath("/admin");
  return { error: null };
}

// Cancel subscription — flip profile to inactive.
export async function cancelSubscription(userId: string) {
  const supabase = serviceClient();

  const { error } = await supabase
    .from("profiles")
    .update({ subscription_status: "inactive" })
    .eq("id", userId);

  if (error) return { error: error.message };

  revalidatePath("/admin/clients");
  revalidatePath("/admin");
  return { error: null };
}

// Delete user — removes profile (cascade) + the auth user.
export async function deleteUser(userId: string) {
  const supabase = serviceClient();

  // Remove profile (cascade clears subscriptions, requests, etc.).
  const { error } = await supabase.from("profiles").delete().eq("id", userId);
  if (error) return { error: error.message };

  // Remove the auth user via admin API.
  const { error: authError } = await supabase.auth.admin.deleteUser(userId);
  if (authError) return { error: authError.message };

  revalidatePath("/admin/clients");
  revalidatePath("/admin");
  return { error: null };
}
