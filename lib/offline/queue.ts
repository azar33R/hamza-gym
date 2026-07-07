// ============================================================================
//  Pending-write queue — high-level helpers.
//  Components call these to record an offline mutation; the sync engine
//  replays them when back online.
// ============================================================================

import { enqueue, getQueueCount } from "./db";
import type { QueueItem, PendingOp } from "./types";

// Generate a reasonably-unique client id without depending on crypto.randomUUID
// (older Safari). Combines timestamp + randomness.
export function genId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return rand;
}

function make<T extends PendingOp["type"]>(
  type: T,
  payload: Extract<PendingOp, { type: T }>["payload"]
): QueueItem {
  const id = genId();
  return {
    id,
    type,
    payload: payload as never,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
}

// ---- Public enqueue helpers ----------------------------------------------

export async function queueCheckIn(pin: string): Promise<QueueItem> {
  const item = make("checkin", { pin });
  await enqueue(item);
  return item;
}

export async function queueStartSession(templateId: string | null): Promise<QueueItem> {
  const item = make("startSession", { templateId });
  await enqueue(item);
  return item;
}

export async function queueLogSet(payload: {
  sessionId: string;
  exerciseName: string;
  setNumber: number;
  weight: number | null;
  reps: number | null;
  machineId: string | null;
}): Promise<QueueItem> {
  const item = make("logSet", payload);
  await enqueue(item);
  return item;
}

export async function queueCompleteWorkout(sessionId: string): Promise<QueueItem> {
  const item = make("completeWorkout", { sessionId });
  await enqueue(item);
  return item;
}

// A self-contained offline workout: the start + all sets + the completion as
// ONE op, so the server can create the session row and link its set_logs in a
// single consistent replay (avoiding dangling FK references to a client id).
export async function queueOfflineWorkout(payload: {
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
}): Promise<QueueItem> {
  const item = make("offlineWorkout", payload);
  await enqueue(item);
  return item;
}

export async function queueSendMessage(
  recipientId: string,
  body: string
): Promise<QueueItem> {
  const item = make("sendMessage", { recipientId, body });
  await enqueue(item);
  return item;
}

export async function queueMarkThreadRead(otherUserId: string): Promise<QueueItem> {
  const item = make("markThreadRead", { otherUserId });
  await enqueue(item);
  return item;
}

export async function pendingCount(): Promise<number> {
  return getQueueCount();
}
