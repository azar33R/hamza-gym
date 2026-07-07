// Enum mirrors of the Postgres enum types defined in supabase/migrations/.

export type UserRole = "admin" | "staff" | "subscriber";

export type SubscriptionStatus =
  | "inactive"
  | "pending_approval"
  | "active"
  | "expired";

export type PlanType =
  | "1-day"
  | "1-month"
  | "3-month"
  | "6-month"
  | "1-year";

export type PaymentMethod = "vodafone_cash" | "manual_coach";

export type PaymentRequestStatus = "pending" | "approved" | "rejected";

// Phase 4 enums:

export type Tier = "iron" | "bronze" | "gold" | "diamond";

export type WorkoutPath = "coach_plan" | "presets" | "custom";

// Route groups a subscriber is locked out of until their status is "active".
export const LOCKED_STATUSES: SubscriptionStatus[] = ["inactive", "expired"];

// Statuses that show the "payment being verified" waiting screen.
export const WAITING_STATUSES: SubscriptionStatus[] = ["pending_approval"];

// ----------------------------------------------------------------------------
//  Gamification config — Points economy (single spendable balance)
// ----------------------------------------------------------------------------
// ONE points number per member. Earning a workout / check-in / PR raises it;
// buying a cosmetic (nickname/banner) lowers it. The leaderboard ranks this
// exact number and tier is derived from it too — spending genuinely matters and
// there is no hidden lifetime tally.

// Point rewards (kept here so the client can preview +50 etc. without a round-trip).
export const POINT_REWARDS = {
  CHECK_IN: 50,
  WORKOUT_COMPLETE: 50,
  PR_BONUS: 150,
} as const;

// Backwards-compatible alias for any caller still importing XP_REWARDS.
export const XP_REWARDS = POINT_REWARDS;

// Point thresholds that map to a tier. Mirrors the SQL `tier_for_points()`.
export const TIER_THRESHOLDS: { tier: Tier; xp: number }[] = [
  { tier: "iron", xp: 0 },
  { tier: "bronze", xp: 500 },
  { tier: "gold", xp: 2000 },
  { tier: "diamond", xp: 5000 },
];

// tierForPoints(points) — JS mirror of the SQL helper.
export function tierForPoints(points: number): Tier {
  if (points >= 5000) return "diamond";
  if (points >= 2000) return "gold";
  if (points >= 500) return "bronze";
  return "iron";
}

// Backwards-compatible alias.
export function tierForXp(xp: number): Tier {
  return tierForPoints(xp);
}

// nextTier(tier) — for the points progress bar ("X points to Gold").
export function nextTier(tier: Tier): { tier: Tier; xp: number } | null {
  const i = TIER_THRESHOLDS.findIndex((t) => t.tier === tier);
  if (i < 0 || i >= TIER_THRESHOLDS.length - 1) return null;
  return TIER_THRESHOLDS[i + 1];
}

// tier floor for the points progress bar.
export function tierFloor(tier: Tier): number {
  return TIER_THRESHOLDS.find((t) => t.tier === tier)?.xp ?? 0;
}

// ----------------------------------------------------------------------------
//  Cosmetics — banner gradient palette
//  Each banner cosmetic's `value` is a key into this map. The client renders
//  the matching CSS gradient behind the user's header. Keep in sync with the
//  seed rows in 0016_cosmetics.sql.
// ----------------------------------------------------------------------------
export const BANNER_GRADIENTS: Record<string, string> = {
  iron: "from-zinc-600 to-zinc-800",
  bronze: "from-amber-700 to-yellow-600",
  gold: "from-yellow-500 to-amber-300",
  diamond: "from-cyan-400 to-sky-200",
  lime: "from-lime-500 to-emerald-400",
  inferno: "from-red-600 to-orange-500",
  galaxy: "from-indigo-600 to-fuchsia-600",
  purple: "from-purple-600 to-violet-500",
};

export function bannerGradient(key: string | null | undefined): string | null {
  if (!key) return null;
  return BANNER_GRADIENTS[key] ?? null;
}

// Crowd-meter thresholds (active check-ins in the last 2 hours).
export const CROWD_LEVELS = {
  LOW_MAX: 5, // <= 5  → green (Not Busy)
  MED_MAX: 12, // <= 12 → yellow (Moderate)
  // > 12  → red (Very Busy)
} as const;

