"use server";

import { revalidatePath } from "next/cache";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createClient as createSSRClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";
import { phoneMatchForms } from "@/lib/phone";
import type { ChatMessage, Profile, UserRole } from "@/lib/types";

export type ChatContact = {
  id: string;
  full_name: string | null;
  face_photo_url: string | null;
  role: UserRole;
  // Last message in the conversation (either direction), newest-first preview.
  last_message: string | null;
  last_at: string | null;
  // Unread messages FROM this contact that the caller hasn't read yet.
  unread: number;
};

// Service-role client — bypasses RLS so server actions can read/write chat
// rows for either party regardless of the caller's auth context.
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

// Count the caller's unread inbound messages — used to badge the Chat tab in
// the bottom nav. Returns 0 for signed-out users (the nav won't render anyway).
export async function unreadChatCount(): Promise<{
  error: string | null;
  count: number;
}> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in.", count: 0 };

  const supabase = serviceClient();
  const { count, error } = await supabase
    .from("chat_messages")
    .select("*", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .is("read_at", null);

  if (error) return { error: error.message, count: 0 };
  return { error: null, count: count ?? 0 };
}

// Send a DM to recipientId. Persists the message and fires a push notification
// (gracefully no-ops without VAPID). revalidates both chat surfaces so they
// refresh immediately for the sender.
export async function sendMessage(
  recipientId: string,
  body: string,
  imageUrl?: string | null
): Promise<{ error: string | null }> {
  const senderId = await currentUserId();
  if (!senderId) return { error: "Not signed in." };

  const trimmed = body.trim();
  // A message must have text OR an image.
  if (!trimmed && !imageUrl) return { error: "Message cannot be empty." };
  if (trimmed.length > 1000) return { error: "Message is too long." };

  const supabase = serviceClient();

  const { error } = await supabase.from("chat_messages").insert({
    sender_id: senderId,
    recipient_id: recipientId,
    body: trimmed,
    image_url: imageUrl ?? null,
  });
  if (error) return { error: error.message };

  // Best-effort push: include the sender's name in the title.
  const { data: sender } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", senderId)
    .single();
  const senderName = sender?.full_name?.trim() || "New message";

  try {
    await sendPushToUser(
      recipientId,
      { title: senderName, body: trimmed || "📷 Photo" },
      "dm",
      null,
      // Deep-link to THIS conversation. The recipient opens the thread with the
      // sender, not the generic inbox.
      `/chat/${senderId}`
    );
  } catch {
    // Push is best-effort — the message itself is already persisted.
  }

  revalidatePath("/chat");
  revalidatePath("/admin/clients", "layout");
  return { error: null };
}

// Mark all unread messages from otherUserId to the caller as read.
export async function markThreadRead(
  otherUserId: string
): Promise<{ error: string | null }> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in." };

  const supabase = serviceClient();
  const { error } = await supabase
    .from("chat_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("sender_id", otherUserId)
    .eq("recipient_id", userId)
    .is("read_at", null);
  if (error) return { error: error.message };

  // Invalidate the inbox so its per-contact unread badges clear immediately
  // when the user navigates back (client-side nav otherwise serves stale RSC).
  revalidatePath("/chat");
  return { error: null };
}

// Fetch the full thread between the caller and otherUserId (both directions),
// oldest-first for top-to-bottom rendering.
export async function fetchThread(
  otherUserId: string
): Promise<{ error: string | null; messages: ChatMessage[] }> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in.", messages: [] };

  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .or(
      `and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`
    )
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return { error: error.message, messages: [] };
  return { error: null, messages: (data as ChatMessage[]) ?? [] };
}

