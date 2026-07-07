import { createClient } from "@/lib/supabase/server";
import { WorkoutChooser } from "@/components/subscriber/workout-chooser";
import { STAFF_ROLES } from "@/lib/constants";
import { getMyWeeklySchedule } from "@/lib/weekly-schedule-actions";
import { getWorkoutPresets } from "@/lib/workout-preset-actions";
import type { Exercise, Machine, UserWorkoutTemplate } from "@/lib/types";
import type { WorkoutPreset } from "@/lib/constants";

export const dynamic = "force-dynamic";

function isToday(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

export default async function WorkoutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("last_attendance_date")
    .eq("id", user!.id)
    .single();

  const checkedInToday = isToday(profile?.last_attendance_date);

  // Today's coach-scheduled template (latest one wins if multiple).
  const today = new Date().toISOString().split("T")[0];
  const { data: scheduled } = await supabase
    .from("scheduled_workouts")
    .select("template_id")
    .eq("user_id", user!.id)
    .eq("scheduled_date", today)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let coachTemplate: {
    id: string;
    name: string;
    description: string | null;
    exercises: Exercise[];
  } | null = null;
  if (scheduled?.template_id) {
    const { data: t } = await supabase
      .from("workout_templates")
      .select("id, name, description, exercises")
      .eq("id", scheduled.template_id)
      .maybeSingle();
    if (t) {
      coachTemplate = {
        id: t.id,
        name: t.name,
        description: t.description,
        exercises: (t.exercises as Exercise[]) ?? [],
      };
    }
  }

  // The full coach template library — so the member can browse & start any of them.
  const { data: coachRows } = await supabase
    .from("workout_templates")
    .select("id, name, description, exercises")
    .order("created_at", { ascending: false });
  const coachTemplates = ((coachRows ?? []) as {
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

  // The member's saved plans.
  const { data: myRows } = await supabase
    .from("user_workout_templates")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });
  const myPlans = (myRows as UserWorkoutTemplate[] | null) ?? [];

  // The member's recurring weekly schedule (resolved to full plans).
  const { days: weeklySchedule } = await getMyWeeklySchedule();

  // All coaches the member can message for a workout request.
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("role", STAFF_ROLES)
    .order("created_at", { ascending: true });
  const coaches = (profileRows ?? []) as { id: string; full_name: string | null }[];

  // Machines: load all (small set) so the active-workout swap picker works.
  const { data: machineRows } = await supabase
    .from("machine_library")
    .select("*")
    .order("name", { ascending: true });
  const machines = (machineRows as Machine[] | null) ?? [];

  // Gym-wide presets (admin-managed, DB-backed).
  const presets = await getWorkoutPresets();

  return (
    <WorkoutChooser
      presets={presets}
      myPlans={myPlans}
      coachTemplate={coachTemplate}
      coachTemplates={coachTemplates}
      weeklySchedule={weeklySchedule}
      coaches={coaches}
      machines={machines}
      checkedInToday={checkedInToday}
    />
  );
}
