import { createClient } from "@/lib/supabase/server";
import { Leaderboard } from "@/components/subscriber/leaderboard";
import {
  pointsLeaderboard,
  ratioLeaderboard,
  weightLeaderboard,
} from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [points, ratio, weight] = await Promise.all([
    pointsLeaderboard(),
    ratioLeaderboard(),
    weightLeaderboard(),
  ]);

  return (
    <Leaderboard
      currentUserId={user!.id}
      points={points}
      ratio={ratio}
      weight={weight}
    />
  );
}
