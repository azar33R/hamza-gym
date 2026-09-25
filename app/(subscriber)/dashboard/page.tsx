import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/subscriber/tabs/dashboard-shell";
import type { DashboardData } from "@/app/(subscriber)/tab-actions";
import type { Profile, Subscription, Tier } from "@/lib/types";
import { tierFloor, nextTier } from "@/lib/constants";
import { daysLeftUntil } from "@/lib/utils";
import { ensurePlanEndingNotification } from "@/lib/notification-actions";

function isToday(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr).toDateString() === new Date().toDateString();
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

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
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
  const goneIds = goneUsers?.map((r: { user_id: string }) => r.user_id) ?? [];

  let liveCount = 0;
  if (goneIds.length > 0) {
    const { count } = await supabase
      .from("attendance_log")
      .select("user_id", { count: "exact", head: true })
      .gte("checked_in_at", twoHoursAgo)
      .not("user_id", "in", `(${goneIds.join(",")})`);
    liveCount = count ?? 0;
  } else {
    const { count } = await supabase
      .from("attendance_log")
      .select("user_id", { count: "exact", head: true })
      .gte("checked_in_at", twoHoursAgo);
    liveCount = count ?? 0;
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

  const sessionDates = ((sessions ?? []) as { completed_at: string | null }[]).map(
    (s) => s.completed_at
  );
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

  // Points + tier progress. `points` is the single spendable balance.
  const points = profile?.points ?? 0;
  const tier = (profile?.current_tier ?? "iron") as Tier;
  const floor = tierFloor(tier);
  const up = nextTier(tier);
  const pct = up
    ? Math.round(((points - floor) / (up.xp - floor)) * 100)
    : 100;

  const checkedInToday = isToday(profile?.last_attendance_date);

  // Days remaining on subscription.
  const planLabel = subscription?.plan_type
    ? (subscription.plan_type as string).replace("-", " ")
    : null;
  const daysLeft = daysLeftUntil(subscription?.end_date);

  // Nudge the member when their plan is about to expire (once per window).
  if (daysLeft !== null && user) {
    await ensurePlanEndingNotification(user.id, daysLeft);
  }

  const lastWorkout = profile?.last_workout_date
    ? new Date(profile.last_workout_date)
    : null;
  const lastWorkoutLabel = lastWorkout
    ? lastWorkout.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";

  const data: DashboardData = {
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
    announcement: announcement
      ? {
          title: announcement.title,
          body: announcement.body,
          created_at: announcement.created_at,
        }
      : null,
    equippedNickname,
    equippedBannerKey,
    daysLeft,
    planLabel,
    subscription: (subscription as Subscription | null) ?? null,
  };

  return <DashboardShell data={data} userId={user!.id} />;
}
