"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeEGPhone } from "@/lib/phone";

// Update the authenticated user's phone number in auth.users.
export async function updateAuthPhone(
  rawPhone: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const phone = normalizeEGPhone(rawPhone);
  if (!phone) return { error: "Enter a valid Egyptian number, e.g. 01006857031" };

  const { error } = await supabase.auth.updateUser({ phone });
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { error: null };
}

// Update the authenticated user's email in auth.users.
export async function updateAuthEmail(
  email: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const trimmed = email.trim();
  if (!trimmed || !trimmed.includes("@")) return { error: "Enter a valid email." };

  const { error } = await supabase.auth.updateUser({ email: trimmed });
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { error: null };
}

// Change the authenticated user's password. Requires the current password for
// security — we verify it by signing in with the SSR client first, then update.
export async function updateAuthPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ error: string | null }> {
  if (!currentPassword || currentPassword.length < 6)
    return { error: "Current password is required." };
  if (!newPassword || newPassword.length < 6)
    return { error: "New password must be at least 6 characters." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Determine which identifier the user signed up with so we can verify
  // the current password via signInWithPassword.
  const identifier = user.phone ?? user.email;
  if (!identifier) return { error: "No phone or email on file." };

  // Verify current password by attempting a sign-in.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    ...(user.phone ? { phone: user.phone } : { email: user.email! }),
    password: currentPassword,
  });

  if (verifyError) return { error: "Current password is incorrect." };

  // Current password is valid — update to the new one.
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { error: null };
}
