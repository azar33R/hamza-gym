import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STAFF_ROLES, type UserRole } from "@/lib/constants";
import type { Profile } from "@/lib/types";

// Server guard: load session + profile, redirect non-admins to their dashboard.
// Use at the top of every admin page / the admin layout.
export async function requireAdmin(): Promise<{ userId: string; profile: Profile }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  return { userId: user.id, profile };
}

// Server guard: admits BOTH admin and staff. Use for the admin layout + any
// action/page staff are allowed to use (workouts, machines, check-ins, PIN).
// Returns the caller's role so pages/actions can branch.
export async function requireStaffOrAdmin(): Promise<{
  userId: string;
  profile: Profile;
  role: UserRole;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    redirect("/dashboard");
  }

  return { userId: user.id, profile, role: profile.role };
}
