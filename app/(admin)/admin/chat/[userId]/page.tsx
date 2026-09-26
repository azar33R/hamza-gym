import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ChatThread } from "@/components/subscriber/chat-thread";
import { ChatThreadReadMarker } from "@/components/subscriber/chat-thread-page";
import { getT } from "@/lib/i18n/server";
import type { ChatMessage, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

// Staff/admin view of a DM thread. This is where a DM notification's deep link
// (/chat/{senderId}, rewritten to /admin/chat/{senderId}) lands.
export default async function AdminConversationPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const t = await getT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meId = user!.id;
  const { userId } = await params;

  const backLink = (
    <Link
      href="/admin/chat"
      className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-50"
    >
      <ChevronLeft className="h-4 w-4 rtl:rotate-180" /> {t("common.back")}
    </Link>
  );

  if (meId === userId) {
    return (
      <div className="space-y-4">
        {backLink}
        <p className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-zinc-400">
          {t("chat.cant_message_self")}
        </p>
      </div>
    );
  }

  const { data: otherRaw } = await supabase
    .from("profiles")
    .select("id, full_name, face_photo_url, role")
    .eq("id", userId)
    .maybeSingle();
  const other = otherRaw as
    | (Pick<Profile, "id" | "full_name" | "face_photo_url"> & { role: string })
    | null;

  if (!other) {
    return (
      <div className="space-y-4">
        {backLink}
        <p className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-zinc-400">
          {t("chat.person_unavailable")}
        </p>
      </div>
    );
  }

  const isStaff = other.role === "admin" || other.role === "staff";
  const otherName = other.full_name?.trim() || (isStaff ? t("chat.coach") : t("common.member"));

  // RLS lets any signed-in user read the chat rows they're a party to, so this
  // needs no service role.
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
      {backLink}
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
