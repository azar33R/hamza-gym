"use client";

import { Loader2, CloudOff, CloudUpload, RefreshCw } from "lucide-react";
import { useOffline } from "@/lib/offline/context";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

// Floating status pill rather than a full-width slab: it sits ABOVE the bottom
// nav (which is a floating pill on mobile) so it never covers navigation, and
// uses a muted surface with a coloured accent instead of a saturated fill that
// fought the dark theme.
export function OfflineBanner({
  showOffline = true,
}: {
  /**
   * The admin panel already renders an inline read-only notice while offline, so
   * it passes showOffline={false} to avoid saying the same thing twice — the
   * pill then appears only for queued/syncing work, which is the admin's blind
   * spot (members added offline replay silently).
   */
  showOffline?: boolean;
}) {
  const { t } = useI18n();
  const { isOnline, isSyncing, pendingCount, syncNow } = useOffline();

  if (isOnline && pendingCount === 0) return null;
  if (!isOnline && !showOffline) return null;

  const offline = !isOnline;
  const spinning = isSyncing;

  const text = offline
    ? pendingCount > 0
      ? t(
          pendingCount === 1
            ? "offline.banner_offline_changes"
            : "offline.banner_offline_changes_plural",
          { n: pendingCount }
        )
      : t("offline.banner_offline")
    : spinning
      ? t("offline.syncing", { n: pendingCount })
      : t(
          pendingCount === 1
            ? "offline.queued"
            : "offline.queued_plural",
          { n: pendingCount }
        );

  const Icon = offline ? CloudOff : spinning ? Loader2 : CloudUpload;
  const canRetry = !offline && !spinning && pendingCount > 0;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)",
      }}
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          "pointer-events-auto flex max-w-full items-center gap-2.5 rounded-full border py-2 pe-2 ps-3 shadow-lg",
          "bg-zinc-900/95 backdrop-blur supports-[backdrop-filter]:bg-zinc-900/80",
          offline ? "border-amber-500/40" : "border-primary/40"
        )}
      >
        <span
          className={cn(
            "relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
            offline ? "bg-amber-500/15 text-amber-300" : "bg-primary/15 text-primary"
          )}
        >
          <Icon className={cn("h-3.5 w-3.5", spinning && "animate-spin")} />
          {offline && (
            <span className="absolute -end-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            </span>
          )}
        </span>

        <span
          className={cn(
            "truncate text-[13px] font-medium",
            offline ? "text-amber-100" : "text-zinc-100"
          )}
        >
          {text}
        </span>

        {canRetry && (
          <button
            type="button"
            onClick={() => syncNow()}
            className="flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-primary/15 px-2.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/25 active:scale-95"
          >
            <RefreshCw className="h-3 w-3" />
            {t("offline.try_again")}
          </button>
        )}
      </div>
    </div>
  );
}
