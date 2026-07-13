"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createSSRClient } from "@/lib/supabase/server";
import { getMyWeeklySchedule } from "@/lib/weekly-schedule-actions";
import { getWorkoutPresets } from "@/lib/workout-preset-actions";
import type { WorkoutPreset } from "@/lib/constants";
import {
  pointsLeaderboard,
  ratioLeaderboard,
  weightLeaderboard,
} from "@/lib/leaderboard";
import type {
  Profile,
  Subscription,
  Exercise,
  Machine,
  UserWorkoutTemplate,
  Tier,
} from "@/lib/types";
import {
  tierFloor,
  nextTier,
  POINT_REWARDS,
  bannerGradient,
} from "@/lib/constants";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function currentUserId(): Promise<string | null> {
  const ssr = await createSSRClient();
  const { data: { user } } = await ssr.auth.getUser();
  return user?.id ?? null;
}

function isToday(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

// =========================================================================
//  Dashboard data
// =========================================================================
export type DashboardData = {
  profile: Profile | null;
  points: number;
  tier: Tier;
  pct: number;
  up: { tier: string; xp: number } | null;
  streak: number;
  workoutsThisWeek: number;
  lastWorkoutLabel: string;
  checkedInToday: boolean;
  liveCount: number;
  workoutCompletedToday: boolean;
  completedTemplateName: string | null;
  todaySession: { name: string; exerciseCount: number } | null;
  announcement: { title: string; body: string | null; created_at: string } | null;
  equippedNickname: string | null;
  equippedBannerKey: string | null;
  daysLeft: number | null;
  planLabel: string | null;
  subscription: Subscription | null;
};

export async function getDashboardData(): Promise<{
  error: string | null;
  data: DashboardData | null;
}> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in.", data: null };

  const supabase = serviceClient();

  const [profileRes, subscriptionRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single<Profile>(),
    supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const profile = profileRes.data;
  const subscription = subscriptionRes.data;

  // Live crowd count
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: goneUsers } = await supabase
    .from("workout_sessions")
    .select("user_id")
    .not("completed_at", "is", null)
    .lte("completed_at", fiveMinAgo);
  const goneIds = goneUsers?.map((r: { user_id: string }) => r.user_id) ?? [];

  let liveCount = 0;
  const countQuery = supabase
    .from("attendance_log")
    .select("user_id", { count: "exact", head: true })
    .gte("checked_in_at", twoHoursAgo);
  if (goneIds.length > 0) {
    const { count } = await countQuery.not("user_id", "in", `(${goneIds.join(",")})`);
    liveCount = count ?? 0;
  } else {
    const { count } = await countQuery;
    liveCount = count ?? 0;
  }

  // Today's workout
  const today = new Date().toISOString().split("T")[0];
  const { data: todayCompleted } = await supabase
    .from("workout_sessions")
    .select("id, completed_at, template_id")
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .gte("completed_at", today)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let completedTemplateName: string | null = null;
  if (todayCompleted?.template_id) {
    const { data: ct } = await supabase
      .from("workout_templates")
      .select("name")
      .eq("id", todayCompleted.template_id)
      .maybeSingle();
    completedTemplateName = ct?.name ?? null;
  }

  // Streak + week count
  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("completed_at")
    .eq("user_id", userId)
    .not("completed_at", "is", null);

  const sessionDates = ((sessions ?? []) as { completed_at: string | null }[]).map(
    (s) => s.completed_at
  );
  const streak = computeStreak(sessionDates);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const workoutsThisWeek = sessionDates.filter(
    (d) => d && new Date(d) >= new Date(weekAgo)
  ).length;

  // Scheduled session
  const { data: scheduled } = await supabase
    .from("scheduled_workouts")
    .select("template_id")
    .eq("user_id", userId)
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

  // Announcement (not expired)
  const { data: announcement } = await supabase
    .from("notifications")
    .select("title, body, created_at")
    .eq("user_id", userId)
    .eq("type", "broadcast")
    .or("expires_at.is.null,expires_at.gt.now()")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Equipped cosmetics
  const { data: equippedRows } = await supabase
    .from("user_cosmetics")
    .select("cosmetic_id, cosmetics(type, name, value)")
    .eq("user_id", userId)
    .eq("equipped", true);

  const equipped = (equippedRows ?? []) as unknown as {
    cosmetic_id: string;
    cosmetics: { type: "nickname" | "banner"; name: string; value: string } | null;
  }[];
  const equippedNickname =
    equipped.find((e) => e.cosmetics?.type === "nickname")?.cosmetics?.value ?? null;
  const equippedBannerKey =
    equipped.find((e) => e.cosmetics?.type === "banner")?.cosmetics?.value ?? null;

  // Points + tier
  const points = profile?.points ?? 0;
  const tier = (profile?.current_tier ?? "iron") as Tier;
  const floor = tierFloor(tier);
  const up = nextTier(tier);
  const pct = up
    ? Math.round(((points - floor) / (up.xp - floor)) * 100)
    : 100;

  const checkedInToday = isToday(profile?.last_attendance_date);

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

  return {
    error: null,
    data: {
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
      workoutCompletedToday: !!todayCompleted,
      completedTemplateName,
      todaySession,
      announcement,
      equippedNickname,
      equippedBannerKey,
      daysLeft,
      planLabel,
      subscription,
    },
  };
}

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

