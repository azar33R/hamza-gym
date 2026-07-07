"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { CROWD_LEVELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useOffline, useRelativeStaleness } from "@/lib/offline/context";
import { getCrowd, setCrowd } from "@/lib/offline/db";

type Level = "green" | "yellow" | "red";

function levelFor(count: number): Level {
  if (count <= CROWD_LEVELS.LOW_MAX) return "green";
  if (count <= CROWD_LEVELS.MED_MAX) return "yellow";
  return "red";
}

export function CrowdMeter({ activeCount }: { activeCount: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const { isOnline } = useOffline();
  const [staleAt, setStaleAt] = useState<string | null>(null);
  const staleLabel = useRelativeStaleness(staleAt);

  const LEVEL_STYLES: Record<Level, { dot: string; wrap: string; label: string }> = {
    green: {
      dot: "bg-emerald-500",
      wrap: "border-emerald-500/30 bg-emerald-500/10",
      label: t("crowd.not_busy"),
    },
    yellow: {
      dot: "bg-yellow-500",
      wrap: "border-yellow-500/30 bg-yellow-500/10",
      label: t("crowd.moderate"),
    },
    red: {
      dot: "bg-red-500",
      wrap: "border-red-500/30 bg-red-500/10",
      label: t("crowd.very_busy"),
    },
  };

  useEffect(() => {
    if (isOnline && typeof activeCount === "number") {
      setCrowd({ count: activeCount, fetchedAt: new Date().toISOString() }).catch(() => {});
    }
  }, [activeCount, isOnline]);

  useEffect(() => {
    if (!isOnline) {
      getCrowd()
        .then((c) => setStaleAt(c?.fetchedAt ?? null))
        .catch(() => setStaleAt(null));
    } else {
      setStaleAt(null);
    }
  }, [isOnline]);

  useEffect(() => {
    if (!isOnline) return;
    const id = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(id);
  }, [router, isOnline]);

  const level = levelFor(activeCount);
  const s = LEVEL_STYLES[level];

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1.5",
        s.wrap
      )}
    >
      <span className="relative flex h-2 w-2">
        {isOnline && (
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", s.dot)} />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", s.dot)} />
      </span>
      <span className="text-xs font-medium text-zinc-200">
        {isOnline ? t("crowd.title") : t("crowd.offline_title")}
      </span>
      <span className="flex items-center gap-1 text-xs text-zinc-400">
        <Users className="h-3 w-3" />
        {activeCount}
      </span>
      {isOnline ? (
        <span className="text-xs font-semibold text-zinc-100">{s.label}</span>
      ) : (
        <span className="text-xs text-zinc-500">
          {staleLabel ? t("crowd.updated", { time: staleLabel }) : t("crowd.offline")}
        </span>
      )}
    </div>
  );
}
