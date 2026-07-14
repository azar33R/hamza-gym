"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { createClient as createSSRClient } from "@/lib/supabase/server";
import { requireStaffOrAdmin } from "@/lib/admin";
import { WORKOUT_PRESETS } from "@/lib/constants";

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

// All preset ids the given user has unlocked. Used to scope the subscriber's
// weekly planner so locked presets never show up.
export async function getUnlockedPresetIds(userId: string): Promise<string[]> {
  const supabase = serviceClient();
  const { data } = await supabase
    .from("user_preset_access")
    .select("preset_id")
    .eq("user_id", userId);
  return (data ?? []).map((d) => d.preset_id as string);
}

export type PresetAccessRow = {
  presetId: string;
  name: string;
  unlocked: boolean;
};

// Every known preset (static + DB) with its unlocked flag for this user.
// Drives the coach's unlock/lock UI in the member settings dialog.
export async function listPresetAccess(
  userId: string
): Promise<{ error: string | null; presets: PresetAccessRow[] }> {
  const supabase = serviceClient();
  const { data: dbPresets } = await supabase
    .from("workout_presets")
    .select("id, name");

  const all = new Map<string, string>();
  for (const p of WORKOUT_PRESETS) all.set(p.id, p.name);
  for (const p of (dbPresets ?? []) as { id: string; name: string }[]) {
    all.set(p.id, p.name);
  }

  const { data: unlocked } = await supabase
    .from("user_preset_access")
    .select("preset_id")
    .eq("user_id", userId);
  const unlockedSet = new Set((unlocked ?? []).map((d) => d.preset_id as string));

  const presets: PresetAccessRow[] = Array.from(all.entries()).map(
    ([presetId, name]) => ({
      presetId,
      name,
      unlocked: unlockedSet.has(presetId),
    })
  );

  return { error: null, presets };
}

// Unlock (or lock back) a preset for a member. Locking also removes any weekly
// schedule days that referenced the now-locked preset.
export async function setPresetUnlocked(
  userId: string,
  presetId: string,
  unlocked: boolean
): Promise<{ error: string | null }> {
  await requireStaffOrAdmin();
  const supabase = serviceClient();
  const actor = await currentUserId();

  if (unlocked) {
    const { error } = await supabase.from("user_preset_access").upsert(
      { user_id: userId, preset_id: presetId, unlocked_by: actor },
      { onConflict: "user_id,preset_id" }
    );
    if (error) return { error: error.message };
  } else {
    const { error: delErr } = await supabase
      .from("user_preset_access")
      .delete()
      .eq("user_id", userId)
      .eq("preset_id", presetId);
    if (delErr) return { error: delErr.message };

    await supabase
      .from("user_weekly_schedule")
      .delete()
      .eq("user_id", userId)
      .eq("source_type", "preset")
      .eq("source_id", presetId);
  }

  revalidatePath("/admin/clients");
  revalidatePath("/workout");
  return { error: null };
}
