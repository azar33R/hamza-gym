"use client";

import { useEffect, useState } from "react";
import { getLeaderboardData, type LeaderboardPageData } from "@/app/(subscriber)/tab-actions";
import { createClient } from "@/lib/supabase/client";
import { Leaderboard } from "@/components/subscriber/leaderboard";
import { useTabContext } from "@/app/(subscriber)/tab-context";

export function LeaderboardTab() {
  const [data, setData] = useState<LeaderboardPageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const { notifyReady, initialTab } = useTabContext();
  const id = "leaderboard" as const;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
    getLeaderboardData().then((res) => {
      if (res.error) setError(res.error);
      else setData(res.data);
      if (initialTab === id) notifyReady(id);
    });
  }, [initialTab, notifyReady]);

  if (error) {
    if (initialTab === id) notifyReady(id);
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-zinc-500">
        {error}
      </div>
    );
  }

  if (!data || !userId) return null;

  return (
    <Leaderboard
      currentUserId={userId}
      points={data.points}
      ratio={data.ratio}
      weight={data.weight}
    />
  );
}
