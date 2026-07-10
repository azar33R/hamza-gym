"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { createClient as createSSRClient } from "@/lib/supabase/server";
import { POINT_REWARDS } from "@/lib/constants";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Verify the 2-digit PIN against gym_settings, then log the check-in (which
// also awards +50 points via check_in_member). Returns whether the user is now
// checked in for today.
export async function performCheckIn(
  pin: string
): Promise<{ error: string | null; checkedIn: boolean; pointsAwarded: number }> {
  const ssr = await createSSRClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) return { error: "Not signed in.", checkedIn: false, pointsAwarded: 0 };

  const cleaned = pin.trim();
  if (!/^\d{2}$/.test(cleaned)) {
    return { error: "PIN must be 2 digits.", checkedIn: false, pointsAwarded: 0 };
  }

  const supabase = serviceClient();

  const { data: ok, error: verifyErr } = await supabase.rpc("verify_pin", {
    p_pin: cleaned,
  });
  if (verifyErr) return { error: verifyErr.message, checkedIn: false, pointsAwarded: 0 };
  if (!ok) return { error: "Wrong PIN. Try again.", checkedIn: false, pointsAwarded: 0 };

  // Detect prior check-in so we can report accurate XP (check_in_member is
  // idempotent and won't double-award).
  const { data: profile } = await supabase
    .from("profiles")
    .select("last_attendance_date")
    .eq("id", user.id)
    .single();
  const alreadyToday =
    profile?.last_attendance_date &&
    new Date(profile.last_attendance_date).toDateString() === new Date().toDateString();

  const { error: checkInErr } = await supabase.rpc("check_in_member", {
    p_user_id: user.id,
  });
  if (checkInErr) return { error: checkInErr.message, checkedIn: false, pointsAwarded: 0 };

  revalidatePath("/dashboard");
  revalidatePath("/workout");
  return {
    error: null,
    checkedIn: true,
    pointsAwarded: alreadyToday ? 0 : POINT_REWARDS.CHECK_IN,
  };
}
