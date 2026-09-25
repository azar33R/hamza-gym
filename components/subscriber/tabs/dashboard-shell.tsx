"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CheckCircle2,
  Dumbbell,
  Flame,
  Gem,
  RefreshCw,
  Megaphone,
  MapPin,
  ShoppingBag,
} from "lucide-react";
import { TierBadge } from "@/components/subscriber/tier-badge";
import { SubscriptionArc } from "@/components/subscriber/subscription-arc";
import { CheckInModal } from "@/components/subscriber/check-in-modal";
import { useI18n } from "@/lib/i18n/client";
import { isArabicLocale } from "@/lib/arabic-days";
import type { DashboardData } from "@/app/(subscriber)/tab-actions";

function totalDaysOf(sub: DashboardData["subscription"]): number | null {
  if (!sub?.start_date || !sub?.end_date) return null;
  const s = new Date(`${sub.start_date}T00:00:00`).getTime();
  const e = new Date(`${sub.end_date}T00:00:00`).getTime();
  if (isNaN(s) || isNaN(e) || e <= s) return null;
  return Math.max(1, Math.round((e - s) / 86_400_000));
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function DashboardShell({ data }: { data: DashboardData; userId: string }) {
  const { t, locale } = useI18n();
  const ar = isArabicLocale(locale);
  const [pinOpen, setPinOpen] = useState(false);

  const {
    profile,
    points,
    tier,
    daysLeft,
    subscription,
    checkedInToday,
    workoutCompletedToday,
    completedTemplateName,
    announcement,
    streak,
  } = data;

  const total = totalDaysOf(subscription);
  const fraction =
    total && daysLeft !== null ? daysLeft / total : daysLeft !== null ? Math.min(1, daysLeft / 30) : 0;

  const endDateLabel = subscription?.end_date
    ? new Date(`${subscription.end_date}T00:00:00`).toLocaleDateString(
        ar ? "ar-EG" : "en-US",
        { day: "numeric", month: "long", year: "numeric" }
      )
    : null;

  // Arabic plural agreement under the big number: 3–10 → "أيام متبقية",
  // everything else (1, 2, 11+) → "يوم متبقي".
  const daysWord = !ar
    ? daysLeft === 1
      ? t("home.day_left_one")
      : t("home.days_remaining")
    : daysLeft !== null && daysLeft >= 3 && daysLeft <= 10
      ? t("home.days_remaining_plural")
      : t("home.days_remaining");

  return (
    <div className="space-y-4 pb-6">
      {/* Profile header */}
      <header className="flex items-center gap-3 rounded-2xl border border-white/5 bg-zinc-900/60 p-3">
        <Avatar className="h-14 w-14 shrink-0 border-2 border-lime-400/60 shadow-lg">
          <AvatarImage src={profile?.face_photo_url ?? undefined} />
          <AvatarFallback className="text-lg font-bold">
            {initials(profile?.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            {t("dashboard.welcome_back")}
          </p>
          <h2 className="truncate text-lg font-extrabold leading-tight text-zinc-50">
            {profile?.full_name ?? t("common.athlete")}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <TierBadge tier={tier} />
            <span className="inline-flex items-center gap-1 rounded-full bg-lime-400/10 px-2 py-0.5 text-[11px] font-bold text-lime-400">
              <Gem className="h-3 w-3" />
              {points.toLocaleString()}
            </span>
          </div>
        </div>
        {streak > 0 && (
          <span className="flex shrink-0 flex-col items-end">
            <span className="flex items-center gap-1 text-xl font-black text-lime-400">
              <Flame className="h-4 w-4" />
              {streak}
            </span>
            <span className="text-[10px] font-medium text-zinc-500">
              {t("dashboard.day_streak")}
            </span>
          </span>
        )}
      </header>

      {/* Title */}
      <div className="text-center">
        <h1 className="text-lg font-extrabold text-zinc-50">{t("home.active_title")}</h1>
        {endDateLabel && (
          <p className="mt-0.5 text-xs text-zinc-500">
            {t("home.ends_on", { date: endDateLabel })}
          </p>
        )}
      </div>

      {/* Hero arc */}
      <SubscriptionArc
        daysLeft={daysLeft}
        fraction={fraction}
        daysLabel={daysWord}
        subLabel=""
      />
      {/* Two main cards — locked LTR: [renew | store] */}
      <div dir="ltr" className="grid grid-cols-2 gap-3">
        <Link
          href="/billing"
          className="ripple rounded-2xl border border-white/5 bg-zinc-900/60 p-3 active:scale-[0.98]"
        >
          <span dir={ar ? "rtl" : "ltr"} className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span className="block text-[13px] font-bold leading-snug text-zinc-50">
                {t("home.renew_title")}
              </span>
              <span className="mt-1 block text-[11px] text-zinc-400">
                {t("home.renew_sub")}
              </span>
            </span>
            <RefreshCw className="h-6 w-6 shrink-0 text-lime-400" />
          </span>
        </Link>

        <Link
          href="/shop"
          className="ripple rounded-2xl border border-white/5 bg-zinc-900/60 p-3 active:scale-[0.98]"
        >
          <span dir={ar ? "rtl" : "ltr"} className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span className="block text-[13px] font-bold leading-snug text-zinc-50">
                {t("home.store_title")}
              </span>
              <span className="mt-1 block text-[11px] text-zinc-400">
                {t("home.store_sub")}
              </span>
            </span>
            <ShoppingBag className="h-6 w-6 shrink-0 text-lime-400" />
          </span>
        </Link>
      </div>

      {/* Action: check-in → start workout → done */}
      {workoutCompletedToday ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <p className="text-sm font-bold text-zinc-100">
            {t("dashboard.workout_complete")}
            {completedTemplateName ? ` · ${completedTemplateName}` : ""}
          </p>
        </div>
      ) : checkedInToday ? (
        <Button asChild size="lg" className="w-full gap-2 py-6 text-base">
          <Link href="/workout">
            <Dumbbell className="h-5 w-5" /> {t("dashboard.start_workout")}
          </Link>
        </Button>
      ) : (
        <div className="rounded-2xl border border-white/5 bg-zinc-900/60 p-4 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-lime-500/30">
            <MapPin className="h-6 w-6" />
          </span>
          <p className="mt-2 text-sm font-bold text-zinc-50">{t("dashboard.ready_to_train")}</p>
          <p className="text-xs text-zinc-400">{t("dashboard.check_in_unlock")}</p>
          <Button size="lg" onClick={() => setPinOpen(true)} className="mt-3 w-full py-6 text-base">
            {t("dashboard.im_at_gym")}
          </Button>
        </div>
      )}
      <CheckInModal open={pinOpen} onOpenChange={setPinOpen} onSuccess={() => {}} />

      {/* Slim announcement */}
      <section className="rounded-2xl border border-white/5 bg-zinc-900/60 p-3.5">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Megaphone className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {t("dashboard.announcement")}
            </p>
            {announcement ? (
              <>
                <p className="mt-0.5 truncate text-[13px] font-semibold text-zinc-100">
                  {announcement.title}
                </p>
                {announcement.body && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-zinc-400">{announcement.body}</p>
                )}
              </>
            ) : (
              <p className="mt-0.5 text-[13px] text-zinc-500">{t("dashboard.no_announcements")}</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
