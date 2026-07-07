"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { createClient as createSSRClient } from "@/lib/supabase/server";
import type { Exercise, UserWorkoutTemplate } from "@/lib/types";

// Service-role client — bypasses RLS so we can scope reads/writes to the
// caller ourselves (matches chat-actions / workout-session-actions).
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

// Same input shape the editor uses (machine link optional).
export type MyExerciseInput = {
  name: string;
  sets: number;
  reps: number;
  machine_id?: string | null;
  photo_url?: string | null;
};

// Fetch the caller's saved plans, newest-first.
export async function getMyPlans(): Promise<{
  error: string | null;
  plans: UserWorkoutTemplate[];
}> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in.", plans: [] };

  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("user_workout_templates")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, plans: [] };
  return { error: null, plans: (data as UserWorkoutTemplate[]) ?? [] };
}

// Create or update one of the caller's plans. When id is null a new plan is
// inserted; otherwise the existing row is updated (only if the caller owns it).
export async function saveMyPlan(
  id: string | null,
  name: string,
  description: string,
  exercises: MyExerciseInput[]
): Promise<{ error: string | null }> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in." };
  if (!name.trim()) return { error: "Name is required." };

  const payload = {
    name: name.trim(),
    description: description.trim() || null,
    exercises: exercises
      .filter((e) => e.name.trim())
      .map((e) => ({
        name: e.name.trim(),
        sets: Number(e.sets) || 0,
        reps: Number(e.reps) || 0,
        machine_id: e.machine_id ?? null,
        photo_url: e.photo_url ?? null,
      })) as Exercise[],
  };

  const supabase = serviceClient();

  if (id) {
    // Guard with an ownership filter so a caller can't write to someone else's row.
    const { error } = await supabase
      .from("user_workout_templates")
      .update(payload)
      .eq("id", id)
      .eq("user_id", userId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("user_workout_templates")
      .insert({ ...payload, user_id: userId });
    if (error) return { error: error.message };
  }

  revalidatePath("/workout");
  return { error: null };
}

// Delete one of the caller's plans (ownership-guarded).
export async function deleteMyPlan(
  id: string
): Promise<{ error: string | null }> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in." };

  const supabase = serviceClient();
  const { error } = await supabase
    .from("user_workout_templates")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: error.message };

  revalidatePath("/workout");
  return { error: null };
}
