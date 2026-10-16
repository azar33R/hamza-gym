"use server";

import { createClient } from "@supabase/supabase-js";
import type { PlanType } from "@/lib/constants";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export type SubscriptionMoney = {
  id: string;
  user_id: string;
  plan_type: string;
  price_snapshot: number | null;
  paid_amount: number;
  due_date: string | null;
};

// Latest subscription for a member, with its money columns.
export async function getLatestSubscriptionMoney(
  userId: string
): Promise<{ data: SubscriptionMoney | null }> {
  const supabase = serviceClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("id, user_id, plan_type, price_snapshot, paid_amount, due_date")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data: (data as SubscriptionMoney | null) ?? null };
}

// Payment history for one subscription, newest last.
export async function getPaymentHistory(subscriptionId: string) {
  const supabase = serviceClient();
  const { data } = await supabase
    .from("subscription_payments")
    .select("id, amount, method, note, created_at")
    .eq("subscription_id", subscriptionId)
    .order("created_at", { ascending: true });
  return (data ?? []) as {
    id: string;
    amount: number;
    method: string;
    note: string | null;
    created_at: string;
  }[];
}

async function planPricing(planType: PlanType): Promise<{
  price: number;
  cardioPrice: number;
}> {
  const supabase = serviceClient();
  const { data } = await supabase
    .from("plans")
    .select("price_egp, cardio_price")
    .eq("plan_type", planType)
    .maybeSingle();
  const row = (data as { price_egp: number; cardio_price: number } | null) ?? null;
  return {
    price: Number(row?.price_egp) || 0,
    cardioPrice: Number(row?.cardio_price) || 0,
  };
}

// Stamp a subscription as fully paid at the CURRENT plan price and write the
// matching ledger row. Used by every full-payment activation path
// (Vodafone approval, cash activation, full-price manual member creation) so
// revenue — which reads paid_amount — stays correct for all of them.
// `cardio` opts the cardio add-on in: the total becomes plan + cardio and both
// the flag and the add-on snapshot are stored on the subscription.
export async function stampFullPayment(
  subscriptionId: string,
  userId: string,
  planType: PlanType,
  method: "vodafone_cash" | "manual_coach",
  note?: string | null,
  opts: { cardio?: boolean; cardioPriceSnapshot?: number | null } = {}
): Promise<{ error: string | null }> {
  const supabase = serviceClient();
  const { price, cardioPrice } = await planPricing(planType);
  const cardioAddon =
    opts.cardio && (opts.cardioPriceSnapshot ?? cardioPrice) > 0
      ? Math.floor(Number(opts.cardioPriceSnapshot ?? cardioPrice))
      : 0;
  const total = price + cardioAddon;

  const { error: payError } = await supabase
    .from("subscription_payments")
    .insert({
      subscription_id: subscriptionId,
      user_id: userId,
      amount: total,
      method,
      note: note ?? null,
    });
  if (payError) return { error: payError.message };

  const { error: subError } = await supabase
    .from("subscriptions")
    .update({
      price_snapshot: total,
      paid_amount: total,
      due_date: null,
      cardio: cardioAddon > 0,
      cardio_price_snapshot: cardioAddon,
    })
    .eq("id", subscriptionId);
  if (subError) return { error: subError.message };

  return { error: null };
}

// Record a cash top-up against the member's latest subscription. Caps at the
// remaining balance — overpaying is rejected rather than silently absorbed.
export async function recordTopUp(
  userId: string,
  amount: number,
  opts: { note?: string | null; createdBy?: string | null } = {}
): Promise<{ error: string | null; remaining?: number }> {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Amount must be more than 0." };
  }

  const supabase = serviceClient();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, user_id, price_snapshot, paid_amount")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const s = sub as {
    id: string;
    user_id: string;
    price_snapshot: number | null;
    paid_amount: number | null;
  } | null;
  if (!s) return { error: "No subscription to take payment against." };

  const price = Number(s.price_snapshot) || 0;
  const paid = Number(s.paid_amount) || 0;
  const remaining = Math.max(0, price - paid);
  if (remaining <= 0) return { error: "Nothing owed — already fully paid." };
  if (amount > remaining) {
    return { error: `Too much — only ${remaining} EGP is owed.` };
  }

  const { error: payError } = await supabase
    .from("subscription_payments")
    .insert({
      subscription_id: s.id,
      user_id: s.user_id,
      amount,
      method: "manual_coach",
      note: opts.note ?? null,
      created_by: opts.createdBy ?? null,
    });
  if (payError) return { error: payError.message };

  const newPaid = paid + amount;
  const { error: subError } = await supabase
    .from("subscriptions")
    .update({
      paid_amount: newPaid,
      // Clear the promise date once the debt is settled.
      ...(newPaid >= price ? { due_date: null } : {}),
    })
    .eq("id", s.id);
  if (subError) return { error: subError.message };

  return { error: null, remaining: Math.max(0, price - newPaid) };
}
