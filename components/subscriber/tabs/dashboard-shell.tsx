"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CheckCircle2,
  Dumbbell,
  Flame,
  CalendarDays,
  Megaphone,
  Timer,
  ChevronRight,
  Gem,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { CrowdMeter } from "@/components/subscriber/crowd-meter";
import { TierBadge } from "@/components/subscriber/tier-badge";
import { CheckInMerged } from "@/components/subscriber/check-in-merged";
import { CheckInTrigger } from "@/components/subscriber/check-in-trigger";
import { cn } from "@/lib/utils";
import { tierFloor, nextTier, POINT_REWARDS, bannerGradient } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/client";
import type { DashboardData } from "@/app/(subscriber)/tab-actions";
import type { Tier } from "@/lib/types";
import { CheckInModal } from "@/components/subscriber/check-in-modal";
import { MapPin } from "lucide-react";

const TIER_GRADIENT: Record<string, string> = {
  iron: "from-zinc-500 to-amber-500",
  bronze: "from-amber-600 to-yellow-400",
  gold: "from-yellow-500 to-cyan-400",
  diamond: "from-cyan-400 to-lime-400",
};

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hrs = Math.floor(diff / (1000 * 60 * 60));
  if (hrs < 1) return "just now";
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export function DashboardShell({
  data,
  userId,
}: {
  data: DashboardData;
  userId: string;
}) {
  const { t } = useI18n();
  const [pinOpen, setPinOpen] = useState(false);
  const {
    profile,
    points,
    tier,
    pct,
    up,
    streak,
    workoutsThisWeek,
    lastWorkoutLabel,
    checkedInToday,
    liveCount,
    workoutCompletedToday,
    completedTemplateName,
    todaySession,
    announcement,
    equippedNickname,
    equippedBannerKey,
    daysLeft,
    planLabel,
    subscription,
  } = data;

  const bannerClass = bannerGradient(equippedBannerKey);

  return (
    <div className="space-y-5">
      <header
        className={cn(
          "relative overflow-hidden rounded-2xl border border-white/5 p-4",
          bannerClass
            ? `bg-gradient-to-br ${bannerClass} via-zinc-900/80 to-zinc-950`
            : "bg-zinc-900/60"
        )}
      >
        <div className="relative flex items-center gap-4">
          <Avatar className="h-20 w-20 border-2 border-white/30 shadow-lg">
            <AvatarImage src={profile?.face_photo_url ?? undefined} />
            <AvatarFallback className="text-2xl">
              {initials(profile?.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-300/80">
              {t("dashboard.welcome_back")}
            </p>
            <h1 className="mt-0.5 truncate text-xl font-extrabold text-zinc-50">
              {profile?.full_name ?? t("common.athlete")}
            </h1>
            {equippedNickname && (
              <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-zinc-100/90">
                &ldquo;{equippedNickname}&rdquo;
              </p>
            )}
            <div className="mt-2 flex items-center gap-2">
              <TierBadge tier={tier} />
            </div>
          </div>
          <div className="flex flex-col items-end text-end">
            <span className="flex items-center gap-1 text-2xl font-black text-primary">
              <Flame className="h-5 w-5" />
              {streak}
            </span>
            <span className="text-[11px] font-medium text-zinc-400">
              {t("dashboard.day_streak")}
            </span>
          </div>
        </div>
      </header>

      <CrowdMeter activeCount={liveCount} />

      <section className="rounded-2xl border border-white/5 bg-zinc-900/60 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Megaphone className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              {t("dashboard.announcement")}
            </p>
            {announcement ? (
              <>
                <p className="mt-0.5 truncate text-sm font-semibold text-zinc-100">
                  {announcement.title}
                </p>
                {announcement.body && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-zinc-400">
                    {announcement.body}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-zinc-600">
                  {relativeTime(announcement.created_at)}
                </p>
              </>
            ) : (
              <p className="mt-0.5 text-sm text-zinc-500">
                {t("dashboard.no_announcements")}
              </p>
            )}
          </div>
        </div>
      </section>

      <section
        className={cn(
          "overflow-hidden rounded-3xl p-5",
          workoutCompletedToday
            ? "bg-gradient-to-br from-emerald-500/15 via-zinc-900 to-zinc-950"
            : checkedInToday
            ? "bg-gradient-to-br from-primary/15 via-zinc-900 to-zinc-950"
            : "bg-zinc-900/60"
        )}
      >
        {workoutCompletedToday ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
              <CheckCircle2 className="h-7 w-7 text-emerald-400" />
            </span>
            <h2 className="text-xl font-bold text-zinc-50">{t("dashboard.workout_complete")}</h2>
            {completedTemplateName && (
              <p className="text-sm text-zinc-400">{completedTemplateName}</p>
            )}
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
              <Flame className="h-3 w-3" /> {t("dashboard.points_earned", { n: POINT_REWARDS.WORKOUT_COMPLETE })}
            </span>
            <p className="text-sm text-zinc-500">{t("dashboard.great_work")}</p>
          </div>
        ) : checkedInToday ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
                <CheckCircle2 className="h-4 w-4" /> {t("dashboard.checked_in")}
              </span>
              <span className="text-xs text-zinc-400">{t("dashboard.todays_session")}</span>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                {t("dashboard.todays_target")}
              </p>
              <h2 className="mt-1 flex items-center gap-2 text-2xl font-bold text-zinc-50">
                <CalendarDays className="h-5 w-5 text-primary" />
                {todaySession?.name ?? t("dashboard.free_workout")}
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                {todaySession
                  ? t("dashboard.exercises_queued", { n: todaySession.exerciseCount })
                  : t("dashboard.no_routine")}
              </p>
            </div>
            <Button asChild size="lg" className="w-full gap-2 py-6 text-base">
              <Link href="/workout">
                <Dumbbell className="h-5 w-5" /> {t("dashboard.start_workout")}
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-lime-500/30">
                <MapPin className="h-7 w-7" />
              </span>
              <div>
                <p className="font-semibold text-zinc-50">{t("dashboard.ready_to_train")}</p>
                <p className="text-sm text-zinc-400">{t("dashboard.check_in_unlock")}</p>
              </div>
              <Button
                size="lg"
                onClick={() => setPinOpen(true)}
                className="mt-1 w-full py-6 text-base"
              >
                {t("dashboard.im_at_gym")}
              </Button>
              <CheckInModal
                open={pinOpen}
                onOpenChange={setPinOpen}
                onSuccess={() => {}}
              />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/5 bg-black/20 p-3">
                <CalendarDays className="h-4 w-4 text-primary" />
                <p className="mt-1.5 text-xl font-extrabold text-zinc-50">{workoutsThisWeek}</p>
                <p className="text-[10px] text-zinc-500">{t("dashboard.workouts_this_week")}</p>
              </div>
              <div className="rounded-xl border border-white/5 bg-black/20 p-3">
                <Dumbbell className="h-4 w-4 text-primary" />
                <p className="mt-1.5 text-xl font-extrabold text-zinc-50">{lastWorkoutLabel}</p>
                <p className="text-[10px] text-zinc-500">{t("dashboard.last_workout")}</p>
              </div>
            </div>
          </>
        )}

        {(workoutCompletedToday || checkedInToday) && (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/5 bg-black/20 p-3">
              <CalendarDays className="h-4 w-4 text-primary" />
              <p className="mt-1.5 text-xl font-extrabold text-zinc-50">{workoutsThisWeek}</p>
              <p className="text-[10px] text-zinc-500">workouts this week</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-black/20 p-3">
              <Dumbbell className="h-4 w-4 text-primary" />
              <p className="mt-1.5 text-xl font-extrabold text-zinc-50">{lastWorkoutLabel}</p>
              <p className="text-[10px] text-zinc-500">last workout</p>
            </div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <span className="flex items-center gap-2 text-2xl font-black text-zinc-50">
              <Gem className="h-5 w-5 text-primary" />
              {points.toLocaleString()}
            </span>
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              {t("dashboard.points_balance")}
            </p>
          </div>
          {up ? (
            <div className="text-end">
              <p className="text-lg font-bold text-zinc-50">{up.xp - points}</p>
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                {t("dashboard.to_tier", { tier: up.tier })}
              </p>
            </div>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" /> {t("tier.max_tier")}
            </span>
          )}
        </div>

        <div className="relative">
          <div className="flex justify-between px-0.5 pb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
            <span className="capitalize">{tier}</span>
            {up && <span className="capitalize">{up.tier}</span>}
          </div>
          <div className="relative h-5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className={cn(
                "h-full rounded-full bg-gradient-to-r transition-all duration-1000 ease-out",
                TIER_GRADIENT[tier]
              )}
              style={{ width: `${Math.min(100, Math.max(3, pct))}%` }}
            />
            <div
              className="absolute inset-y-0 end-0 flex items-center pe-2 text-[10px] font-bold text-zinc-600"
              style={{ display: up && pct < 50 ? "none" : "flex" }}
            >
              {pct}%
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <Button asChild variant="secondary" className="gap-1.5 py-5">
            <Link href="/cosmetics">
              <Sparkles className="h-4 w-4" /> {t("dashboard.cosmetics")}
            </Link>
          </Button>
          <Button asChild variant="secondary" className="gap-1.5 py-5">
            <Link href="/shop">
              <ShoppingBag className="h-4 w-4" /> {t("dashboard.pro_shop")}
            </Link>
          </Button>
        </div>
      </section>

      {subscription && daysLeft !== null && (
        <section className="flex items-center gap-3 rounded-2xl border border-white/5 bg-zinc-900/60 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Timer className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-zinc-100">
              {daysLeft === 1 ? t("dashboard.day_left", { n: daysLeft }) : t("dashboard.days_left", { n: daysLeft })}
            </p>
            <p className="text-[11px] capitalize text-zinc-500">
              {t("dashboard.plan_label", { plan: planLabel ?? "" })}
            </p>
          </div>
          <Link
            href="/billing"
            className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
          >
            {t("dashboard.manage")} <ChevronRight className="h-3 w-3" />
          </Link>
        </section>
      )}
    </div>
  );
}
