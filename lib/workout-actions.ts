"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { requireStaffOrAdmin } from "@/lib/admin";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ExerciseInput now carries an optional machine_id + denormalized photo_url
// so the active-workout view can render machine cues without extra joins.
export type ExerciseInput = {
  name: string;
  sets: number;
  reps: number;
  machine_id?: string | null;
  photo_url?: string | null;
};

export async function saveWorkoutTemplate(
  templateId: string | null,
  name: string,
  description: string,
  exercises: ExerciseInput[]
) {
  const { userId } = await requireStaffOrAdmin();
  const supabase = serviceClient();

  if (!name.trim()) return { error: "Name is required." };

  const payload = {
    name: name.trim(),
    description: description.trim() || null,
    exercises: exercises.filter((e) => e.name.trim()),
  };

  let error;
  if (templateId) {
    ({ error } = await supabase
      .from("workout_templates")
      .update(payload)
      .eq("id", templateId));
  } else {
    ({ error } = await supabase
      .from("workout_templates")
      .insert({ ...payload, created_by: userId }));
  }

  if (error) return { error: error.message };

  revalidatePath("/admin/workouts");
  return { error: null };
}

export async function deleteWorkoutTemplate(templateId: string) {
  await requireStaffOrAdmin();
  const supabase = serviceClient();
  const { error } = await supabase
    .from("workout_templates")
    .delete()
    .eq("id", templateId);
  if (error) return { error: error.message };
  revalidatePath("/admin/workouts");
  return { error: null };
}
