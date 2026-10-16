"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUser } from "@/lib/push";
import { requireAdmin } from "@/lib/admin";
import { recordTopUp, stampFullPayment } from "@/lib/subscription-payments";
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

  // Fetch the request to get user + plan (+ the cardio the member paid for).
  const { data: req } = await supabase
    .from("payment_requests")
    .select("user_id, plan_type, cardio, cardio_price_snapshot")
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

  // Book the money: an approved Vodafone request is a full payment at the
  // current plan price (+ the cardio add-on the member paid for), with a
  // matching ledger row.
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", req.user_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const subId = (sub as { id: string } | null)?.id;
  if (subId) {
    const { error: moneyError } = await stampFullPayment(
      subId,
      req.user_id,
      req.plan_type as PlanType,
      "vodafone_cash",
      null,
      {
        cardio: (req as { cardio?: boolean }).cardio ?? false,
        cardioPriceSnapshot: Number(
          (req as { cardio_price_snapshot?: number }).cardio_price_snapshot
        ) || null,
      }
    );
    if (moneyError) return { error: moneyError };
  }

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

// ---- Record a cash top-up --------------------------------------------------
// The member owed part of their plan (partial cash activation) and is now
// handing over more. Appends a ledger row and bumps paid_amount; capped at
// the remaining balance so overpaying is rejected, not silently absorbed.
export async function recordTopUpPayment(
  userId: string,
  amount: number,
  note?: string | null
) {
  const { userId: adminId } = await requireAdmin();

  const res = await recordTopUp(userId, Math.floor(Number(amount)), {
    note: note?.trim() || null,
    createdBy: adminId,
  });
  if (res.error) return res;

  await sendPushToUser(
    userId,
    res.remaining && res.remaining > 0
      ? {
          title: "Payment received 💪",
          body: `Thanks! ${res.remaining} EGP still owed on your plan.`,
        }
      : {
          title: "Paid in full! ✅",
          body: "Your plan balance is settled. See you at the gym!",
        },
    "payment",
    null,
    "/dashboard"
  );

  revalidatePath("/admin/triage");
  revalidatePath("/admin/clients");
  revalidatePath("/admin");
  return res;
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
