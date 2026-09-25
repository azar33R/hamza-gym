import { createClient } from "@/lib/supabase/server";
import { requireStaffOrAdmin } from "@/lib/admin";
import { bucketMember, todayISODate, type MembershipBuckets } from "@/lib/membership";

// Counts members by EFFECTIVE status (see lib/membership.ts) so the dashboard,
// the clients page and the triage queue never disagree.
//
// Callers must already be staff/admin — requireStaffOrAdmin() runs here too so
// this is safe to call from any server component.
export async function getMembershipCounts(): Promise<MembershipBuckets> {
  await requireStaffOrAdmin();
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, subscription_status, created_at")
    .eq("role", "subscriber");

  const rows = (profiles ?? []) as {
    id: string;
    subscription_status: string | null;
    created_at: string;
  }[];

  const ids = rows.map((r) => r.id);
  const { data: subs } = ids.length
    ? await supabase
        .from("subscriptions")
        .select("user_id, end_date")
        .in("user_id", ids)
        .order("created_at", { ascending: false })
    : { data: [] };

  // Newest subscription per member wins (list is already newest-first).
  const latestEnd = new Map<string, string | null>();
  for (const s of (subs ?? []) as { user_id: string; end_date: string | null }[]) {
    if (!latestEnd.has(s.user_id)) latestEnd.set(s.user_id, s.end_date);
  }

  const today = todayISODate();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString();

  const b: MembershipBuckets = {
    active: 0,
    inactive: 0,
    lapsed: 0,
    neverPaid: 0,
    awaiting: 0,
    outstanding: 0,
    total: rows.length,
    newSignups: 0,
  };

  for (const p of rows) {
    const kind = bucketMember(p.subscription_status ?? "inactive", latestEnd.get(p.id), today);
    if (kind === "active") b.active++;
    else b.inactive++;
    if (kind === "lapsed") b.lapsed++;
    if (kind === "neverPaid") b.neverPaid++;
    if (kind === "awaiting") b.awaiting++;
    if (p.created_at >= cutoff) b.newSignups++;
  }
  b.outstanding = b.lapsed + b.awaiting;

  return b;
}
