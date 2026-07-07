"use client";

// ============================================================================
//  Sync engine — the heart of the offline layer.
//
//  Two responsibilities, both run when the app is online + focused:
//    1. REFRESH: pull a fresh snapshot from the server, write to IndexedDB.
//    2. REPLAY: drain the pending-write queue, applying each op idempotently.
//
//  Triggers: app mount, window focus, visibilitychange, the browser `online`
//  event, and Background Sync (Android Chrome — the SW registers it).
//  iOS Safari lacks Background Sync, so this foreground-driven sync is what
//  makes offline workouts reliably reconcile on iPhones.
// ============================================================================

import {
  getQueue,
  removeFromQueue,
  updateQueueItem,
  getQueueCount,
} from "./db";
import { writeSnapshot } from "./snapshot";
import { pullSnapshot, applyQueuedOp } from "./snapshot-actions";
import type { QueueItem } from "./types";

// Minimum gap between automatic full refreshes — avoids hammering the server
// on every focus. Manual syncNow() ignores this.
const MIN_REFRESH_GAP_MS = 60 * 1000; // 1 minute

let lastRefresh = 0;
let inflight: Promise<SyncResult> | null = null;

export type SyncResult = {
  refreshed: boolean;
  replayed: number;
  remaining: number;
  errors: string[];
};

// Pull a fresh snapshot + drain the queue. Deduped — concurrent callers share
// one inflight pass.
export async function syncNow(force = false): Promise<SyncResult> {
  if (!navigator.onLine) {
    return { refreshed: false, replayed: 0, remaining: await getQueueCount(), errors: [] };
  }
  if (inflight) return inflight;

  inflight = (async () => {
    const result: SyncResult = { refreshed: false, replayed: 0, remaining: 0, errors: [] };

    // ---- 1. Refresh snapshot ----
    const shouldRefresh = force || Date.now() - lastRefresh > MIN_REFRESH_GAP_MS;
    if (shouldRefresh) {
      try {
        const { payload, error } = await pullSnapshot();
        if (error) {
          result.errors.push(error);
        } else if (payload) {
          await writeSnapshot(payload);
          lastRefresh = Date.now();
          result.refreshed = true;
        }
      } catch (e) {
        result.errors.push(e instanceof Error ? e.message : "Snapshot failed.");
      }
    }

    // ---- 2. Replay queue ----
    try {
      const queue = await getQueue();
      for (const item of queue) {
        try {
          const { ok, error } = await applyQueuedOp(item);
          if (ok) {
            await removeFromQueue(item.id);
            result.replayed++;
          } else {
            // Non-fatal failure (e.g. transient network blip) — bump attempts
            // and leave it queued for the next sync pass.
            await updateQueueItem(item.id, {
              attempts: item.attempts + 1,
              lastError: error,
            });
            if (error) result.errors.push(`${item.type}: ${error}`);
          }
        } catch (e) {
          await updateQueueItem(item.id, {
            attempts: item.attempts + 1,
            lastError: e instanceof Error ? e.message : "Unknown",
          });
        }
      }
      result.remaining = await getQueueCount();
    } catch (e) {
      result.errors.push(e instanceof Error ? e.message : "Replay failed.");
    }

    return result;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

// Just the replay half — used after a write is queued while online so it
// flushes immediately rather than waiting for the next focus/interval.
export async function flushQueue(): Promise<number> {
  if (!navigator.onLine) return 0;
  const queue = await getQueue();
  let replayed = 0;
  for (const item of queue) {
    try {
      const { ok } = await applyQueuedOp(item);
      if (ok) {
        await removeFromQueue(item.id);
        replayed++;
      }
    } catch {
      // leave queued
    }
  }
  return replayed;
}

// Are there any pending writes the user should know about?
export async function pendingWritesExist(): Promise<boolean> {
  return (await getQueueCount()) > 0;
}

// Peek the queue (for UI badges / debugging).
export async function peekQueue(): Promise<QueueItem[]> {
  return getQueue();
}
