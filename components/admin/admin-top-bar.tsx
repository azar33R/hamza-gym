"use client";

import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { AdminSignOutButton } from "@/components/admin/signout-button";
import { AdminNotificationBell } from "@/components/admin/admin-notification-bell";
import { useI18n } from "@/lib/i18n/client";
import type { Notification, UserRole } from "@/lib/types";

// Sticky top bar for the admin shell: brand on the left, notifications + sign-out on the right.
export function AdminTopBar({
  coachName,
  role,
  notifications,
  unreadCount,
}: {
  coachName: string | null;
  role: UserRole;
  notifications: Notification[];
  unreadCount: number;
}) {
  const { t } = useI18n();
  const roleLabel = role === "admin" ? t("role.admin") : t("role.staff");
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/admin" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Dumbbell className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-zinc-50">{t("app.name")}</p>
            <p className="text-[11px] text-zinc-400">
              {coachName ? `${roleLabel} ${coachName}` : roleLabel}
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-1">
          <AdminNotificationBell
            initial={notifications}
            initialUnread={unreadCount}
          />
          <AdminSignOutButton />
        </div>
      </div>
    </header>
  );
}
