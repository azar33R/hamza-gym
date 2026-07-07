"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { createClient as createSSRClient } from "@/lib/supabase/server";
import { sendPushToMany } from "@/lib/push";
import { STAFF_ROLES, type PlanType } from "@/lib/constants";

// Service-role client — bypasses RLS for the inserts + the staff lookup.
function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Server-side handler for a Vodafone Cash payment submission. Replaces the
// inline client inserts in the payment modal: it creates the payment_requests
// row, flips the caller's profile to pending_approval, AND pushes a
// notification to every admin/staff so the coach knows a payment landed
// (instead of having to poll /admin/triage).
export async function submitPaymentRequest(data: {
  planType: PlanType;
  senderWalletNumber: string;
  transactionId: string;
}): Promise<{ error: string | null }> {
  const ssr = await createSSRClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const wallet = data.senderWalletNumber.trim();
  const txn = data.transactionId.trim();
  if (!wallet || !txn) {
    return { error: "Wallet number and transaction ID are required." };
  }

  const supabase = serviceClient();

  // 1) Create the pending payment request.
  const { error: reqError } = await supabase.from("payment_requests").insert({
    user_id: user.id,
    plan_type: data.planType,
    sender_wallet_number: wallet,
    transaction_id: txn,
    status: "pending",
  });
  if (reqError) return { error: reqError.message };

  // 2) Flip the profile into pending_approval.
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ subscription_status: "pending_approval" })
    .eq("id", user.id);
  if (profileError) return { error: profileError.message };

  // 3) Notify every admin/staff that a payment landed. Best-effort push:
  //    also leaves an in-app notification row per recipient.
  const { data: member } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();
  const firstName = member?.full_name?.split(" ")[0] ?? "A member";
  const planLabel = data.planType.replace("-", " ");

  const { data: staff } = await supabase
    .from("profiles")
    .select("id")
    .in("role", STAFF_ROLES);
  const staffIds = (staff ?? []).map((s) => s.id);

  if (staffIds.length > 0) {
    try {
      await sendPushToMany(
        staffIds,
        {
          title: "New Payment Request 💰",
          body: `${firstName} submitted a ${planLabel} payment for approval.`,
        },
        "payment"
      );
    } catch {
      // Push is best-effort — the payment request itself is already saved.
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin");
  revalidatePath("/admin/triage");
  return { error: null };
}
