import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getT } from "@/lib/i18n/server";
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
import type { Profile, Tier } from "@/lib/types";
import {
  tierFloor,
  nextTier,
  POINT_REWARDS,
  bannerGradient,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

function isToday(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr).toDateString() === new Date().toDateString();
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

// Count consecutive days (ending today or yesterday) with a completed workout.
function computeStreak(dates: (string | null)[]): number {
  const days = new Set(
    dates.filter(Boolean).map((d) => new Date(d!).toDateString())
  );
  let streak = 0;
  const cursor = new Date();
  if (!days.has(cursor.toDateString())) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (days.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
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

// Gradient that visually transitions from the current tier toward the next one.
const TIER_GRADIENT: Record<Tier, string> = {
  iron: "from-zinc-500 to-amber-500",
  bronze: "from-amber-600 to-yellow-400",
  gold: "from-yellow-500 to-cyan-400",
  diamond: "from-cyan-400 to-lime-400",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const t = await getT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single<Profile>();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Live crowd: distinct users checked in within the last 2 hours,
  // EXCLUDING those who completed a workout more than 5 minutes ago.
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  // Users who finished a workout more than 5 min ago — they've left.
  const { data: goneUsers } = await supabase
    .from("workout_sessions")
    .select("user_id")
    .not("completed_at", "is", null)
    .lte("completed_at", fiveMinAgo);
  const goneIds = goneUsers?.map((r) => r.user_id) ?? [];

  let liveCount: number | null = null;
  if (goneIds.length > 0) {
    const { count } = await supabase
      .from("attendance_log")
      .select("user_id", { count: "exact", head: true })
      .gte("checked_in_at", twoHoursAgo)
      .not("user_id", "in", `(${goneIds.join(",")})`);
    liveCount = count;
  } else {
    const { count } = await supabase
      .from("attendance_log")
      .select("user_id", { count: "exact", head: true })
      .gte("checked_in_at", twoHoursAgo);
    liveCount = count;
  }

  // Check if the user completed a workout today.
  const { data: todayCompleted } = await supabase
    .from("workout_sessions")
    .select("id, completed_at, template_id")
    .eq("user_id", user!.id)
    .not("completed_at", "is", null)
    .gte("completed_at", new Date().toISOString().split("T")[0])
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Resolve the template name for the completed workout.
  let completedTemplateName: string | null = null;
  if (todayCompleted?.template_id) {
    const { data: ct } = await supabase
      .from("workout_templates")
      .select("name")
      .eq("id", todayCompleted.template_id)
      .maybeSingle();
    completedTemplateName = ct?.name ?? null;
  }
  const workoutCompletedToday = !!todayCompleted;

  // Workout history — for streak + weekly count. Degrades gracefully: if the
  // query errors (e.g. grants not yet applied), we just show 0 / "—".
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("completed_at")
    .eq("user_id", user!.id)
    .not("completed_at", "is", null);

  const sessionDates = sessions?.map((s) => s.completed_at) ?? [];
  const streak = computeStreak(sessionDates);
  const workoutsThisWeek = sessionDates.filter(
    (d) => d && new Date(d) >= new Date(weekAgo)
  ).length;

  // Today's scheduled session preview.
  const today = new Date().toISOString().split("T")[0];
  const { data: scheduled } = await supabase
    .from("scheduled_workouts")
    .select("template_id")
    .eq("user_id", user!.id)
    .eq("scheduled_date", today)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let todaySession: { name: string; exerciseCount: number } | null = null;
  if (scheduled?.template_id) {
    const { data: t } = await supabase
      .from("workout_templates")
      .select("name, exercises")
      .eq("id", scheduled.template_id)
      .maybeSingle();
    if (t) {
      todaySession = {
        name: t.name,
        exerciseCount: Array.isArray(t.exercises) ? t.exercises.length : 0,
      };
    }
  }

  // Latest coach broadcast announcement (not expired).
  const { data: announcement } = await supabase
    .from("notifications")
    .select("title, body, created_at")
    .eq("user_id", user!.id)
    .eq("type", "broadcast")
    .or("expires_at.is.null,expires_at.gt.now()")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Equipped cosmetics — one nickname + one banner (if any).
  const { data: equippedRows } = await supabase
    .from("user_cosmetics")
    .select("cosmetic_id, cosmetics(type, name, value)")
    .eq("user_id", user!.id)
    .eq("equipped", true);
  const equipped = (equippedRows ?? []) as unknown as {
    cosmetic_id: string;
    cosmetics: { type: "nickname" | "banner"; name: string; value: string } | null;
  }[];
  const equippedNickname =
    equipped.find((e) => e.cosmetics?.type === "nickname")?.cosmetics?.value ?? null;
  const equippedBannerKey =
    equipped.find((e) => e.cosmetics?.type === "banner")?.cosmetics?.value ?? null;
  const bannerClass = bannerGradient(equippedBannerKey);

  // Points + tier progress. `points` is the single spendable balance.
  const points = profile?.points ?? 0;
  const tier = profile?.current_tier ?? "iron";
  const floor = tierFloor(tier as Tier);
  const up = nextTier(tier as Tier);
  const pct = up
    ? Math.round(((points - floor) / (up.xp - floor)) * 100)
    : 100;

  const checkedInToday = isToday(profile?.last_attendance_date);

  // Days remaining on subscription.
  const planLabel = subscription?.plan_type
    ? subscription.plan_type.replace("-", " ")
    : null;
  const daysLeft = subscription?.end_date
    ? Math.max(
        0,
        Math.ceil(
          (new Date(subscription.end_date).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : null;

  const lastWorkout = profile?.last_workout_date
    ? new Date(profile.last_workout_date)
    : null;
  const lastWorkoutLabel = lastWorkout
    ? lastWorkout.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";

  return (
    <div className="space-y-5">
      {/* 1. Profile & streak — avatar on the left, quick stat on the right */}
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
                “{equippedNickname}”
              </p>
            )}
            <div className="mt-2 flex items-center gap-2">
              <TierBadge tier={tier as Tier} />
            </div>
          </div>
          <div className="flex flex-col items-end text-end">
            <span className="flex items-center gap-1 text-2xl font-black text-primary">
              <Flame className="h-5 w-5" />
              {streak}
            </span>
            <span className="text-[11px] font-medium text-zinc-400">
              {streak === 1 ? t("dashboard.day_streak") : t("dashboard.day_streak")}
            </span>
          </div>
        </div>
      </header>

      {/* 2. Live gym capacity — slim, pill-shaped */}
      <CrowdMeter activeCount={liveCount ?? 0} />

      {/* 3. Coach announcement */}
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

      {/* 4. Active session — transforms based on check-in + workout state */}
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
          <CheckInMerged workoutsThisWeek={workoutsThisWeek} lastWorkoutLabel={lastWorkoutLabel} />
        )}

        {/* Stat cards inside every state */}
        {workoutCompletedToday || checkedInToday ? (
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
        ) : null}
      </section>

      {/* 5. Points wallet — spendable balance + tier progress */}
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

        {/* Thick gradient progress bar with tier labels */}
        <div className="relative">
          <div className="flex justify-between px-0.5 pb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
            <span className="capitalize">{tier}</span>
            {up && <span className="capitalize">{up.tier}</span>}
          </div>
          <div className="relative h-5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className={cn(
                "h-full rounded-full bg-gradient-to-r transition-all duration-1000 ease-out",
                TIER_GRADIENT[tier as Tier]
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

      {/* 6. Subscription — slim remaining-days strip */}
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
              {t("dashboard.plan_label", { plan: planLabel })}
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
