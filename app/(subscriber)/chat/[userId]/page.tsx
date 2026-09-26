import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ChatThread } from "@/components/subscriber/chat-thread";
import { ChatThreadReadMarker } from "@/components/subscriber/chat-thread-page";
import { verifyThreadGrant } from "@/lib/chat-actions";
import { getT } from "@/lib/i18n/server";
import type { ChatMessage, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

// Subscriber view of the DM thread with a specific other user (a fellow
// member, a coach, or staff). Target of a contact row on /chat. Validates the
// target exists and isn't the caller themselves.
export default async function SubscriberConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meId = user!.id;
  const { userId } = await params;
  const { t: grant } = await searchParams;
  const t = await getT();

  // Caller role — staff can message anyone; members are restricted.
  const { data: meProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", meId)
    .maybeSingle();
  const meRole = (meProfile as { role: string } | null)?.role ?? "subscriber";

  const backHref = "/chat";
  const backLabel = t("common.back");

  // Can't (and shouldn't) message yourself.
  if (meId === userId) {
    return (
      <div className="space-y-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-50"
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" /> {backLabel}
        </Link>
        <p className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-zinc-400">
          {t("chat.cant_message_self")}
        </p>
      </div>
    );
  }

  // Validate the target exists. After 0010, any signed-in user can SELECT any
  // profile, so this works for members, coaches, and staff alike.
  const { data: otherRaw } = await supabase
    .from("profiles")
    .select("id, full_name, face_photo_url, role")
    .eq("id", userId)
    .maybeSingle();
  const other = (otherRaw as
    | (Pick<Profile, "id" | "full_name" | "face_photo_url"> & { role: string })
    | null);

  if (!other) {
    return (
      <div className="space-y-4">
        <Link
          href="/chat"
          className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-50"
        >
          <ChevronLeft className="h-4 w-4" /> Back to messages
        </Link>
        <p className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-zinc-400">
          This person isn&apos;t available to message.
        </p>
      </div>
    );
  }

  // Enforce "members can't browse each other": a member may open a thread with
  // staff/coaches, or with another member only if the thread ALREADY exists or
  // they arrived via phone lookup (proven by a short-lived signed grant). Without
  // one of those two, refuse — otherwise this page would be a trivial URL
  // bypass of the roster restriction in /chat.
  const callerIsStaff = meRole === "admin" || meRole === "staff";
  if (!callerIsStaff && other.role === "subscriber") {
    const hasGrant = await verifyThreadGrant(grant, meId, userId);

    if (!hasGrant) {
      const { data: existing } = await supabase
        .from("chat_messages")
        .select("id")
        .or(
          `and(sender_id.eq.${meId},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${meId})`
        )
        .limit(1);

      if (!existing || existing.length === 0) {
        return (
          <div className="space-y-4">
            <Link
              href="/chat"
              className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-50"
            >
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" /> {backLabel}
            </Link>
            <p className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-zinc-400">
              {t("chat.member_thread_blocked")}
            </p>
          </div>
        );
      }
    }
  }

  // Friendly label for the header.
  const isStaff = other.role === "admin" || other.role === "staff";
  const otherName =
    other.full_name?.trim() || (isStaff ? t("chat.coach") : t("common.member"));

  // Full thread (both directions), oldest-first for top-to-bottom rendering.
  // Read via the RLS-scoped SSR client — the subscriber can read every chat row
  // they're a party to (sender_id or recipient_id = auth.uid()), so this needs
  // no service role.
  const { data: threadRaw } = await supabase
    .from("chat_messages")
    .select("*")
    .or(
      `and(sender_id.eq.${meId},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${meId})`
    )
    .order("created_at", { ascending: true })
    .limit(200);
  const messages = (threadRaw as ChatMessage[]) ?? [];

  return (
    <div className="space-y-3">
      <Link
        href="/chat"
        className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-50"
      >
        <ChevronLeft className="h-4 w-4" /> Back to messages
      </Link>

      <ChatThreadReadMarker otherUserId={userId} />
      <ChatThread
        messages={messages}
        currentUserId={meId}
        otherName={otherName}
        otherPhotoUrl={other.face_photo_url}
        recipientId={userId}
      />
    </div>
  );
}