// Fetch the caller's inbox against a given set of counterpart roles.
// Returns one row per contact with their latest message + unread count, newest
// first.
//
// `options.includeIdleSubscribers` controls whether subscribers you have NEVER
// messaged appear in the list. It is OFF for members: a member may only see
// staff/coaches plus people they already have a thread with. To reach another
// member they must look them up by phone number (see findContactByPhone).
// Staff/admins keep the full list so the coach can start a DM with anyone.
export async function fetchInbox(
  counterpartRoles: UserRole[],
  options: { includeIdleSubscribers?: boolean } = {}
): Promise<{ error: string | null; contacts: ChatContact[] }> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in.", contacts: [] };

  const supabase = serviceClient();
  const includeIdle = options.includeIdleSubscribers ?? false;

  // 1) All counterpart profiles (every admin/staff the subscriber can talk to,
  //    or every subscriber the admin/staff can talk to).
  const { data: peopleRaw } = await supabase
    .from("profiles")
    .select("id, full_name, face_photo_url, role")
    .in("role", counterpartRoles)
    .neq("id", userId)
    .order("created_at", { ascending: true });

  const people = (peopleRaw as
    | (Pick<Profile, "id" | "full_name" | "face_photo_url"> & {
        role: UserRole;
      })[]
    | null) ?? [];

  if (people.length === 0) return { error: null, contacts: [] };

  const ids = people.map((p) => p.id);
  const idList = ids.join(",");

  // 2) Every message between the caller and any of those contacts (both
  //    directions). Service-role client bypasses RLS so this works for either
  //    party. Capped at a few hundred recent rows; plenty for previews.
  const { data: msgsRaw, error } = await supabase
    .from("chat_messages")
    .select("*")
    .or(
      `and(sender_id.eq.${userId},recipient_id.in.(${idList})),and(sender_id.in.(${idList}),recipient_id.eq.${userId})`
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return { error: error.message, contacts: [] };

  const msgs = (msgsRaw as ChatMessage[]) ?? [];

  const lastByContact = new Map<string, ChatMessage>();
  const unreadByContact = new Map<string, number>();

  for (const m of msgs) {
    const otherId = m.sender_id === userId ? m.recipient_id : m.sender_id;
    // msgs are newest-first, so the first row per contact is the latest.
    if (!lastByContact.has(otherId)) lastByContact.set(otherId, m);
    // Unread = inbound + read_at is null.
    if (m.recipient_id === userId && m.read_at === null) {
      unreadByContact.set(otherId, (unreadByContact.get(otherId) ?? 0) + 1);
    }
  }

  const contacts: ChatContact[] = people.map((p) => {
    const last = lastByContact.get(p.id);
    return {
      id: p.id,
      full_name: p.full_name,
      face_photo_url: p.face_photo_url ?? null,
      role: p.role,
      last_message: last?.body ?? null,
      last_at: last?.created_at ?? null,
      unread: unreadByContact.get(p.id) ?? 0,
    };
  });

  // Sort: contacts with messages newest-first, then contacts with no messages
  // (by oldest profile) so a brand-new coach still appears at the bottom.
  contacts.sort((a, b) => {
    if (a.last_at && b.last_at) return b.last_at.localeCompare(a.last_at);
    if (a.last_at) return -1;
    if (b.last_at) return 1;
    return 0;
  });

  // Members don't get to browse the roster: drop counterpart MEMBERS they've
  // never talked to. Staff keep them (the coach needs the full list).
  const visible = includeIdle
    ? contacts
    : contacts.filter((c) => c.role !== "subscriber" || c.last_at !== null);

  return { error: null, contacts: visible };
}

// Resolve a typed phone number to a gym member so the caller can start a DM.
// This is the ONLY way a member may reach another member — the roster is not
// browsable. Returns a minimal contact (no phone echoed back) plus a short-lived
// signed `grant`, because opening the thread requires proving the conversation
// was started deliberately by phone lookup rather than by guessing a URL.
export async function findContactByPhone(
  rawPhone: string
): Promise<{
  error: string | null;
  contact: ChatContact | null;
  grant: string | null;
}> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in.", contact: null, grant: null };

  // profiles.phone mirrors auth.users.phone, which Supabase stores WITHOUT the
  // leading "+" ("201006857031") while normalizeEGPhone returns "+201006857031".
  // Match both spellings so either storage convention resolves.
  const forms = phoneMatchForms(rawPhone);
  if (forms.length === 0) return { error: "invalid_phone", contact: null, grant: null };

  const supabase = serviceClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, face_photo_url, role")
    .in("phone", forms)
    .limit(1);

  const p = (data?.[0] ?? null) as
    | (Pick<Profile, "id" | "full_name" | "face_photo_url"> & { role: UserRole })
    | null;

  if (!p) return { error: "not_found", contact: null, grant: null };
  if (p.id === userId) return { error: "self", contact: null, grant: null };

  return {
    error: null,
    grant: createThreadGrant(userId, p.id),
    contact: {
      id: p.id,
      full_name: p.full_name,
      face_photo_url: p.face_photo_url ?? null,
      role: p.role,
      last_message: null,
      last_at: null,
      unread: 0,
    },
  };
}

// ---------------------------------------------------------------------------
//  Thread grants
//
//  A member may only open a thread with another member if it already exists, or
//  if they arrived via phone lookup. "Arrived via phone lookup" is proven with a
//  short-lived HMAC over (callerId, otherId, expiry) — the browser can't forge
//  it, and the thread page only honours it for the exact pair it was issued for.
// ---------------------------------------------------------------------------
const GRANT_TTL_MS = 10 * 60 * 1000; // 10 minutes

function grantSecret(): string {
  // Server-only env var; never reaches the client bundle.
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-insecure-grant-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", grantSecret()).update(payload).digest("base64url");
}

function createThreadGrant(meId: string, otherId: string): string {
  const payload = `${meId}.${otherId}.${Date.now() + GRANT_TTL_MS}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export async function verifyThreadGrant(
  token: string | undefined,
  meId: string,
  otherId: string
): Promise<boolean> {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;

  const payload = Buffer.from(token.slice(0, dot), "base64url").toString();
  const mac = token.slice(dot + 1);

  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  const [caller, target, exp] = payload.split(".");
  if (caller !== meId || target !== otherId) return false;
  if (!exp || Number(exp) < Date.now()) return false;

  return true;
}
