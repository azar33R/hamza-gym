"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useOffline, useRelativeStaleness } from "@/lib/offline/context";

// Shown across the admin panel when offline. Makes the read-only contract
// explicit: cached data is viewable, but all write actions (approve payment,
// nudge, broadcast, activate, delete) are disabled until reconnection.
export function AdminOfflineReadonlyBanner() {
  const { t } = useI18n();
  const { isOnline, lastSyncedAt } = useOffline();
  const staleLabel = useRelativeStaleness(lastSyncedAt);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || isOnline) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-semibold">{t("admin.offline.banner")}</p>
        <p className="mt-0.5 text-xs text-amber-200/80">
          {t("admin.offline.readonly")}
        </p>
        {staleLabel && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-200/60">
            <Clock className="h-3 w-3" /> {t("admin.offline.stale_data", { stale: staleLabel })}
          </p>
        )}
      </div>
    </div>
  );
}
