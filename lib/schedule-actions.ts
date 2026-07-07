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

// Assign a workout template to a user on a specific date.
export async function assignWorkout(
  userId: string,
  templateId: string,
  date: string
): Promise<{
  error: string | null;
  item?: { id: string; scheduled_date: string; template_id: string };
}> {
  await requireStaffOrAdmin();
  const supabase = serviceClient();
  // Upsert — replace if a workout already exists for that day.
  const { error, data } = await supabase
    .from("scheduled_workouts")
    .upsert(
      { user_id: userId, template_id: templateId, scheduled_date: date },
      { onConflict: "user_id,scheduled_date" }
    )
    .select("id, scheduled_date, template_id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/admin/clients");
  return {
    error: null,
    item: data as { id: string; scheduled_date: string; template_id: string },
  };
}

// Remove a scheduled workout.
export async function removeWorkout(workoutId: string) {
  await requireStaffOrAdmin();
  const supabase = serviceClient();
  const { error } = await supabase
    .from("scheduled_workouts")
    .delete()
    .eq("id", workoutId);
  if (error) return { error: error.message };
  revalidatePath("/admin/clients");
  return { error: null };
}