// Daily check-in PIN length.
export const PIN_LENGTH = 2;

// Roles that may access the admin command center.
export const STAFF_ROLES: UserRole[] = ["admin", "staff"];

// ----------------------------------------------------------------------------
//  Built-in workout presets
// ----------------------------------------------------------------------------

// A preset mirrors the Exercise shape but carries no machine link — members
// (or the coach) can attach machines later via the editor.
export type PresetExercise = {
  name: string;
  sets: number;
  reps: number;
};

export type WorkoutPreset = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  exercises: PresetExercise[];
};

// Hand-written starter routines. Members can use them as-is or "Customize"
// them into a saved plan. Machines are intentionally left blank so the member
// picks what their gym actually has during the session (via Swap Machine).

export function translatePresets<T extends (id: string, vars?: Record<string, string | number>) => string>(
  t: T
): WorkoutPreset[] {
  return WORKOUT_PRESETS.map((p) => ({
    ...p,
    name: t(`workout_presets.${p.id}.name` as any),
    description: t(`workout_presets.${p.id}.desc` as any),
  }));
}

export const WORKOUT_PRESETS: WorkoutPreset[] = [
  {
    id: "preset-push",
    name: "Push Day",
    description: "Chest, shoulders & triceps.",
    emoji: "💥",
    exercises: [
      { name: "Bench Press", sets: 4, reps: 8 },
      { name: "Overhead Press", sets: 3, reps: 10 },
      { name: "Incline Dumbbell Press", sets: 3, reps: 10 },
      { name: "Lateral Raise", sets: 3, reps: 12 },
      { name: "Triceps Pushdown", sets: 3, reps: 12 },
    ],
  },
  {
    id: "preset-pull",
    name: "Pull Day",
    description: "Back & biceps.",
    emoji: "🏋️",
    exercises: [
      { name: "Lat Pulldown", sets: 4, reps: 8 },
      { name: "Barbell Row", sets: 4, reps: 8 },
      { name: "Seated Cable Row", sets: 3, reps: 10 },
      { name: "Face Pull", sets: 3, reps: 15 },
      { name: "Biceps Curl", sets: 3, reps: 12 },
    ],
  },
  {
    id: "preset-legs",
    name: "Leg Day",
    description: "Quads, hamstrings & glutes.",
    emoji: "🦵",
    exercises: [
      { name: "Squat", sets: 4, reps: 8 },
      { name: "Romanian Deadlift", sets: 3, reps: 10 },
      { name: "Leg Press", sets: 3, reps: 12 },
      { name: "Leg Curl", sets: 3, reps: 12 },
      { name: "Calf Raise", sets: 4, reps: 15 },
    ],
  },
  {
    id: "preset-full-body",
    name: "Full Body",
    description: "Hit everything in one session.",
    emoji: "🔥",
    exercises: [
      { name: "Squat", sets: 3, reps: 8 },
      { name: "Bench Press", sets: 3, reps: 8 },
      { name: "Barbell Row", sets: 3, reps: 10 },
      { name: "Overhead Press", sets: 3, reps: 10 },
      { name: "Plank", sets: 3, reps: 45 },
    ],
  },
  {
    id: "preset-upper",
    name: "Upper Body",
    description: "Chest, back, shoulders & arms.",
    emoji: "💪",
    exercises: [
      { name: "Bench Press", sets: 4, reps: 8 },
      { name: "Lat Pulldown", sets: 4, reps: 8 },
      { name: "Overhead Press", sets: 3, reps: 10 },
      { name: "Seated Cable Row", sets: 3, reps: 10 },
      { name: "Biceps Curl", sets: 3, reps: 12 },
      { name: "Triceps Pushdown", sets: 3, reps: 12 },
    ],
  },
  {
    id: "preset-core",
    name: "Core & Abs",
    description: "Quick finisher or light day.",
    emoji: "🎯",
    exercises: [
      { name: "Plank", sets: 3, reps: 45 },
      { name: "Hanging Leg Raise", sets: 3, reps: 12 },
      { name: "Cable Crunch", sets: 3, reps: 15 },
      { name: "Russian Twist", sets: 3, reps: 20 },
    ],
  },
];
