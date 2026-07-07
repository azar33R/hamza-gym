"use client";

import { Gem } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";
import type { Tier } from "@/lib/constants";

const TIER_STYLES: Record<Tier, { wrap: string; icon: string; key: string }> = {
  iron: {
    wrap: "bg-zinc-700/40 text-zinc-300 border-zinc-600/50",
    icon: "text-zinc-300",
    key: "tier.iron",
  },
  bronze: {
    wrap: "bg-amber-900/30 text-amber-400 border-amber-700/50",
    icon: "text-amber-500",
    key: "tier.bronze",
  },
  gold: {
    wrap: "bg-yellow-500/15 text-yellow-300 border-yellow-500/40",
    icon: "text-yellow-400",
    key: "tier.gold",
  },
  diamond: {
    wrap: "bg-cyan-500/15 text-cyan-300 border-cyan-400/40",
    icon: "text-cyan-300",
    key: "tier.diamond",
  },
};

// Compact tier chip with a gem icon. Used on the dashboard header and
// leaderboard rows.
export function TierBadge({
  tier,
  className,
  showLabel = true,
}: {
  tier: Tier;
  className?: string;
  showLabel?: boolean;
}) {
  const { t } = useI18n();
  const s = TIER_STYLES[tier] ?? TIER_STYLES.iron;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        s.wrap,
        className
      )}
    >
      <Gem className={cn("h-3 w-3", s.icon)} />
      {showLabel && t(s.key)}
    </span>
  );
}
