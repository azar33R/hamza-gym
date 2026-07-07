import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaffOrAdmin } from "@/lib/admin";
import { ChatThread } from "@/components/subscriber/chat-thread";
import { ChatThreadReadMarker } from "@/components/subscriber/chat-thread-page";
import { getT } from "@/lib/i18n/server";
import type { ChatMessage, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

// Admin/staff view of the DM thread with a specific subscriber. This is the
// target of the chat icon in the clients directory.
export default async function AdminConversationPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId: adminId } = await requireStaffOrAdmin();
  const { userId: subscriberId } = await params;

  const supabase = await createClient();

  // Validate the target is a real subscriber.
  const { data: subRaw } = await supabase
    .from("profiles")
    .select("id, full_name, face_photo_url, role")
    .eq("id", subscriberId)
    .maybeSingle();
  const subscriber = (subRaw as
    | (Pick<Profile, "id" | "full_name" | "face_photo_url"> & { role: string })
    | null);

  const t = await getT();

  if (!subscriber) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/clients"
          className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-50"
        >
          <ChevronLeft className="h-4 w-4" /> {t("clients.back_to_clients")}
        </Link>
        <p className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-zinc-400">
          {t("clients.member_not_found")}
        </p>
      </div>
    );
  }

  // Full thread (both directions), oldest-first.
  const { data: threadRaw } = await supabase
    .from("chat_messages")
    .select("*")
    .or(
      `and(sender_id.eq.${adminId},recipient_id.eq.${subscriberId}),and(sender_id.eq.${subscriberId},recipient_id.eq.${adminId})`
    )
    .order("created_at", { ascending: true })
    .limit(200);
  const messages = (threadRaw as ChatMessage[]) ?? [];

  return (
    <div className="space-y-3">
      <Link
        href="/admin/clients"
        className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-50"
      >
        <ChevronLeft className="h-4 w-4" /> {t("clients.back_to_clients")}
      </Link>

      <ChatThreadReadMarker otherUserId={subscriberId} />
      <ChatThread
        messages={messages}
        currentUserId={adminId}
        otherName={subscriber.full_name ?? "Member"}
        otherPhotoUrl={subscriber.face_photo_url}
        recipientId={subscriberId}
      />
    </div>
  );
}
