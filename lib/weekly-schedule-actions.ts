"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { createClient as createSSRClient } from "@/lib/supabase/server";
import { WORKOUT_PRESETS } from "@/lib/constants";
import type { Exercise } from "@/lib/types";

// Service-role client — bypasses RLS so we can scope reads/writes to the
// caller ourselves (matches user-workout-actions / chat-actions).
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

export type ScheduleSourceType = "preset" | "custom" | "coach";

// A single weekday assignment, fully resolved with the plan's name + exercises
// so the UI can render and the active-workout can start it with no extra lookups.
export type ResolvedDay = {
  dayOfWeek: number; // 0 = Sun (matches JS getDay())
  sourceType: ScheduleSourceType;
  sourceId: string;
  name: string;
  description: string | null;
  exercises: Exercise[];
  // The workout_templates id when this is a coach plan (so the session can be
  // linked back to the template). Null for presets/custom plans.
  templateId: string | null;
};

// Raw row shape — matches the table created in 0014.
type ScheduleRow = {
  day_of_week: number;
  source_type: ScheduleSourceType;
  source_id: string;
};

// Fetch the caller's weekly schedule and resolve each assignment into a full
// plan. Returns the raw rows + resolved plans so the caller can render and start
// sessions without re-querying.
export async function getMyWeeklySchedule(): Promise<{
  error: string | null;
  days: ResolvedDay[];
}> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in.", days: [] };

  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("user_weekly_schedule")
    .select("day_of_week, source_type, source_id")
    .eq("user_id", userId);

  if (error) return { error: error.message, days: [] };

  const rows = (data as ScheduleRow[] | null) ?? [];
  if (rows.length === 0) return { error: null, days: [] };

  // Group the ids we need to resolve per source so we can batch-query each table.
  const customIds = rows
    .filter((r) => r.source_type === "custom")
    .map((r) => r.source_id);
  const coachIds = rows
    .filter((r) => r.source_type === "coach")
    .map((r) => r.source_id);

  const [customMap, coachMap] = await Promise.all([
    resolveById(customIds, "user_workout_templates", supabase),
    resolveById(coachIds, "workout_templates", supabase),
  ]);

  // Preset resolution: prefer DB-backed gym presets (admin-editable), but keep
  // the static WORKOUT_PRESETS as a fallback so any legacy schedules still
  // referencing the old string ids resolve correctly.
  const presetMap = new Map<
    string,
    { name: string; description: string | null; exercises: Exercise[] }
  >();
  for (const p of WORKOUT_PRESETS) {
    presetMap.set(p.id, {
      name: p.name,
      description: p.description,
      exercises: p.exercises.map((e) => ({
        name: e.name,
        sets: e.sets,
        reps: e.reps,
      })),
    });
  }
  const { data: dbPresets } = await supabase
    .from("workout_presets")
    .select("id, name, description, exercises");
  for (const p of (dbPresets ?? []) as {
    id: string;
    name: string;
    description: string | null;
    exercises: unknown;
  }[]) {
    presetMap.set(p.id, {
      name: p.name,
      description: p.description,
      exercises: (p.exercises as Exercise[]) ?? [],
    });
  }

  const days: ResolvedDay[] = rows
    .map((r) => {
      let resolved: { name: string; description: string | null; exercises: Exercise[] } | undefined;
      let templateId: string | null = null;

      if (r.source_type === "preset") {
        resolved = presetMap.get(r.source_id);
      } else if (r.source_type === "custom") {
        resolved = customMap.get(r.source_id);
      } else {
        resolved = coachMap.get(r.source_id);
        templateId = r.source_id; // coach plans live in workout_templates
      }

      // Skip a dangling reference (e.g. a deleted plan) so the UI doesn't break.
      if (!resolved) return null;

      return {
        dayOfWeek: r.day_of_week,
        sourceType: r.source_type,
        sourceId: r.source_id,
        name: resolved.name,
        description: resolved.description,
        exercises: resolved.exercises,
        templateId,
      };
    })
    .filter((d): d is ResolvedDay => d !== null);

  return { error: null, days };
}

// Helper: fetch a set of plan rows by id from a single table and map them by id.
async function resolveById(
  ids: string[],
  table: "user_workout_templates" | "workout_templates",
  supabase: ReturnType<typeof serviceClient>
): Promise<Map<string, { name: string; description: string | null; exercises: Exercise[] }>> {
  const map = new Map<string, { name: string; description: string | null; exercises: Exercise[] }>();
  if (ids.length === 0) return map;

  const { data, error } = await supabase
    .from(table)
    .select("id, name, description, exercises")
    .in("id", ids);

  if (error || !data) return map;

  for (const row of data as {
    id: string;
    name: string;
    description: string | null;
    exercises: unknown;
  }[]) {
    map.set(row.id, {
      name: row.name,
      description: row.description,
      exercises: (row.exercises as Exercise[]) ?? [],
    });
  }
  return map;
}

// Pin a plan to a weekday for the caller (upserts on user_id + day_of_week).
export async function assignMyDay(
  dayOfWeek: number,
  sourceType: ScheduleSourceType,
  sourceId: string
): Promise<{ error: string | null }> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in." };
  if (dayOfWeek < 0 || dayOfWeek > 6) return { error: "Invalid day." };
  if (!sourceId.trim()) return { error: "Invalid plan." };

  const supabase = serviceClient();
  const { error } = await supabase
    .from("user_weekly_schedule")
    .upsert(
      {
        user_id: userId,
        day_of_week: dayOfWeek,
        source_type: sourceType,
        source_id: sourceId,
      },
      { onConflict: "user_id,day_of_week" }
    );
  if (error) return { error: error.message };

  revalidatePath("/workout");
  return { error: null };
}

// Clear the caller's assignment for a weekday.
export async function removeMyDay(
  dayOfWeek: number
): Promise<{ error: string | null }> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in." };
  if (dayOfWeek < 0 || dayOfWeek > 6) return { error: "Invalid day." };

  const supabase = serviceClient();
  const { error } = await supabase
    .from("user_weekly_schedule")
    .delete()
    .eq("user_id", userId)
    .eq("day_of_week", dayOfWeek);
  if (error) return { error: error.message };

  revalidatePath("/workout");
  return { error: null };
}
