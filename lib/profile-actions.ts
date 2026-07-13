"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { createClient as createSSRClient } from "@/lib/supabase/server";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function updateProfile(data: {
  height_cm: number;
  weight_kg: number;
  face_photo_url: string | null;
}): Promise<{ error: string | null }> {
  const ssr = await createSSRClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) return { error: "Not signed in." };

  if (data.height_cm <= 0 || data.weight_kg <= 0) {
    return { error: "Height and weight must be positive." };
  }

  const supabase = serviceClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      height_cm: data.height_cm,
      weight_kg: data.weight_kg,
      face_photo_url: data.face_photo_url,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  return { error: null };
}

// Update only the member's profile photo (no height/weight validation).
export async function updateFacePhoto(
  facePhotoUrl: string | null
): Promise<{ error: string | null }> {
  const ssr = await createSSRClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const supabase = serviceClient();
  const { error } = await supabase
    .from("profiles")
    .update({ face_photo_url: facePhotoUrl })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  return { error: null };
}
