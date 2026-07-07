"use server";

// ============================================================================
//  Server-side snapshot puller — gathers everything the offline layer caches
//  in ONE round-trip. Mirrors the queries already living in the dashboard,
//  workout, chat, and leaderboard server components.
//
//  Returned payload is written to IndexedDB by lib/offline/snapshot.ts.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { createClient as createSSRClient } from "@/lib/supabase/server";
import { WORKOUT_PRESETS } from "@/lib/constants";
import type { SetLog } from "@/lib/types";
import { getMyWeeklySchedule } from "@/lib/weekly-schedule-actions";
import { fetchInbox, fetchThread } from "@/lib/chat-actions";
import { pointsLeaderboard, ratioLeaderboard, weightLeaderboard } from "@/lib/leaderboard";
import type {
  Profile,
  Subscription,
  Exercise,
  Machine,
  UserWorkoutTemplate,
  WorkoutTemplate,
} from "@/lib/types";

// Nullify any machine_id that no longer exists in machine_library so the FK
// constraint doesn't blow up when stale references reach the DB.
async function scrubMachineIds(
  supabase: ReturnType<typeof serviceClient>,
  ids: (string | null)[]
): Promise<(string | null)[]> {
  const unique = [...new Set(ids.filter(Boolean) as string[])];
  if (unique.length === 0) return ids;
  const { data } = await supabase
    .from("machine_library")
    .select("id")
    .in("id", unique);
  const valid = new Set(data?.map((r) => r.id) ?? []);
  return ids.map((id) => (id && valid.has(id) ? id : null));
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function currentUserId(): Promise<string | null> {
  const ssr = await createSSRClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  return user?.id ?? null;
}

// The full payload shipped to the client. Mirrors the Cached* types in
// lib/offline/types.ts but without the `fetchedAt` envelope (added client-side).
export type SnapshotPayload = {
  profile: Profile | null;
  subscription: Subscription | null;
  crowdCount: number | null;
  todayCompleted: boolean;
  sessions: { completed_at: string | null }[];
  announcement: { title: string; body: string | null; created_at: string } | null;
  gymSettings: { daily_pin: string } | null;
  coachTemplate: (WorkoutTemplate & { exercises: Exercise[] }) | null;
  coachTemplates: (WorkoutTemplate & { exercises: Exercise[] })[];
  myPlans: UserWorkoutTemplate[];
  weeklySchedule: {
    day: string;
    templateId: string | null;
    name: string | null;
  }[];
  machines: Machine[];
  checkedInToday: boolean;
  chatContacts: Awaited<ReturnType<typeof fetchInbox>>["contacts"];
  leaderboardMonthlyXp: Awaited<ReturnType<typeof pointsLeaderboard>>;
  leaderboardRatio: Awaited<ReturnType<typeof ratioLeaderboard>>;
  leaderboardWeight: Awaited<ReturnType<typeof weightLeaderboard>>;
  threads: { otherUserId: string; messages: import("@/lib/types").ChatMessage[] }[];
  role: string | null;
  equippedNickname: string | null;
  equippedBannerKey: string | null;
};

function isToday(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Pull every cached surface in one pass. Individual failures degrade: a failed
// sub-query yields null/[] rather than aborting the whole snapshot.
export async function pullSnapshot(): Promise<{
  error: string | null;
  payload: SnapshotPayload | null;
}> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in.", payload: null };

  const supabase = serviceClient();
  const now = new Date();

  // ---- Profile + role ----
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single<Profile>();
  const profile = profileRow ?? null;
  const role = profile?.role ?? null;

  // ---- Subscription ----
  const { data: subscriptionRow } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const subscription = (subscriptionRow as Subscription | null) ?? null;

  // ---- Crowd count (distinct checked-in within last 2h) ----
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const { data: goneUsers } = await supabase
    .from("workout_sessions")
    .select("user_id")
    .not("completed_at", "is", null)
    .lte("completed_at", fiveMinAgo);
  const goneIds = (goneUsers ?? []).map((r) => r.user_id as string);

  let crowdCount: number | null = null;
  if (goneIds.length > 0) {
    const { count } = await supabase
      .from("attendance_log")
      .select("user_id", { count: "exact", head: true })
      .gte("checked_in_at", twoHoursAgo)
      .not("user_id", "in", `(${goneIds.join(",")})`);
    crowdCount = count;
  } else {
    const { count } = await supabase
      .from("attendance_log")
      .select("user_id", { count: "exact", head: true })
      .gte("checked_in_at", twoHoursAgo);
    crowdCount = count;
  }

  // ---- Workout sessions (streak + weekly count) ----
  const { data: sessionRows } = await supabase
    .from("workout_sessions")
    .select("completed_at")
    .eq("user_id", userId)
    .not("completed_at", "is", null);
  const sessions = (sessionRows ?? []) as { completed_at: string | null }[];

  // ---- Today completed? ----
  const today = now.toISOString().split("T")[0];
  const { data: todayRow } = await supabase
    .from("workout_sessions")
    .select("id, completed_at")
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .gte("completed_at", today)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const todayCompleted = !!todayRow;

  // ---- Announcement ----
  const { data: announcementRow } = await supabase
    .from("notifications")
    .select("title, body, created_at")
    .eq("user_id", userId)
    .eq("type", "broadcast")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const announcement =
    (announcementRow as SnapshotPayload["announcement"]) ?? null;

  // ---- Gym settings (PIN) ----
  // NOTE: the daily PIN is cached client-side so check-in can be verified
  // offline. It's a low-value 2-digit code shown publicly at the front desk.
  const { data: settingsRow } = await supabase
    .from("gym_settings")
    .select("daily_pin")
    .eq("id", 1)
    .maybeSingle();
  const gymSettings = settingsRow?.daily_pin
    ? { daily_pin: settingsRow.daily_pin }
    : null;

  // ---- Today's scheduled coach template ----
  const { data: scheduled } = await supabase
    .from("scheduled_workouts")
    .select("template_id")
    .eq("user_id", userId)
    .eq("scheduled_date", today)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let coachTemplate: SnapshotPayload["coachTemplate"] = null;
  if (scheduled?.template_id) {
    const { data: t } = await supabase
      .from("workout_templates")
      .select("id, name, description, exercises, created_by, created_at")
      .eq("id", scheduled.template_id)
      .maybeSingle();
    if (t) {
      coachTemplate = {
        ...(t as WorkoutTemplate),
        exercises: (t.exercises as Exercise[]) ?? [],
      };
    }
  }

  // ---- Coach template library ----
  const { data: coachRows } = await supabase
    .from("workout_templates")
    .select("id, name, description, exercises, created_by, created_at")
    .order("created_at", { ascending: false });
  const coachTemplates: SnapshotPayload["coachTemplates"] = (
    (coachRows ?? []) as WorkoutTemplate[]
  ).map((t) => ({ ...t, exercises: (t.exercises as Exercise[]) ?? [] }));

  // ---- Member's saved plans ----
  const { data: myRows } = await supabase
    .from("user_workout_templates")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  const myPlans = (myRows as UserWorkoutTemplate[] | null) ?? [];

  // ---- Weekly schedule (resolved to names) ----
  const { days } = await getMyWeeklySchedule();
  const weeklySchedule: SnapshotPayload["weeklySchedule"] = days.map((d) => ({
    day: DAY_NAMES[d.dayOfWeek] ?? "?",
    templateId: d.templateId,
    name: d.name,
  }));

  // ---- Machines ----
  const { data: machineRows } = await supabase
    .from("machine_library")
    .select("*")
    .order("name", { ascending: true });
  const machines = (machineRows as Machine[] | null) ?? [];

  // ---- Chat contacts + recent threads ----
  // Contacts for whichever role this user is.
  const counterpartRoles =
    role === "admin" || role === "staff"
      ? (["subscriber"] as const)
      : (["admin", "staff", "subscriber"] as const);
  const { contacts: chatContacts } = await fetchInbox([...counterpartRoles]);

  // Cache up to the 10 most recent threads.
  const threadTargets = chatContacts.slice(0, 10).map((c) => c.id);
  const threadResults = await Promise.all(
    threadTargets.map(async (otherId) => {
      const { messages } = await fetchThread(otherId);
      return { otherUserId: otherId, messages };
    })
  );
  const threads = threadResults;

  // ---- Leaderboards ----
  const [leaderboardMonthlyXp, leaderboardRatio, leaderboardWeight] =
    await Promise.all([pointsLeaderboard(), ratioLeaderboard(), weightLeaderboard()]);

  // ---- Equipped cosmetics ----
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

  const payload: SnapshotPayload = {
    profile,
    subscription,
    crowdCount,
    todayCompleted,
    sessions,
    announcement,
    gymSettings,
    coachTemplate,
    coachTemplates,
    myPlans,
    weeklySchedule,
    machines,
    checkedInToday: isToday(profile?.last_attendance_date),
    chatContacts,
    leaderboardMonthlyXp,
    leaderboardRatio,
    leaderboardWeight,
    threads,
    role,
    equippedNickname,
    equippedBannerKey,
  };

  return { error: null, payload };
}

// Idempotently replay a single queued write. Returns whether it succeeded so
// the sync engine can remove it from the queue.
export async function applyQueuedOp(
  op: import("./types").QueueItem
): Promise<{ ok: boolean; error?: string }> {
  const supabase = serviceClient();
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Not signed in." };

  switch (op.type) {
    case "checkin": {
      // Verify PIN then run the idempotent check_in_member RPC.
      const { data: ok, error: verifyErr } = await supabase.rpc("verify_pin", {
        p_pin: op.payload.pin,
      });
      if (verifyErr) return { ok: false, error: verifyErr.message };
      if (!ok) return { ok: false, error: "Wrong PIN." };
      const { error } = await supabase.rpc("check_in_member", {
        p_user_id: userId,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }
    case "startSession": {
      const { error } = await supabase
        .from("workout_sessions")
        .insert({
          user_id: userId,
          template_id: op.payload.templateId,
          started_at: op.createdAt,
        });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }
    case "logSet": {
      const [machineId] = await scrubMachineIds(supabase, [op.payload.machineId]);
      const { error } = await supabase.from("set_logs").insert({
        session_id: op.payload.sessionId,
        exercise_name: op.payload.exerciseName,
        set_number: op.payload.setNumber,
        weight: op.payload.weight,
        reps: op.payload.reps,
        machine_id: machineId,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }
    case "completeWorkout": {
      const { error: sessionErr } = await supabase
        .from("workout_sessions")
        .update({ completed_at: op.createdAt })
        .eq("id", op.payload.sessionId);
      if (sessionErr) return { ok: false, error: sessionErr.message };
      await supabase
        .from("profiles")
        .update({ last_workout_date: op.createdAt.split("T")[0] })
        .eq("id", userId);
      await supabase.rpc("award_xp", {
        p_user_id: userId,
        p_amount: 50,
        p_reason: "Workout completed (synced from offline)",
      });
      return { ok: true };
    }
    case "offlineWorkout": {
      // Create the session + its set_logs as one consistent unit, then award XP.
      // Idempotent guard: skip if a session already exists for this user with
      // the same startedAt (prevents dupes if sync runs twice).
      const startedAt = op.payload.startedAt;
      const { data: existing } = await supabase
        .from("workout_sessions")
        .select("id")
        .eq("user_id", userId)
        .eq("started_at", startedAt)
        .maybeSingle();
      let sessionId = existing?.id;
      if (!sessionId) {
        const { data: inserted, error: insertErr } = await supabase
          .from("workout_sessions")
          .insert({
            user_id: userId,
            template_id: op.payload.templateId,
            started_at: startedAt,
            completed_at: op.payload.completedAt,
          })
          .select("id")
          .single();
        if (insertErr) return { ok: false, error: insertErr.message };
        sessionId = inserted.id;

        // Insert the set logs linked to the new session.
        if (op.payload.sets.length > 0) {
          const machineIds = op.payload.sets.map((s) => s.machineId);
          const scrubbed = await scrubMachineIds(supabase, machineIds);
          const { error: setsErr } = await supabase.from("set_logs").insert(
            op.payload.sets.map((s, i) => ({
              session_id: sessionId,
              exercise_name: s.exerciseName,
              set_number: s.setNumber,
              weight: s.weight,
              reps: s.reps,
              machine_id: scrubbed[i],
            }))
          );
          if (setsErr) return { ok: false, error: setsErr.message };
        }

        await supabase
          .from("profiles")
          .update({ last_workout_date: op.payload.completedAt.split("T")[0] })
          .eq("id", userId);
        await supabase.rpc("award_xp", {
          p_user_id: userId,
          p_amount: 50,
          p_reason: `Workout completed offline: ${op.payload.templateName}`,
        });
      }
      return { ok: true };
    }
    case "sendMessage": {
      const { error } = await supabase.from("chat_messages").insert({
        sender_id: userId,
        recipient_id: op.payload.recipientId,
        body: op.payload.body,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }
    case "markThreadRead": {
      const { error } = await supabase
        .from("chat_messages")
        .update({ read_at: op.createdAt })
        .eq("sender_id", op.payload.otherUserId)
        .eq("recipient_id", userId)
        .is("read_at", null);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }
    default:
      return { ok: true };
  }
}
