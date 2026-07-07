"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin";
import type { UserRole } from "@/lib/constants";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const VALID_ROLES: UserRole[] = ["admin", "staff", "subscriber"];

// changeUserRole — admin only. Promotes/demotes a user. Prevents an admin
// from locking themselves out (you can't change your own role).
export async function changeUserRole(
  targetUserId: string,
  newRole: UserRole
): Promise<{ error: string | null }> {
  const { userId } = await requireAdmin();

  if (!VALID_ROLES.includes(newRole)) {
    return { error: "Invalid role." };
  }
  if (targetUserId === userId) {
    return { error: "You can't change your own role." };
  }

  const supabase = serviceClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role: newRole })
    .eq("id", targetUserId);

  if (error) return { error: error.message };

  revalidatePath("/admin/clients");
  return { error: null };
}
