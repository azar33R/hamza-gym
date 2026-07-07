import { MessageCircle } from "lucide-react";
import { ChatDirectory } from "@/components/subscriber/chat-directory";
import { fetchInbox } from "@/lib/chat-actions";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Subscriber chat home. Fetches all messageable contacts, then hands off to
// the client-side tabbed directory (Chats / Members / Staff).
export default async function ChatPage() {
  const t = await getT();

  // Determine membership: only active subscribers may browse other members.
  // Non-members (unpaid) can only reach staff + coaches + admin.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let isMember = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status")
      .eq("id", user.id)
      .single();
    isMember = profile?.subscription_status === "active";
  }

  const counterpartRoles = isMember
    ? (["admin", "staff", "subscriber"] as const)
    : (["admin", "staff"] as const);

  const { error, contacts } = await fetchInbox([...counterpartRoles]);

  if (error) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
            {t("nav.chat")}
          </h1>
        </header>
        <p className="rounded-xl border border-dashed border-border bg-card/40 p-6 text-center text-sm text-zinc-400">
          {t("chat.load_error")}: {error}
        </p>
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
            {t("nav.chat")}
          </h1>
        </header>
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <MessageCircle className="h-7 w-7" />
          </span>
          <h2 className="text-lg font-semibold text-zinc-50">{t("chat.no_one_here")}</h2>
          <p className="max-w-xs text-sm text-zinc-400">
            {t("chat.no_contacts_desc")}
          </p>
        </div>
      </div>
    );
  }

  return <ChatDirectory contacts={contacts} isMember={isMember} />;
}
