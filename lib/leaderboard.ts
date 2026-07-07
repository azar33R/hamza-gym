import { createClient } from "@/lib/supabase/server";
import type { Tier } from "@/lib/constants";

export type LeaderboardMode = "points" | "ratio" | "weight";

export type LeaderboardRow = {
  user_id: string;
  full_name: string | null;
  face_photo_url: string | null;
  tier: Tier;
  value: number;
};

// Row shape from profiles — only active members rank.
type ProfileRankRow = {
  id: string;
  full_name: string | null;
  face_photo_url: string | null;
  points: number | null;
  current_tier: Tier | null;
};

type JoinedProfile = {
  full_name: string | null;
  face_photo_url: string | null;
  current_tier: Tier | null;
};

// Points — the main competitive board. Ranks members by their single spendable
// points balance (descending). Only active subscribers with points > 0 appear.
// (Earning raises points; buying cosmetics lowers them — so rank reflects the
// live balance.) The profiles table is SELECT-open to all authenticated users
// per migration 0011, so this aggregate actually returns data.
export async function pointsLeaderboard(): Promise<LeaderboardRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, face_photo_url, points, current_tier")
    .eq("role", "subscriber")
    .eq("subscription_status", "active")
    .gt("points", 0)
    .order("points", { ascending: false })
    .limit(100)
    .returns<ProfileRankRow[]>();

  if (error || !data) {
    console.error("[pointsLeaderboard]", error?.message ?? error);
    return [];
  }

  return data.map((p) => ({
    user_id: p.id,
    full_name: p.full_name,
    face_photo_url: p.face_photo_url,
    tier: p.current_tier ?? "iron",
    value: p.points ?? 0,
  }));
}

// Pound-for-Pound — highest calculated_ratio per user, verified lifts only.
// (personal_records is SELECT-open to all authenticated users per 0018.)
export async function ratioLeaderboard(): Promise<LeaderboardRow[]> {
  const supabase = await createClient();

  type PrRow = {
    user_id: string;
    calculated_ratio: number | null;
    profiles: JoinedProfile | null;
  };

  const { data, error } = await supabase
    .from("personal_records")
    .select("user_id, calculated_ratio, profiles(full_name, face_photo_url, current_tier)")
    .eq("verified", true)
    .not("calculated_ratio", "is", null)
    .order("calculated_ratio", { ascending: false })
    .returns<PrRow[]>();

  if (error || !data) {
    console.error("[ratioLeaderboard]", error?.message ?? error);
    return [];
  }

  // Keep only the top ratio per user (rows are pre-sorted desc).
  const best = new Map<string, LeaderboardRow>();
  for (const row of data) {
    if (best.has(row.user_id)) continue;
    best.set(row.user_id, {
      user_id: row.user_id,
      full_name: row.profiles?.full_name ?? null,
      face_photo_url: row.profiles?.face_photo_url ?? null,
      tier: row.profiles?.current_tier ?? "iron",
      value: row.calculated_ratio ?? 0,
    });
  }

  return Array.from(best.values())
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
}

// Heavy Hitters — highest absolute max_weight per user, verified lifts only.
// This is the anti-cheat payoff: only coach-approved lifts reach this board.
export async function weightLeaderboard(): Promise<LeaderboardRow[]> {
  const supabase = await createClient();

  type PrRow = {
    user_id: string;
    max_weight: number;
    profiles: JoinedProfile | null;
  };

  const { data, error } = await supabase
    .from("personal_records")
    .select("user_id, max_weight, profiles(full_name, face_photo_url, current_tier)")
    .eq("verified", true)
    .order("max_weight", { ascending: false })
    .returns<PrRow[]>();

  if (error || !data) {
    console.error("[weightLeaderboard]", error?.message ?? error);
    return [];
  }

  const best = new Map<string, LeaderboardRow>();
  for (const row of data) {
    if (best.has(row.user_id)) continue;
    best.set(row.user_id, {
      user_id: row.user_id,
      full_name: row.profiles?.full_name ?? null,
      face_photo_url: row.profiles?.face_photo_url ?? null,
      tier: row.profiles?.current_tier ?? "iron",
      value: row.max_weight,
    });
  }

  return Array.from(best.values()).sort((a, b) => b.value - a.value);
}
