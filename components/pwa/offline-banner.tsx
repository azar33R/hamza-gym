"use client";

import { Loader2, CloudOff, CloudUpload } from "lucide-react";
import { useOffline } from "@/lib/offline/context";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export function OfflineBanner() {
  const { t } = useI18n();
  const { isOnline, isSyncing, pendingCount } = useOffline();

  if (isOnline && pendingCount === 0) return null;

  let icon: React.ReactNode;
  let text: string;
  let className: string;

  if (!isOnline) {
    icon = <CloudOff className="h-3.5 w-3.5" />;
    text = pendingCount > 0
      ? t(pendingCount === 1 ? "offline.banner_offline_changes" : "offline.banner_offline_changes_plural", { n: pendingCount })
      : t("offline.banner_offline");
    className = "bg-amber-500 text-amber-950";
  } else {
    icon = isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5" />;
    text = isSyncing
      ? t("offline.syncing", { n: pendingCount })
      : t(pendingCount === 1 ? "offline.queued" : "offline.queued_plural", { n: pendingCount });
    className = "bg-primary text-primary-foreground";
  }

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-[60] flex items-center justify-center gap-2 px-4 py-2 text-center text-xs font-medium shadow-lg",
        className
      )}
      role="status"
      aria-live="polite"
    >
      {icon}
      <span>{text}</span>
    </div>
  );
}
