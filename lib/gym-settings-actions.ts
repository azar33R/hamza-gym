"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { createClient as createSSRClient } from "@/lib/supabase/server";
import { requireStaffOrAdmin } from "@/lib/admin";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Generates a fresh 2-digit PIN via the regenerate_pin() RPC. Staff/admin only.
export async function regeneratePin(): Promise<{ error: string | null; pin: string | null }> {
  await requireStaffOrAdmin();
  const supabase = serviceClient();

  const { data, error } = await supabase.rpc("regenerate_pin");
  if (error) return { error: error.message, pin: null };

  revalidatePath("/admin");
  return { error: null, pin: (data as string) ?? null };
}

// Update gym_settings fields (vodafone_cash_wallet, etc.). Staff/admin only.
export async function updateGymSetting(
  field: "vodafone_cash_wallet",
  value: string
): Promise<{ error: string | null }> {
  await requireStaffOrAdmin();
  const supabase = serviceClient();

  const { error } = await supabase
    .from("gym_settings")
    .update({ [field]: value.trim() || null })
    .eq("id", 1);

  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  return { error: null };
}

// Read the Vodafone Cash wallet number (public — subscribers need this for the
// payment modal). Falls back to the hardcoded config value if the DB column is
// empty or unreadable.
export async function getVodafoneWallet(): Promise<string> {
  try {
    const ssr = await createSSRClient();
    const { data } = await ssr
      .from("gym_settings")
      .select("vodafone_cash_wallet")
      .eq("id", 1)
      .single();
    if (data?.vodafone_cash_wallet) return data.vodafone_cash_wallet;
  } catch {
    // RLS blocks subscriber reads on gym_settings — use service client.
  }

  try {
    const supabase = serviceClient();
    const { data } = await supabase
      .from("gym_settings")
      .select("vodafone_cash_wallet")
      .eq("id", 1)
      .single();
    if (data?.vodafone_cash_wallet) return data.vodafone_cash_wallet;
  } catch {
    // Gracefully fall back.
  }

  return "";
}

// Fetch gym_settings for the admin settings page. Staff/admin only.
export async function getGymSettings(): Promise<{
  error: string | null;
  settings: { id: number; daily_pin: string; vodafone_cash_wallet: string | null; updated_at: string } | null;
}> {
  await requireStaffOrAdmin();
  const supabase = serviceClient();

  const { data, error } = await supabase
    .from("gym_settings")
    .select("id, daily_pin, vodafone_cash_wallet, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) return { error: error.message, settings: null };
  return { error: null, settings: data as any };
}
