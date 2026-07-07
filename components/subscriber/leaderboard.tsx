"use client";

import { useState } from "react";
import { Crown, Medal, Award, Flame, Scale, Dumbbell, BadgeCheck, CircleCheckBig } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { TierBadge } from "@/components/subscriber/tier-badge";
import type { LeaderboardMode, LeaderboardRow } from "@/lib/leaderboard";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";
import { useOffline, useRelativeStaleness } from "@/lib/offline/context";

function initials(name: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatValue(mode: LeaderboardMode, value: number): string {
  if (mode === "points") return `${value.toLocaleString()}`;
  if (mode === "ratio") return `${value}×`;
  return `${value} kg`;
}

// Podium for the top 3. Order is 2nd (left), 1st (center, tallest), 3rd (right).
function Podium({ rows, mode }: { rows: LeaderboardRow[]; mode: LeaderboardMode }) {
  const [second, first, third] = [rows[1], rows[0], rows[2]];
  const slots = [
    { row: second, rank: 2, wrap: "order-1 h-28", ring: "border-zinc-400/50", tint: "from-zinc-400/20" },
    { row: first, rank: 1, wrap: "order-2 h-36", ring: "border-yellow-400/60", tint: "from-yellow-400/25" },
    { row: third, rank: 3, wrap: "order-3 h-24", ring: "border-amber-700/60", tint: "from-amber-700/20" },
  ];

  return (
    <div className="mb-6 flex items-end justify-center gap-3">
      {slots.map((slot) => {
        if (!slot.row) return <div key={slot.rank} className={cn("flex-1", slot.wrap)} />;
        const Icon = slot.rank === 1 ? Crown : slot.rank === 2 ? Medal : Award;
        return (
          <div key={slot.rank} className={cn("flex flex-1 flex-col items-center justify-end", slot.wrap)}>
            {slot.rank === 1 && (
              <Crown className="mb-1 h-6 w-6 text-yellow-400" />
            )}
            <Avatar className={cn("h-14 w-14 border-2", slot.ring)}>
              <AvatarImage src={slot.row.face_photo_url ?? undefined} />
              <AvatarFallback>{initials(slot.row.full_name)}</AvatarFallback>
            </Avatar>
            <p className="mt-1.5 max-w-full truncate text-center text-xs font-semibold text-zinc-50">
              {slot.row.full_name ?? "Unknown"}
            </p>
            <div
              className={cn(
                "mt-1 flex w-full flex-col items-center justify-end rounded-t-lg border bg-gradient-to-b to-card pb-2 pt-6",
                slot.ring,
                slot.tint
              )}
            >
              <Icon className={cn("h-4 w-4", slot.rank === 1 ? "text-yellow-400" : slot.rank === 2 ? "text-zinc-300" : "text-amber-600")} />
              <span className="mt-0.5 font-mono text-sm font-bold text-zinc-50">
                {formatValue(mode, slot.row.value)}
              </span>
              <span className="mt-1 flex items-center gap-1">
                <TierBadge tier={slot.row.tier} showLabel={false} className="scale-90" />
                {mode !== "points" && <VerifiedBadge />}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VerifiedBadge() {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400">
        <CircleCheckBig className="h-2.5 w-2.5" /> {t("leaderboard.verified")}
      </span>
  );
}

function RankedRow({
  row,
  rank,
  mode,
  isYou,
}: {
  row: LeaderboardRow;
  rank: number;
  mode: LeaderboardMode;
  isYou: boolean;
}) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2.5",
        isYou ? "border-primary/50 bg-primary/10" : "border-border bg-card"
      )}
    >
      <span className="w-6 text-center font-mono text-sm font-semibold text-zinc-400">
        {rank}
      </span>
      <Avatar className="h-9 w-9">
        <AvatarImage src={row.face_photo_url ?? undefined} />
        <AvatarFallback className="text-xs">{initials(row.full_name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-50">
          {row.full_name ?? "Unknown"}
          {isYou && <span className="ms-1.5 text-xs text-primary">{t("leaderboard.you")}</span>}
        </p>
        <span className="mt-0.5 flex items-center gap-1.5">
          <TierBadge tier={row.tier} className="scale-90" />
          {mode !== "points" && <VerifiedBadge />}
        </span>
      </div>
      <span className="font-mono text-sm font-bold text-primary">
        {formatValue(mode, row.value)}
      </span>
    </div>
  );
}

export function Leaderboard({
  currentUserId,
  points,
  ratio,
  weight,
}: {
  currentUserId: string;
  points: LeaderboardRow[];
  ratio: LeaderboardRow[];
  weight: LeaderboardRow[];
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<LeaderboardMode>("points");
  const { isOnline, lastSyncedAt } = useOffline();
  const staleLabel = useRelativeStaleness(lastSyncedAt);

  const triggers: { value: LeaderboardMode; label: string; labelShort: string; icon: typeof Flame }[] = [
    { value: "points", label: t("leaderboard.points"), labelShort: t("leaderboard.points_short"), icon: Flame },
    { value: "ratio", label: t("leaderboard.ratio"), labelShort: t("leaderboard.ratio_short"), icon: Scale },
    { value: "weight", label: t("leaderboard.weight"), labelShort: t("leaderboard.weight_short"), icon: Dumbbell },
  ];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-50">
           <Crown className="h-6 w-6 text-yellow-400" /> {t("leaderboard.title")}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {t("leaderboard.desc")}
        </p>
        {!isOnline && staleLabel && (
          <p className="mt-1 text-xs text-amber-500/80">
            {t("leaderboard.offline", { stale: staleLabel })}
          </p>
        )}
      </header>

      <Tabs value={mode} onValueChange={(v) => setMode(v as LeaderboardMode)}>
        <TabsList className="w-full">
          {triggers.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
              <tab.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.labelShort}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {triggers.map((tab) => {
          const rows = tab.value === "points" ? points : tab.value === "ratio" ? ratio : weight;
          const top3 = rows.slice(0, 3);
          const rest = rows.slice(3);
          return (
            <TabsContent key={tab.value} value={tab.value} className="mt-4 space-y-2">
              {rows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-zinc-400">
                  {tab.value === "points"
                    ? t("leaderboard.no_points")
                    : tab.value === "ratio"
                    ? t("leaderboard.no_ratio")
                    : t("leaderboard.no_weight")}
                </div>
              ) : (
                <>
                  {top3.length >= 2 && <Podium rows={top3} mode={tab.value} />}
                  {rest.map((row, i) => (
                    <RankedRow
                      key={row.user_id}
                      row={row}
                      rank={i + 4}
                      mode={tab.value}
                      isYou={row.user_id === currentUserId}
                    />
                  ))}
                  {/* If the current user isn't in the list, pin them at the bottom. */}
                  {!rows.some((r) => r.user_id === currentUserId) && (
                    <p className="pt-2 text-center text-xs text-zinc-500">
                      {t("leaderboard.not_ranked")}
                    </p>
                  )}
                </>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
