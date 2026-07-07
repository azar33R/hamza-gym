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

async function currentUserId(): Promise<string | null> {
  const ssr = await createSSRClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  return user?.id ?? null;
}

// Start a workout session for the signed-in user.
export async function startWorkoutSession(
  templateId: string | null
): Promise<{ error: string | null; sessionId: string | null }> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in.", sessionId: null };

  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: userId,
      template_id: templateId,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) return { error: error.message, sessionId: null };
  return { error: null, sessionId: data.id };
}

// Log a single completed set.
export async function logSet(data: {
  sessionId: string;
  exerciseName: string;
  setNumber: number;
  weight: number | null;
  reps: number | null;
  machineId: string | null;
}): Promise<{ error: string | null }> {
  const supabase = serviceClient();

  let machineId = data.machineId;
  if (machineId) {
    const { count } = await supabase
      .from("machine_library")
      .select("id", { count: "exact", head: true })
      .eq("id", machineId);
    if (!count) machineId = null;
  }

  const { error } = await supabase.from("set_logs").insert({
    session_id: data.sessionId,
    exercise_name: data.exerciseName,
    set_number: data.setNumber,
    weight: data.weight,
    reps: data.reps,
    machine_id: machineId,
  });
  if (error) return { error: error.message };
  return { error: null };
}

// Submit a lift for coach verification. Runs the plausibility rules inside the
// submit_lift() SQL function (positive weight, sane cap, checked-in today, no
// recent duplicate). Returns the status ('pending' / 'rejected'), a reason if
// rejected, the bodyweight ratio, and the submission id.
export async function submitLift(
  exerciseName: string,
  weight: number
): Promise<{
  error: string | null;
  status: "pending" | "rejected" | null;
  reason: string | null;
  ratio: number | null;
}> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in.", status: null, reason: null, ratio: null };

  const supabase = serviceClient();
  const { data, error } = await supabase.rpc("submit_lift", {
    p_user_id: userId,
    p_exercise_name: exerciseName,
    p_weight: weight,
  });

  if (error) return { error: error.message, status: null, reason: null, ratio: null };

  const row = (data as
    | { status: string; reason: string | null; ratio: number | null; submission_id: string | null }[]
    | null)?.[0];
  return {
    error: null,
    status: (row?.status as "pending" | "rejected") ?? null,
    reason: row?.reason ?? null,
    ratio: row?.ratio ?? null,
  };
}

// Backwards-compatible alias for callers still using the old name.
export const tryRecordPr = submitLift;

// Finish a workout: mark the session complete, update last_workout_date, award points.
export async function completeWorkout(
  sessionId: string
): Promise<{ error: string | null; pointsAwarded: number }> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in.", pointsAwarded: 0 };

  const supabase = serviceClient();

  const { error: sessionErr } = await supabase
    .from("workout_sessions")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (sessionErr) return { error: sessionErr.message, pointsAwarded: 0 };

  const { error: profileErr } = await supabase
    .from("profiles")
    .update({ last_workout_date: new Date().toISOString().split("T")[0] })
    .eq("id", userId);
  if (profileErr) return { error: profileErr.message, pointsAwarded: 0 };

  const { error: pointsErr } = await supabase.rpc("award_points", {
    p_user_id: userId,
    p_amount: POINT_REWARDS.WORKOUT_COMPLETE,
    p_reason: "Workout completed",
  });
  if (pointsErr) return { error: pointsErr.message, pointsAwarded: 0 };

  revalidatePath("/dashboard");
  return { error: null, pointsAwarded: POINT_REWARDS.WORKOUT_COMPLETE };
}
