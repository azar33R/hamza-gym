"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { createClient as createSSRClient } from "@/lib/supabase/server";
import type { WorkoutPath } from "@/lib/constants";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Final step of onboarding: persist physical details + selected workout path.
// The face photo is uploaded client-side (RLS-scoped) and its URL passed in.
export async function saveOnboarding(data: {
  age: number;
  height_cm: number;
  weight_kg: number;
  gender: string | null;
  face_photo_url: string;
  workout_path: WorkoutPath;
}): Promise<{ error: string | null }> {
  // Identify the caller from their session cookie — never trust a client-sent id.
  const ssr = await createSSRClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) return { error: "Not signed in." };

  if (
    data.age <= 0 ||
    data.height_cm <= 0 ||
    data.weight_kg <= 0 ||
    !data.face_photo_url
  ) {
    return { error: "All physical details + a face photo are required." };
  }

  const supabase = serviceClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      age: data.age,
      height_cm: data.height_cm,
      weight_kg: data.weight_kg,
      gender: data.gender?.trim() || null,
      face_photo_url: data.face_photo_url,
      workout_path: data.workout_path,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/onboarding");
  return { error: null };
}
