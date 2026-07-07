"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUser } from "@/lib/push";
import { requireAdmin } from "@/lib/admin";
import type { PlanType, PaymentMethod } from "@/lib/constants";

// Service-role admin client — bypasses RLS for management operations.
function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ---- Payment request: APPROVE ----------------------------------------------
// Calls the activate_subscription() SQL function, marks the request approved,
// and notifies the user.
export async function approvePaymentRequest(requestId: string) {
  await requireAdmin();
  const supabase = serviceClient();

  // Fetch the request to get user + plan.
  const { data: req } = await supabase
    .from("payment_requests")
    .select("user_id, plan_type")
    .eq("id", requestId)
    .single();

  if (!req) return { error: "Payment request not found." };

  // Activate the subscription via the SQL helper (computes end_date).
  const { error: rpcError } = await supabase.rpc("activate_subscription", {
    p_user_id: req.user_id,
    p_plan_type: req.plan_type as PlanType,
    p_method: "vodafone_cash" as PaymentMethod,
  });

  if (rpcError) return { error: rpcError.message };

  // Mark request approved.
  await supabase
    .from("payment_requests")
    .update({ status: "approved" })
    .eq("id", requestId);

  // Notify the member.
  await sendPushToUser(
    req.user_id,
    {
      title: "Subscription Activated! 💪",
      body: "Your payment was approved. Welcome to the gym!",
    },
    "payment",
    null,
    "/dashboard"
  );

  revalidatePath("/admin/triage");
  revalidatePath("/admin");
  revalidatePath("/admin/clients");
  return { error: null };
}

// ---- Payment request: REJECT -----------------------------------------------
export async function rejectPaymentRequest(requestId: string) {
  await requireAdmin();
  const supabase = serviceClient();

  const { data: req } = await supabase
    .from("payment_requests")
    .select("user_id")
    .eq("id", requestId)
    .single();

  if (!req) return { error: "Payment request not found." };

  await supabase
    .from("payment_requests")
    .update({ status: "rejected" })
    .eq("id", requestId);

  await sendPushToUser(
    req.user_id,
    {
      title: "Payment Update",
      body: "Your payment request could not be verified. Please contact the gym.",
    },
    "payment",
    null,
    "/dashboard"
  );

  revalidatePath("/admin/triage");
  revalidatePath("/admin");
  return { error: null };
}

// ---- Nudge an AWOL client --------------------------------------------------
export async function nudgeClient(userId: string) {
  await requireAdmin();
  const supabase = serviceClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .single();

  const name = profile?.full_name?.split(" ")[0] ?? "there";
  await sendPushToUser(
    userId,
    {
      title: "We miss you, " + name + "! 👋",
      body: "It's been a while since your last workout. Time to get back to it!",
    },
    "nudge",
    null,
    "/dashboard"
  );

  revalidatePath("/admin/triage");
  return { error: null };
}
