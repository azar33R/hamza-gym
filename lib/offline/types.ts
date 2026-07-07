// ============================================================================
//  Offline layer — shared types
//  These describe the local IndexedDB snapshots + the pending-write queue.
//  Importing app row types (Profile, ChatMessage, ...) from lib/types.
// ============================================================================

import type {
  Profile,
  Exercise,
  Machine,
  UserWorkoutTemplate,
  WorkoutTemplate,
  Subscription,
  GymSettings,
} from "@/lib/types";
import type { WorkoutPreset } from "@/lib/constants";
import type { ChatContact } from "@/lib/chat-actions";

// A generic timestamped envelope for single-value stores (profile, settings…).
export type Timestamped<T> = {
  value: T;
  fetchedAt: string; // ISO — when this snapshot was pulled
};

// The crowd meter snapshot: live count + when we last knew it.
export type CrowdSnapshot = {
  count: number;
  fetchedAt: string;
};

// The check-in snapshot: the daily PIN + when it was fetched. Used offline to
// verify a typed PIN without hitting the server. Refreshed every 6h while online.
export type CheckInSnapshot = {
  pin: string;
  fetchedAt: string;
};

// Cached leaderboard: all three leaderboards in one envelope.
export type LeaderboardSnapshot = {
  monthlyXp: unknown[];
  ratio: unknown[];
  weight: unknown[];
  fetchedAt: string;
};

// Cached chat data: the inbox (contacts) + per-thread messages.
export type ChatCache = {
  contacts: ChatContact[];
  fetchedAt: string;
};

// Cached admin views (read-only offline): clients + triage queues + analytics.
export type AdminSnapshot = {
  clients: unknown;
  triage: unknown;
  analytics: unknown;
  fetchedAt: string;
};

// Per-thread cached messages, keyed by the other user's id.
export type CachedThread = {
  otherUserId: string;
  messages: import("@/lib/types").ChatMessage[];
  fetchedAt: string;
};

// Re-exported shapes that the workout chooser needs locally.
export type CachedWorkoutData = {
  coachTemplate: (WorkoutTemplate & { exercises: Exercise[] }) | null;
  coachTemplates: (WorkoutTemplate & { exercises: Exercise[] })[];
  myPlans: UserWorkoutTemplate[];
  weeklySchedule: { day: string; templateId: string | null; name: string | null }[];
  machines: Machine[];
  presets: WorkoutPreset[];
  checkedInToday: boolean;
  fetchedAt: string;
};

export type CachedDashboard = {
  profile: Profile | null;
  subscription: Subscription | null;
  crowd: CrowdSnapshot | null;
  announcement: { title: string; body: string | null; created_at: string } | null;
  sessions: { completed_at: string | null }[];
  todayCompleted: boolean;
  equippedNickname: string | null;
  equippedBannerKey: string | null;
  fetchedAt: string;
};

export type CachedSettings = GymSettings | null;

// --------------------------------------------------------------------------
//  Pending-write queue
//  Every offline mutation becomes one of these. Replayed by the sync engine.
// --------------------------------------------------------------------------

export type PendingOp =
  | { id: string; type: "checkin"; payload: { pin: string }; createdAt: string }
  | {
      id: string;
      type: "startSession";
      payload: { templateId: string | null };
      createdAt: string;
    }
  | {
      id: string;
      type: "logSet";
      payload: {
        sessionId: string;
        exerciseName: string;
        setNumber: number;
        weight: number | null;
        reps: number | null;
        machineId: string | null;
      };
      createdAt: string;
    }
  | {
      id: string;
      type: "completeWorkout";
      payload: { sessionId: string };
      createdAt: string;
    }
  | {
      id: string;
      type: "sendMessage";
      payload: { recipientId: string; body: string };
      createdAt: string;
    }
  | {
      id: string;
      type: "markThreadRead";
      payload: { otherUserId: string };
      createdAt: string;
    }
  | {
      id: string;
      type: "offlineWorkout";
      payload: {
        templateId: string | null;
        templateName: string;
        startedAt: string;
        completedAt: string;
        sets: {
          exerciseName: string;
          setNumber: number;
          weight: number | null;
          reps: number | null;
          machineId: string | null;
        }[];
      };
      createdAt: string;
    };

// A coarse status for a queued op. Anything not "done" is retried on sync.
export type QueueItem = PendingOp & { attempts: number; lastError?: string };
