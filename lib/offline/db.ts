// ============================================================================
//  IndexedDB wrapper (via idb) — the local store for the offline layer.
//
//  Stores:
//   - kv         : single-value snapshots keyed by name (profile, gymSettings…)
//   - threads    : cached chat threads, keyed by the other user's id
//   - queue      : pending offline writes, keyed by client-generated id
// ============================================================================

import { openDB, type IDBPDatabase } from "idb";
import type {
  Timestamped,
  CrowdSnapshot,
  CheckInSnapshot,
  LeaderboardSnapshot,
  ChatCache,
  AdminSnapshot,
  CachedThread,
  CachedWorkoutData,
  CachedDashboard,
  QueueItem,
} from "./types";

// Bump when the schema changes — the SW + this module migrate together.
const DB_NAME = "hamza-gym-offline";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("kv")) {
          db.createObjectStore("kv");
        }
        if (!db.objectStoreNames.contains("threads")) {
          db.createObjectStore("threads", { keyPath: "otherUserId" });
        }
        if (!db.objectStoreNames.contains("queue")) {
          db.createObjectStore("queue", { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

// Whether IndexedDB is usable at all (SSR + very old browsers).
export function offlineStorageAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

// --------------------------------------------------------------------------
//  Key/value snapshots — generic helpers
// --------------------------------------------------------------------------

export async function kvGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await getDB();
    return (await db.get("kv", key)) as T | undefined;
  } catch {
    return undefined;
  }
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  try {
    const db = await getDB();
    await db.put("kv", value, key);
  } catch {
    // Storage failures degrade gracefully — offline still works in-memory.
  }
}

export async function kvDel(key: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete("kv", key);
  } catch {
    // ignore
  }
}

// --------------------------------------------------------------------------
//  Typed snapshot accessors — thin wrappers over kv for readability.
// --------------------------------------------------------------------------

export const getProfile = () => kvGet<Timestamped<import("@/lib/types").Profile>>("profile");
export const setProfile = (value: Timestamped<import("@/lib/types").Profile>) =>
  kvSet("profile", value);

export const getSubscription = () =>
  kvGet<Timestamped<import("@/lib/types").Subscription>>("subscription");
export const setSubscription = (
  value: Timestamped<import("@/lib/types").Subscription>
) => kvSet("subscription", value);

export const getGymSettings = () => kvGet<Timestamped<import("@/lib/types").GymSettings>>("gymSettings");
export const setGymSettings = (value: Timestamped<import("@/lib/types").GymSettings>) =>
  kvSet("gymSettings", value);

export const getCrowd = () => kvGet<CrowdSnapshot>("crowd");
export const setCrowd = (value: CrowdSnapshot) => kvSet("crowd", value);

export const getCheckIn = () => kvGet<CheckInSnapshot>("checkIn");
export const setCheckIn = (value: CheckInSnapshot) => kvSet("checkIn", value);

export const getLeaderboard = () => kvGet<LeaderboardSnapshot>("leaderboard");
export const setLeaderboard = (value: LeaderboardSnapshot) => kvSet("leaderboard", value);

export const getChatCache = () => kvGet<ChatCache>("chat");
export const setChatCache = (value: ChatCache) => kvSet("chat", value);

export const getAdminSnapshot = () => kvGet<AdminSnapshot>("admin");
export const setAdminSnapshot = (value: AdminSnapshot) => kvSet("admin", value);

export const getWorkoutData = () => kvGet<CachedWorkoutData>("workoutData");
export const setWorkoutData = (value: CachedWorkoutData) => kvSet("workoutData", value);

export const getDashboard = () => kvGet<CachedDashboard>("dashboard");
export const setDashboard = (value: CachedDashboard) => kvSet("dashboard", value);

export const getLastSynced = () => kvGet<string>("lastSyncedAt");
export const setLastSynced = (value: string) => kvSet("lastSyncedAt", value);

// --------------------------------------------------------------------------
//  Chat threads (one entry per conversation partner)
// --------------------------------------------------------------------------

export async function getThread(otherUserId: string): Promise<CachedThread | undefined> {
  try {
    const db = await getDB();
    return (await db.get("threads", otherUserId)) as CachedThread | undefined;
  } catch {
    return undefined;
  }
}

export async function setThread(thread: CachedThread): Promise<void> {
  try {
    const db = await getDB();
    await db.put("threads", thread);
  } catch {
    // ignore
  }
}

export async function getAllThreads(): Promise<CachedThread[]> {
  try {
    const db = await getDB();
    return (await db.getAll("threads")) as CachedThread[];
  } catch {
    return [];
  }
}

// --------------------------------------------------------------------------
//  Pending-write queue
// --------------------------------------------------------------------------

export async function enqueue(item: QueueItem): Promise<void> {
  try {
    const db = await getDB();
    await db.put("queue", item);
  } catch {
    // If we can't persist the queue, the write is lost on offline — but the
    // UI already gave feedback. Acceptable degradation.
  }
}

export async function getQueue(): Promise<QueueItem[]> {
  try {
    const db = await getDB();
    return (await db.getAll("queue")) as QueueItem[];
  } catch {
    return [];
  }
}

export async function removeFromQueue(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete("queue", id);
  } catch {
    // ignore
  }
}

export async function updateQueueItem(id: string, patch: Partial<QueueItem>): Promise<void> {
  try {
    const db = await getDB();
    const existing = (await db.get("queue", id)) as QueueItem | undefined;
    if (existing) {
      await db.put("queue", { ...existing, ...patch });
    }
  } catch {
    // ignore
  }
}

export async function getQueueCount(): Promise<number> {
  try {
    const db = await getDB();
    return await db.count("queue");
  } catch {
    return 0;
  }
}

export async function clearQueue(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear("queue");
  } catch {
    // ignore
  }
}
