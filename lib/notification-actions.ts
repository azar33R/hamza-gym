"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { createClient as createSSRClient } from "@/lib/supabase/server";
import type { Notification } from "@/lib/types";

// Service-role client — bypasses RLS so the caller can read + update their own
// notifications regardless of auth-context quirks of the SSR anon-key client.
function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function currentUserId(): Promise<string | null> {
  const ssr = await createSSRClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  return user?.id ?? null;
}

// A notification row — surfaced to the UI for rendering. Mirrors the
// public.notifications shape.
export type NotificationRow = Notification;

// Fetch the caller's notifications, newest first, capped at `limit`.
export async function fetchNotifications(
  limit = 25
): Promise<{ error: string | null; notifications: NotificationRow[] }> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in.", notifications: [] };

  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { error: error.message, notifications: [] };
  return { error: null, notifications: (data as NotificationRow[]) ?? [] };
}

// Count of the caller's unread notifications — used to badge the bell.
export async function unreadNotificationCount(): Promise<{
  error: string | null;
  count: number;
}> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in.", count: 0 };

  const supabase = serviceClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) return { error: error.message, count: 0 };
  return { error: null, count: count ?? 0 };
}

// Mark every unread notification for the caller as read. Revalidates the
// surfaces that depend on the unread count.
export async function markAllNotificationsRead(): Promise<{
  error: string | null;
}> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in." };

  const supabase = serviceClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) return { error: error.message };

  revalidatePath("/notifications");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { error: null };
}

// Mark a single notification read (e.g. when opened from the list).
export async function markNotificationRead(
  id: string
): Promise<{ error: string | null }> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in." };

  const supabase = serviceClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: error.message };

  revalidatePath("/notifications");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { error: null };
}

