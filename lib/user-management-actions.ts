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

// Activate via physical cash — admin manual override.
export async function activateViaCash(userId: string, planType: PlanType) {
  const supabase = serviceClient();

  const { error } = await supabase.rpc("activate_subscription", {
    p_user_id: userId,
    p_plan_type: planType,
    p_method: "manual_coach" as PaymentMethod,
  });

  if (error) return { error: error.message };

  await sendPushToUser(
    userId,
    { title: "Membership Activated! 💪", body: "Your coach has activated your plan." },
    "payment"
  );

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
