"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ChatContact } from "@/lib/chat-actions";
import { cn } from "@/lib/utils";

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatRelativeTime(
  iso: string | null,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return t("chat.just_now");
  if (diffMin < 60) return t("chat.minutes_ago", { n: diffMin });
  if (diffHour < 24) return t("chat.hours_ago", { n: diffHour });
  if (diffDay === 1) return t("chat.yesterday");
  if (diffDay < 7) return t("chat.days_ago", { n: diffDay });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ChatInbox({
  contacts,
  basePath,
}: {
  contacts: ChatContact[];
  basePath: string;
}) {
  const { t } = useI18n();

  if (contacts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-zinc-500">
        {t("chat.no_one_here")}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {contacts.map((c, i) => (
        <Link
          key={c.id}
          href={`${basePath}/${c.id}`}
          className={cn(
            "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-800/40",
            i > 0 && "border-t border-border",
          )}
        >
          <Avatar className="h-11 w-11 border border-border">
            <AvatarImage src={c.face_photo_url ?? undefined} />
            <AvatarFallback className="text-xs">
              {initials(c.full_name)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-zinc-50">
                {c.full_name?.trim() || t("chat.unknown")}
              </p>
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize",
                  c.role === "admin" || c.role === "staff"
                    ? "bg-primary/15 text-primary"
                    : "bg-zinc-800 text-zinc-400",
                )}
              >
                {c.role}
              </span>
              {c.last_at && (
                <span className="ms-auto shrink-0 text-[11px] text-zinc-500">
                  {formatRelativeTime(c.last_at, t)}
                </span>
              )}
            </div>

            <p
              className={cn(
                "truncate text-xs",
                c.unread > 0 ? "text-zinc-200" : "text-zinc-500",
              )}
            >
              {c.last_message ?? t("chat.no_messages_hint")}
            </p>
          </div>

          {c.unread > 0 && (
            <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
              {c.unread}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
