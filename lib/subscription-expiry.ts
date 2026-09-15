import { createClient } from "@supabase/supabase-js";
import type { SubscriptionStatus } from "@/lib/constants";

// Service-role client — bypasses RLS so a member's own visit can correct
// their status even though members can't write subscription_status themselves.
function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export function todayKey(d = new Date()) {
  return d.toISOString().split("T")[0];
}

// Self-healing expiry: if an "active" member's latest subscription has ended,
// flip them to "expired" and return the effective status to gate on.
// Members with no subscription row are left untouched.
export async function healExpiredSubscription(
  userId: string,
  current: SubscriptionStatus
): Promise<SubscriptionStatus> {
  if (current !== "active") return current;

  const supabase = serviceClient();
  const { data: latest } = await supabase
    .from("subscriptions")
    .select("end_date")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ end_date: string | null }>();

  const end = latest?.end_date ?? null;
  if (end && end < todayKey()) {
    await supabase
      .from("profiles")
      .update({ subscription_status: "expired" })
      .eq("id", userId);
    return "expired";
  }
  return current;
}