// =========================================================================
//  Workout page data
// =========================================================================
export type WorkoutPageData = {
  checkedInToday: boolean;
  coachTemplate: {
    id: string;
    name: string;
    description: string | null;
    exercises: Exercise[];
  } | null;
  coachTemplates: {
    id: string;
    name: string;
    description: string | null;
    exercises: Exercise[];
  }[];
  myPlans: UserWorkoutTemplate[];
  weeklySchedule: Awaited<ReturnType<typeof getMyWeeklySchedule>>["days"];
  coaches: { id: string; full_name: string | null }[];
  machines: Machine[];
  presets: WorkoutPreset[];
};

export async function getWorkoutData(): Promise<{
  error: string | null;
  data: WorkoutPageData | null;
}> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in.", data: null };

  const supabase = serviceClient();
  const today = new Date().toISOString().split("T")[0];

  const weeklySchedulePromise = getMyWeeklySchedule();
  const presetsPromise = getWorkoutPresets();

  const [profileRes, scheduledRes, coachRes, myRes, coachProfileRes, machineRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("last_attendance_date")
        .eq("id", userId)
        .single(),
      supabase
        .from("scheduled_workouts")
        .select("template_id")
        .eq("user_id", userId)
        .eq("scheduled_date", today)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("workout_templates")
        .select("id, name, description, exercises")
        .order("created_at", { ascending: false }),
      supabase
        .from("user_workout_templates")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name")
        .in("role", ["admin", "staff"])
        .order("created_at", { ascending: true }),
      supabase.from("machine_library").select("*").order("name", { ascending: true }),
    ]);

  const checkedInToday = isToday(profileRes.data?.last_attendance_date);

  let coachTemplate: WorkoutPageData["coachTemplate"] = null;
  if (scheduledRes.data?.template_id) {
    const allCoachTemplates = (coachRes.data ?? []) as { id: string; name: string; description: string | null; exercises: Exercise[] }[];
    const t = allCoachTemplates.find((t) => t.id === scheduledRes.data!.template_id);
    if (t) {
      coachTemplate = {
        id: t.id,
        name: t.name,
        description: t.description,
        exercises: (t.exercises as Exercise[]) ?? [],
      };
    }
  }

  const coachTemplates = ((coachRes.data ?? []) as {
    id: string;
    name: string;
    description: string | null;
    exercises: Exercise[];
  }[]).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    exercises: (t.exercises as Exercise[]) ?? [],
  }));

  const { days: weeklyDays } = await weeklySchedulePromise;
  const presets = await presetsPromise;

    return {
      error: null,
      data: {
        checkedInToday,
        coachTemplate,
        coachTemplates,
        myPlans: (myRes.data as UserWorkoutTemplate[] | null) ?? [],
        weeklySchedule: weeklyDays,
        coaches: (coachProfileRes.data ?? []) as { id: string; full_name: string | null }[],
        machines: (machineRes.data as Machine[] | null) ?? [],
        presets,
      },
    };
}

// =========================================================================
//  Leaderboard data
// =========================================================================
export type LeaderboardPageData = {
  points: Awaited<ReturnType<typeof pointsLeaderboard>>;
  ratio: Awaited<ReturnType<typeof ratioLeaderboard>>;
  weight: Awaited<ReturnType<typeof weightLeaderboard>>;
};

export async function getLeaderboardData(): Promise<{
  error: string | null;
  data: LeaderboardPageData | null;
}> {
  const [points, ratio, weight] = await Promise.all([
    pointsLeaderboard(),
    ratioLeaderboard(),
    weightLeaderboard(),
  ]);
  return { error: null, data: { points, ratio, weight } };
}
