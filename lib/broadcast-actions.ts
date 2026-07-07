"use server";

import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin";
import { sendPushToMany } from "@/lib/push";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export type Audience = "all" | "active" | "inactive" | "specific";

// Send a broadcast to a segment of users. Returns recipient count + delivered.
// `expiresInSeconds` — if set, the announcement auto-hides after that duration.
export async function sendBroadcast(
  audience: Audience,
  title: string,
  body: string,
  specificUserId?: string,
  expiresInSeconds?: number | null
): Promise<{ error: string | null; recipients: number; delivered: number }> {
  await requireAdmin();

  if (!title.trim()) return { error: "Title is required.", recipients: 0, delivered: 0 };

  const supabase = serviceClient();

  let userIds: string[] = [];

  if (audience === "specific") {
    if (!specificUserId) {
      return { error: "Select a user for a specific-target broadcast.", recipients: 0, delivered: 0 };
    }
    userIds = [specificUserId];
  } else {
    let query = supabase.from("profiles").select("id").eq("role", "subscriber");
    if (audience === "active") {
      query = query.eq("subscription_status", "active");
    } else if (audience === "inactive") {
      query = query.in("subscription_status", ["inactive", "expired", "pending_approval"]);
    }
    const { data, error } = await query;
    if (error) return { error: error.message, recipients: 0, delivered: 0 };
    userIds = (data ?? []).map((p) => p.id);
  }

  if (userIds.length === 0) {
    return { error: null, recipients: 0, delivered: 0 };
  }

  const expiresAt = expiresInSeconds
    ? new Date(Date.now() + expiresInSeconds * 1000).toISOString()
    : null;

  const delivered = await sendPushToMany(
    userIds,
    { title: title.trim(), body: body.trim() || undefined },
    "broadcast",
    expiresAt
  );

  return { error: null, recipients: userIds.length, delivered };
}
