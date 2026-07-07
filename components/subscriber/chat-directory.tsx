"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { MessageCircle, Users, Shield } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ChatInbox } from "@/components/subscriber/chat-inbox";
import type { ChatContact } from "@/lib/chat-actions";
import { useOffline } from "@/lib/offline/context";

export function ChatDirectory({
  contacts,
  isMember,
}: {
  contacts: ChatContact[];
  isMember: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const { isOnline } = useOffline();

  useEffect(() => {
    if (!isOnline) return;
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [router, isOnline]);

  const currentChats = contacts
    .filter((c) => c.last_at !== null)
    .sort((a, b) => (b.last_at ?? "").localeCompare(a.last_at ?? ""));

  const members = contacts
    .filter((c) => c.role === "subscriber" && c.last_at === null)
    .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));

  const staff = contacts
    .filter((c) => (c.role === "admin" || c.role === "staff") && c.last_at === null)
    .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));

  const totalUnread = contacts.reduce((n, c) => n + c.unread, 0);

  const tabs = [
    { value: "chats", label: t("chat.tabs.chats"), icon: MessageCircle, count: currentChats.length },
    ...(isMember
      ? [{ value: "members", label: t("chat.tabs.members"), icon: Users, count: members.length }]
      : []),
    { value: "staff", label: t("chat.tabs.staff"), icon: Shield, count: staff.length },
  ] as const;

  return (
    <div className="space-y-4">
      <header>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
            {t("chat.messages")}
          </h1>
          {totalUnread > 0 && (
            <span className="text-sm font-medium text-primary">
              {t("chat.unread_count", { n: totalUnread })}
            </span>
          )}
        </div>
        <p className="text-sm text-zinc-400">
          {t("chat.subtitle")}
        </p>
      </header>

      <Tabs defaultValue="chats">
        <TabsList className="w-full">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="gap-1.5 flex-1"
            >
              <tab.icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              <span className="text-[10px] text-zinc-500">
                {tab.count}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="chats" className="mt-4 space-y-3">
          {currentChats.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-10 text-center text-sm text-zinc-500">
              {t("chat.no_conversations")}
            </div>
          ) : (
            <ChatInbox contacts={currentChats} basePath="/chat" />
          )}
        </TabsContent>

        {isMember && (
          <TabsContent value="members" className="mt-4 space-y-3">
            <ChatInbox contacts={members} basePath="/chat" />
          </TabsContent>
        )}

        <TabsContent value="staff" className="mt-4 space-y-3">
          <ChatInbox contacts={staff} basePath="/chat" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
