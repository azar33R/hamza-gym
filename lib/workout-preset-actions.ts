"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { requireStaffOrAdmin } from "@/lib/admin";
import type { WorkoutPreset, PresetExercise } from "@/lib/constants";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// All gym-wide presets (gym-wide starter routines), newest first.
export async function getWorkoutPresets(): Promise<WorkoutPreset[]> {
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("workout_presets")
    .select("id, name, description, emoji, exercises, created_at")
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as unknown as WorkoutPreset[]).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    emoji: p.emoji ?? "🏋️",
    exercises: (p.exercises as PresetExercise[]) ?? [],
  }));
}

export async function saveWorkoutPreset(
  id: string | null,
  data: {
    name: string;
    description: string;
    emoji: string;
    exercises: PresetExercise[];
  }
): Promise<{ error: string | null }> {
  await requireStaffOrAdmin();
  if (!data.name.trim()) return { error: "Name is required." };

  const supabase = serviceClient();
  const payload = {
    name: data.name.trim(),
    description: data.description.trim() || null,
    emoji: data.emoji.trim() || "🏋️",
    exercises: data.exercises as unknown,
  };

  let error;
  if (id) {
    ({ error } = await supabase
      .from("workout_presets")
      .update(payload)
      .eq("id", id));
  } else {
    ({ error } = await supabase.from("workout_presets").insert(payload));
  }

  if (error) return { error: error.message };

  revalidatePath("/workout");
  revalidatePath("/admin/workouts");
  return { error: null };
}

export async function deleteWorkoutPreset(
  id: string
): Promise<{ error: string | null }> {
  await requireStaffOrAdmin();
  const supabase = serviceClient();
  const { error } = await supabase.from("workout_presets").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/workout");
  revalidatePath("/admin/workouts");
  return { error: null };
}
