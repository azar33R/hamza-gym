import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ChatThread } from "@/components/subscriber/chat-thread";
import { ChatThreadReadMarker } from "@/components/subscriber/chat-thread-page";
import type { ChatMessage, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

// Subscriber view of the DM thread with a specific other user (a fellow
// member, a coach, or staff). Target of a contact row on /chat. Validates the
// target exists and isn't the caller themselves.
export default async function SubscriberConversationPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meId = user!.id;
  const { userId } = await params;

  // Can't (and shouldn't) message yourself.
  if (meId === userId) {
    return (
      <div className="space-y-4">
        <Link
          href="/chat"
          className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-50"
        >
          <ChevronLeft className="h-4 w-4" /> Back to messages
        </Link>
        <p className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-zinc-400">
          You can&apos;t message yourself.
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

  // Friendly label for the header.
  const isStaff = other.role === "admin" || other.role === "staff";
  const otherName =
    other.full_name?.trim() || (isStaff ? "Coach" : "Member");

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
