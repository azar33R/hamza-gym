"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, CreditCard, Megaphone, MessageCircle } from "lucide-react";
import type { Notification, NotificationType } from "@/lib/types";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notification-actions";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

function iconFor(type: NotificationType) {
  switch (type) {
    case "payment":
      return CreditCard;
    case "dm":
      return MessageCircle;
    case "nudge":
      return Bell;
    case "broadcast":
    default:
      return Megaphone;
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// Bell + dropdown for the admin top bar. `initial` notifications and
// `initialUnread` are passed from the server layout; the dropdown itself
// refreshes the route every ~20s so the badge stays current without realtime.
export function AdminNotificationBell({
  initial,
  initialUnread,
}: {
  initial: Notification[];
  initialUnread: number;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Light polling for a fresh unread badge.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 20000);
    return () => clearInterval(id);
  }, [router]);

  async function handleMarkAll() {
    startTransition(async () => {
      await markAllNotificationsRead();
      setOpen(false);
    });
  }

  async function handleOpen(n: Notification) {
    const link = n.link ?? "/admin/triage";
    startTransition(async () => {
      await markNotificationRead(n.id);
      setOpen(false);
      router.push(link);
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-50"
        aria-label={t("notif.aria")}
      >
        <Bell className="h-5 w-5" />
        {initialUnread > 0 && (
          <span className="absolute end-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {initialUnread > 9 ? "9+" : initialUnread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-zinc-50">{t("notif.title")}</p>
            {initialUnread > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                disabled={pending}
                className="text-[11px] font-medium text-primary hover:underline disabled:opacity-50"
              >
                {t("notif.mark_all_read")}
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {initial.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-zinc-500">
                {t("notif.no_notifications")}
              </p>
            ) : (
              initial.slice(0, 10).map((n) => {
                const Icon = iconFor(n.type);
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleOpen(n)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-start transition-colors hover:bg-zinc-800/40",
                      !n.is_read && "bg-primary/5"
                    )}
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-300">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-100">
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-zinc-400">
                          {n.body}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-zinc-600">
                        {relativeTime(n.created_at)}
                      </p>
                    </div>
                    {!n.is_read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          <Link
            href="/admin/triage"
            onClick={() => setOpen(false)}
            className="block border-t border-border px-4 py-2.5 text-center text-xs font-medium text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-100"
          >
            {t("notif.view_queue")}
          </Link>
        </div>
      )}
    </div>
  );
}
