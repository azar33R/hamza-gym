"use server";

import { createClient } from "@supabase/supabase-js";

export async function getUserAuthInfo(userId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data } = await supabase.auth.admin.getUserById(userId);
  if (!data?.user) return { phone: null, email: null };
  return { phone: data.user.phone ?? null, email: data.user.email ?? null };
}
