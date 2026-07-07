import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import type { NotificationType } from "@/lib/types";

// ----------------------------------------------------------------------------
//  Web Push (VAPID). Gracefully no-ops if VAPID keys are not configured so the
//  rest of the app (and the notifications table) still work.
// ----------------------------------------------------------------------------

function vapidConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT_EMAIL
  );
}

// Configure web-push once on first use.
let configured = false;
function ensureConfigured() {
  if (configured) return;
  if (vapidConfigured()) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT_EMAIL!,
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
  }
  configured = true;
}

// Service-role client for reading push_subscriptions + writing notifications
// regardless of the caller's RLS context.
function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export type PushPayload = {
  title: string;
  body?: string;
};

// Send a push notification to every registered device for a user, and persist
// an in-app notification row. Returns how many pushes actually delivered.
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  type: NotificationType = "broadcast",
  expiresAt?: string | null
): Promise<number> {
  const supabase = serviceClient();

  // 1) Always store an in-app notification (works even without push).
  const notif: Record<string, unknown> = {
    user_id: userId,
    title: payload.title,
    body: payload.body ?? null,
    type,
  };
  if (expiresAt) notif.expires_at = expiresAt;
  await supabase.from("notifications").insert(notif);

  // 2) Attempt web push delivery.
  if (!vapidConfigured()) {
    console.info("[push] VAPID keys not set — skipping push delivery (notification stored).");
    return 0;
  }

  ensureConfigured();

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs || subs.length === 0) return 0;

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body ?? "",
  });

  let delivered = 0;
  await Promise.all(
    (subs as Array<{ endpoint: string; p256dh: string; auth: string }>).map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          message
        );
        delivered += 1;
      } catch (err) {
        // 410 Gone / 404 → stale subscription, remove it.
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      }
    })
  );

  return delivered;
}

// Convenience: send to many users (used by Broadcast + Nudge flows).
export async function sendPushToMany(
  userIds: string[],
  payload: PushPayload,
  type: NotificationType = "broadcast",
  expiresAt?: string | null
): Promise<number> {
  let delivered = 0;
  for (const id of userIds) {
    delivered += await sendPushToUser(id, payload, type, expiresAt);
  }
  return delivered;
}
