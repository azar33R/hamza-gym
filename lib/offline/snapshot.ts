"use client";

// ============================================================================
//  Client-side snapshot writer — takes a payload from pullSnapshot() and
//  writes it into the IndexedDB stores. Lives separately from sync.ts so the
//  server-component pages can also call it after their initial render.
// ============================================================================

import {
  setProfile,
  setSubscription,
  setCrowd,
  setCheckIn,
  setLeaderboard,
  setChatCache,
  setThread,
  setWorkoutData,
  setDashboard,
  setLastSynced,
  setGymSettings,
} from "./db";
import { WORKOUT_PRESETS } from "@/lib/constants";
import type { SnapshotPayload } from "./snapshot-actions";

const now = () => new Date().toISOString();

export async function writeSnapshot(payload: SnapshotPayload): Promise<void> {
  const fetchedAt = now();

  await Promise.all([
    payload.profile
      ? setProfile({ value: payload.profile, fetchedAt })
      : Promise.resolve(),
    payload.subscription
      ? setSubscription({ value: payload.subscription, fetchedAt })
      : Promise.resolve(),
    payload.crowdCount != null
      ? setCrowd({ count: payload.crowdCount, fetchedAt })
      : Promise.resolve(),
    payload.gymSettings
      ? setCheckIn({ pin: payload.gymSettings.daily_pin, fetchedAt })
      : Promise.resolve(),
    payload.gymSettings
      ? setGymSettings({
          value: {
            id: 1,
            daily_pin: payload.gymSettings.daily_pin,
            updated_at: fetchedAt,
          },
          fetchedAt,
        })
      : Promise.resolve(),
    setLeaderboard({
      monthlyXp: payload.leaderboardMonthlyXp,
      ratio: payload.leaderboardRatio,
      weight: payload.leaderboardWeight,
      fetchedAt,
    }),
    setChatCache({ contacts: payload.chatContacts, fetchedAt }),
    setWorkoutData({
      coachTemplate: payload.coachTemplate,
      coachTemplates: payload.coachTemplates,
      myPlans: payload.myPlans,
      weeklySchedule: payload.weeklySchedule,
      machines: payload.machines,
      presets: WORKOUT_PRESETS,
      checkedInToday: payload.checkedInToday,
      fetchedAt,
    }),
    setDashboard({
      profile: payload.profile,
      subscription: payload.subscription,
      crowd: payload.crowdCount != null
        ? { count: payload.crowdCount, fetchedAt }
        : null,
      announcement: payload.announcement,
      sessions: payload.sessions,
      todayCompleted: payload.todayCompleted,
      equippedNickname: payload.equippedNickname,
      equippedBannerKey: payload.equippedBannerKey,
      fetchedAt,
    }),
    // Per-thread messages.
    Promise.all(
      payload.threads.map((t) =>
        setThread({ otherUserId: t.otherUserId, messages: t.messages, fetchedAt })
      )
    ),
    setLastSynced(fetchedAt),
  ]);
}
