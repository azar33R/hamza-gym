"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { requireStaffOrAdmin } from "@/lib/admin";
import type { Machine } from "@/lib/types";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Create or update a machine_library row. The photo_url is set by the client
// (which uploads the file directly to the machine-photos bucket, then passes
// the returned public URL here).
export async function saveMachine(
  machineId: string | null,
  data: { name: string; photo_url: string | null; primary_muscle: string | null }
): Promise<{ error: string | null; machine?: Machine | null }> {
  await requireStaffOrAdmin();

  if (!data.name.trim()) return { error: "Name is required." };

  const supabase = serviceClient();
  const payload = {
    name: data.name.trim(),
    photo_url: data.photo_url,
    primary_muscle: data.primary_muscle?.trim() || null,
  };

  let error: { message: string } | null = null;
  let result;
  if (machineId) {
    ({ error, data: result } = await supabase
      .from("machine_library")
      .update(payload)
      .eq("id", machineId)
      .select("*")
      .single());
  } else {
    ({ error, data: result } = await supabase
      .from("machine_library")
      .insert(payload)
      .select("*")
      .single());
  }

  if (error) return { error: error.message };

  // Templates may denormalize machine photos, so revalidate the builder + workouts.
  revalidatePath("/admin/machines");
  revalidatePath("/admin/workouts");
  return { error: null, machine: result as Machine | null };
}

export async function deleteMachine(machineId: string) {
  await requireStaffOrAdmin();
  const supabase = serviceClient();
  const { error } = await supabase.from("machine_library").delete().eq("id", machineId);
  if (error) return { error: error.message };
  revalidatePath("/admin/machines");
  revalidatePath("/admin/workouts");
  return { error: null };
}
