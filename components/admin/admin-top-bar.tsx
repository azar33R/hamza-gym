"use client";

import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { AdminSignOutButton } from "@/components/admin/signout-button";
import { AdminNotificationBell } from "@/components/admin/admin-notification-bell";
import { useI18n } from "@/lib/i18n/client";
import type { Notification } from "@/lib/types";

// Slim admin top bar. On desktop the brand + identity live in the sidebar, so
// this only carries the page context and the global actions.
export function AdminTopBar({
  notifications,
  unreadCount,
}: {
  notifications: Notification[];
  unreadCount: number;
}) {
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex h-14 items-center justify-between gap-3 px-4 md:px-6">
        {/* Brand only shows on mobile, where the sidebar is hidden */}
        <Link href="/admin" className="flex items-center gap-2 md:hidden">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Dumbbell className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-semibold text-zinc-50">{t("app.name")}</span>
        </Link>
        <div className="hidden md:block" />

        <div className="flex items-center gap-1">
          <AdminNotificationBell initial={notifications} initialUnread={unreadCount} />
          <AdminSignOutButton />
        </div>
      </div>
    </header>
  );
}
