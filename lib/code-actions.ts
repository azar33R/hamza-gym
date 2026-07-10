"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { createClient as createSSRClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import type { PlanType, PaymentMethod } from "@/lib/constants";
import type { SubscriptionCode } from "@/lib/types";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function currentUserId(): Promise<string | null> {
  const ssr = await createSSRClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  return user?.id ?? null;
}

// Generate a short, ambiguous-char-free uppercase code.
function generateCodeString(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0O1Il
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

const VALID_PLAN_TYPES: PlanType[] = [
  "1-day",
  "1-month",
  "3-month",
  "6-month",
  "1-year",
];

// ---------------------------------------------------------------------------
//  Admin: code CRUD
// ---------------------------------------------------------------------------

export type CodeInput = {
  plan_type: PlanType;
  label?: string | null;
  max_uses?: number;
  expires_at?: string | null;
};

export async function createCode(input: CodeInput): Promise<{
  error: string | null;
  code: string | null;
}> {
  await requireAdmin();
  if (!VALID_PLAN_TYPES.includes(input.plan_type)) {
    return { error: "Invalid plan type.", code: null };
  }
  const maxUses = Math.max(1, Math.floor(input.max_uses ?? 1));
  const userId = await currentUserId();

  const supabase = serviceClient();
  // Retry a few times in the rare case of a code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCodeString();
    const { data, error } = await supabase
      .from("subscription_codes")
      .insert({
        code,
        plan_type: input.plan_type,
        label: input.label?.trim() || null,
        max_uses: maxUses,
        expires_at: input.expires_at ?? null,
        created_by: userId,
      })
      .select("code")
      .single();

    if (!error && data) return { error: null, code: data.code };
    // Unique violation — try again with a fresh code.
    if (!error || !error.message.includes("subscription_codes_code_key")) {
      // Some other error: surface it.
      if (error) return { error: error.message, code: null };
    }
  }
  return { error: "Couldn't generate a unique code. Try again.", code: null };
}

export async function updateCode(
  id: string,
  input: CodeInput & { is_active: boolean }
): Promise<{ error: string | null }> {
  await requireAdmin();
  if (!VALID_PLAN_TYPES.includes(input.plan_type)) {
    return { error: "Invalid plan type." };
  }

  const supabase = serviceClient();
  const { error } = await supabase
    .from("subscription_codes")
    .update({
      plan_type: input.plan_type,
      label: input.label?.trim() || null,
      max_uses: Math.max(1, Math.floor(input.max_uses ?? 1)),
      expires_at: input.expires_at ?? null,
      is_active: input.is_active,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/codes");
  return { error: null };
}

export async function deleteCode(id: string): Promise<{ error: string | null }> {
  await requireAdmin();
  const supabase = serviceClient();
  const { error } = await supabase.from("subscription_codes").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/codes");
  return { error: null };
}

// ---------------------------------------------------------------------------
//  Member: redeem a code
// ---------------------------------------------------------------------------

const REDEEM_METHOD: PaymentMethod = "manual_coach";

export async function redeemCode(rawCode: string): Promise<{
  error: string | null;
}> {
  const code = (rawCode ?? "").trim().toUpperCase();
  if (!code) return { error: "Enter a code." };

  const userId = await currentUserId();
  if (!userId) return { error: "Sign in to redeem a code." };

  const supabase = serviceClient();

  // Find a usable code.
  const { data: row, error: lookupError } = await supabase
    .from("subscription_codes")
    .select("id, code, plan_type, max_uses, used_count, expires_at, is_active")
    .eq("code", code)
    .maybeSingle();

  if (lookupError) return { error: "Something went wrong. Try again." };
  if (!row || !row.is_active) return { error: "invalid" };
  if (row.used_count >= row.max_uses) return { error: "used_up" };
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    return { error: "expired" };
  }

  // Activate the subscription via the existing RPC.
  const { error: activateError } = await supabase.rpc("activate_subscription", {
    p_user_id: userId,
    p_plan_type: row.plan_type as PlanType,
    p_method: REDEEM_METHOD,
  });
  if (activateError) return { error: "Something went wrong. Try again." };

  // Mark the code as redeemed.
  const { error: markError } = await supabase
    .from("subscription_codes")
    .update({
      used_count: row.used_count + 1,
      redeemed_by: userId,
      redeemed_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  if (markError) {
    // Subscription was already activated — don't fail the member over a
    // bookkeeping update. Best-effort only.
  }

  revalidatePath("/");
  revalidatePath("/billing");
  revalidatePath("/dashboard");
  return { error: null };
}

// ---------------------------------------------------------------------------
//  Admin: list codes for the management page
// ---------------------------------------------------------------------------

export async function getSubscriptionCodes(): Promise<{
  error: string | null;
  codes: SubscriptionCode[];
}> {
  await requireAdmin();
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("subscription_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, codes: [] };
  return { error: null, codes: data as SubscriptionCode[] };
}
