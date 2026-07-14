"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { toast } from "sonner";
import { Send, WifiOff, ImagePlus, Check, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendMessage } from "@/lib/chat-actions";
import { uploadChatPhoto } from "@/lib/storage";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useOffline } from "@/lib/offline/context";
import { queueSendMessage } from "@/lib/offline/queue";
import { setThread } from "@/lib/offline/db";

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function ChatThread({
  messages: serverMessages,
  currentUserId,
  otherName,
  otherPhotoUrl,
  recipientId,
}: {
  messages: ChatMessage[];
  currentUserId: string;
  otherName: string;
  otherPhotoUrl?: string | null;
  recipientId: string;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const { isOnline } = useOffline();
  const [text, setText] = useState("");
  const [pendingImage, setPendingImage] = useState<{ url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);

  const [optimistic, setOptimistic] = useState<
    { tempId: string; body: string; image_url?: string | null; created_at: string; queued?: boolean }[]
  >([]);

  const displayMessages: (ChatMessage & { _queued?: boolean })[] = [
    ...serverMessages,
    ...optimistic.map((m) => ({
      id: m.tempId,
      sender_id: currentUserId,
      recipient_id: recipientId,
      body: m.body,
      image_url: m.image_url ?? null,
      read_at: null,
      created_at: m.created_at,
      _queued: m.queued,
    })),
  ];

  useEffect(() => {
    if (optimistic.length === 0) return;
    const bodies = new Set(
      serverMessages
        .filter((m) => m.sender_id === currentUserId)
        .map((m) => m.body)
    );
    setOptimistic((prev) => prev.filter((m) => !bodies.has(m.body)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverMessages, currentUserId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [displayMessages.length]);

  useEffect(() => {
    if (!isOnline) return;
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [router, isOnline]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!isOnline) {
      toast.error(t("chat.photo_needs_online"));
      return;
    }
    setUploading(true);
    const res = await uploadChatPhoto(file);
    setUploading(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setPendingImage({ url: res.url! });
  }

  const send = useCallback(
    async (imageUrl?: string | null) => {
      const body = text.trim();
      if ((!body && !imageUrl) || sendingRef.current) return;
      sendingRef.current = true;
      setText("");
      if (imageUrl) setPendingImage(null);

      const tempId = `opt-${Date.now()}`;
      const createdAt = new Date().toISOString();

      if (isOnline) {
        setOptimistic((prev) => [
          ...prev,
          { tempId, body, image_url: imageUrl ?? null, created_at: createdAt },
        ]);

        const res = await sendMessage(recipientId, body, imageUrl);
        if (res.error) {
          toast.error(res.error);
          setOptimistic((prev) => prev.filter((m) => m.tempId !== tempId));
          setText(body);
          if (imageUrl) setPendingImage({ url: imageUrl });
        }
        router.refresh();
      } else {
        setOptimistic((prev) => [
          ...prev,
          { tempId, body, image_url: imageUrl ?? null, created_at: createdAt, queued: true },
        ]);
        await queueSendMessage(recipientId, body);
        setThread({
          otherUserId: recipientId,
          messages: [
            ...(serverMessages ?? []),
            {
              id: tempId,
              sender_id: currentUserId,
              recipient_id: recipientId,
              body,
              image_url: imageUrl ?? null,
              read_at: null,
              created_at: createdAt,
            },
          ],
          fetchedAt: createdAt,
        }).catch(() => {});
      }
      sendingRef.current = false;
    },
    [text, recipientId, router, isOnline, serverMessages, currentUserId]
  );

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const canSend = !!text.trim() || !!pendingImage;

  return (
    <div className="flex h-[calc(100dvh-9rem)] flex-col">
      <div className="flex items-center gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur">
        <Avatar className="h-10 w-10 border border-border">
          <AvatarImage src={otherPhotoUrl ?? undefined} />
          <AvatarFallback className="text-xs">
            {initials(otherName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-50">
            {otherName}
          </p>
          <p className="text-[11px] text-zinc-500">
            {serverMessages.length === 0
              ? t("chat.no_messages")
              : t("chat.direct_message")}
          </p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-2 overflow-y-auto px-4 py-4"
      >
        {displayMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-zinc-500">
            <p>{t("chat.no_messages")}</p>
            <p>{t("chat.say_hello")}</p>
          </div>
        ) : (
          displayMessages.map((m) => {
            const mine = m.sender_id === currentUserId;
            const isOptimistic = m.id.startsWith("opt-");
            return (
              <div
                key={m.id}
                className={cn(
                  "flex flex-col",
                  mine ? "items-end" : "items-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm",
                    mine
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md bg-zinc-800 text-zinc-100",
                    isOptimistic && "opacity-70",
                  )}
                >
                  {m.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.image_url}
                      alt=""
                      className="mb-1 max-h-64 w-full rounded-lg object-cover"
                    />
                  )}
                  {m.body}
                </div>
                <span className="mt-0.5 px-1 text-[10px] text-zinc-600">
                  {formatTime(m.created_at)}
                  {mine && (
                    m.read_at
                      ? ` · ${t("chat.read")}`
                      : isOptimistic
                        ? m._queued
                          ? ` · ${t("chat.pending")}`
                          : ` · ${t("chat.sending")}`
                        : ` · ${t("chat.sent")}`
                  )}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-border bg-card/80 p-3 backdrop-blur">
        {/* Pending photo preview with its own save button */}
        {pendingImage && (
          <div className="mb-2 flex items-center gap-3 rounded-xl border border-border bg-zinc-900 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pendingImage.url}
              alt=""
              className="h-16 w-16 rounded-lg object-cover"
            />
            <span className="flex-1 text-xs text-zinc-400">{t("chat.photo_ready")}</span>
            <Button
              size="icon"
              className="h-9 w-9"
              onClick={() => send(pendingImage.url)}
              disabled={uploading}
              aria-label={t("chat.save_photo")}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 text-zinc-400"
              onClick={() => setPendingImage(null)}
              aria-label={t("common.cancel")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-11 w-11 shrink-0 text-zinc-400"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label={t("chat.attach_photo")}
          >
            <ImagePlus className="h-4 w-4" />
          </Button>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder={t("chat.type_message")}
            rows={1}
            maxLength={1000}
            className="max-h-32 min-h-[2.75rem] resize-none"
          />
          <Button
            onClick={() => send()}
            disabled={!canSend || uploading}
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label={t("chat.send")}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-1 px-1 text-[10px] text-zinc-600">
          {!isOnline ? (
            <span className="flex items-center gap-1 text-amber-500">
              <WifiOff className="h-3 w-3" /> {t("chat.offline_will_send")}
            </span>
          ) : uploading ? (
            t("chat.uploading")
          ) : (
            t("chat.enter_send")
          )}
        </p>
      </div>
    </div>
  );
}
