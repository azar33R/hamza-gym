-- ============================================================================
--  Hamza Gym — 0015: Points system rework (single spendable balance)
--
--  ONE points number per member. Earning a workout / check-in / PR raises it;
--  buying a cosmetic (nickname/banner) lowers it. The leaderboard ranks this
--  exact number, and tier is derived from it too — so spending genuinely
--  matters and there is no hidden "lifetime" tally that masks consumption.
--
--    profiles.points           — the single spendable balance (was total_xp)
--    point_transactions        — append-only ledger (was xp_transactions)
--       kind 'earn'  → +points
--       kind 'spend' → -points (stored as a negative amount)
--    current_tier              — recomputed from points on every earn AND spend
--
--  Leaderboard = profiles.points ordered desc (profiles SELECT is already open
--  to all authenticated users per 0011, so the board finally shows data).
--
--  Idempotent. Run in the Supabase SQL Editor after 0001–0014.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  1. profiles: total_xp → points (single balance)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS points int NOT NULL DEFAULT 0;

-- Migrate legacy total_xp into points.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'total_xp'
  ) THEN
    UPDATE public.profiles SET points = total_xp;
  END IF;
END $$;

-- Drop the legacy column now that the data is migrated.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS total_xp;

-- ---------------------------------------------------------------------------
--  2. xp_transactions → point_transactions (+ kind, related_cosmetic_id)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'xp_transactions'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'point_transactions'
  ) THEN
    ALTER TABLE public.xp_transactions RENAME TO point_transactions;
  END IF;
END $$;

ALTER TABLE public.point_transactions
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'earn';

DO $$ BEGIN
  ALTER TABLE public.point_transactions
    ADD CONSTRAINT point_transactions_kind_check
    CHECK (kind IN ('earn', 'spend'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Link a spend row to the cosmetic that was bought (nullable; earns are null).
ALTER TABLE public.point_transactions
  ADD COLUMN IF NOT EXISTS related_cosmetic_id uuid;

-- Existing legacy rows are all earns.
UPDATE public.point_transactions SET kind = 'earn' WHERE kind IS NULL OR kind = '';

-- ---------------------------------------------------------------------------
--  3. SQL helper functions
-- ---------------------------------------------------------------------------

-- tier_for_points(points) — pure helper. Thresholds unchanged from tier_for_xp.
CREATE OR REPLACE FUNCTION public.tier_for_points (p_points int)
RETURNS public.tier_type
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_points >= 5000 THEN 'diamond'::public.tier_type
    WHEN p_points >= 2000 THEN 'gold'::public.tier_type
    WHEN p_points >= 500  THEN 'bronze'::public.tier_type
    ELSE 'iron'::public.tier_type
  END
$$;

-- Keep the old name as a thin alias so any stray callers keep working.
CREATE OR REPLACE FUNCTION public.tier_for_xp (p_xp int)
RETURNS public.tier_type
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.tier_for_points(p_xp);
$$;

-- award_points(p_user_id, p_amount, p_reason)
-- Adds points, recomputes tier, and writes an 'earn' ledger row. Replaces award_xp.
CREATE OR REPLACE FUNCTION public.award_points (
  p_user_id uuid,
  p_amount  int,
  p_reason  text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.point_transactions (user_id, amount, reason, kind)
  VALUES (p_user_id, p_amount, p_reason, 'earn');

  UPDATE public.profiles
    SET points       = GREATEST(points + p_amount, 0),
        current_tier = public.tier_for_points(GREATEST(points + p_amount, 0))
    WHERE id = p_user_id;
END;
$$;

-- Backwards-compatible alias.
CREATE OR REPLACE FUNCTION public.award_xp (
  p_user_id uuid,
  p_amount  int,
  p_reason  text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.award_points(p_user_id, p_amount, p_reason);
$$;

-- spend_points(p_user_id, p_amount, p_reason, p_cosmetic_id)
-- Atomically debits points if sufficient. Writes a 'spend' row (negative amount)
-- and recomputes tier (so spending can lower your tier, by design).
-- Returns ok=true with the new balance, or ok=false if funds are short.
CREATE OR REPLACE FUNCTION public.spend_points (
  p_user_id     uuid,
  p_amount      int,
  p_reason      text,
  p_cosmetic_id uuid DEFAULT NULL
)
RETURNS TABLE (ok boolean, new_balance int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance int;
BEGIN
  SELECT points INTO v_balance
    FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  IF v_balance < p_amount THEN
    RETURN QUERY SELECT false, v_balance;
    RETURN;
  END IF;

  UPDATE public.profiles
    SET points       = points - p_amount,
        current_tier = public.tier_for_points(points - p_amount)
    WHERE id = p_user_id;

  INSERT INTO public.point_transactions
    (user_id, amount, reason, kind, related_cosmetic_id)
  VALUES (p_user_id, -p_amount, p_reason, 'spend', p_cosmetic_id);

  RETURN QUERY SELECT true, v_balance - p_amount;
END;
$$;

-- ---------------------------------------------------------------------------
--  4. check_in_member now awards points via award_points
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_in_member (p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_already boolean;
BEGIN
  SELECT (last_attendance_date = current_date) INTO v_already
    FROM public.profiles WHERE id = p_user_id;

  INSERT INTO public.attendance_log (user_id, checked_in_at)
  VALUES (p_user_id, now());

  UPDATE public.profiles
    SET last_attendance_date = current_date
    WHERE id = p_user_id;

  IF NOT COALESCE(v_already, false) THEN
    PERFORM public.award_points(p_user_id, 50, 'Gym check-in');
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
--  5. RLS — point_transactions readable by all authenticated users
--    (defense-in-depth history view; the leaderboard itself reads profiles,
--    which is already open per 0011). Direct client inserts stay owner-only.
-- ---------------------------------------------------------------------------
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "XP viewable by owner or staff" ON public.point_transactions;
DROP POLICY IF EXISTS "Point transactions readable by any authenticated user"
  ON public.point_transactions;

CREATE POLICY "Point transactions readable by any authenticated user"
  ON public.point_transactions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Owner inserts own point transactions"
  ON public.point_transactions;
CREATE POLICY "Owner inserts own point transactions"
  ON public.point_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
--  6. GRANTs (mirror the 0006/0007 pattern — anon + authenticated + service)
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.point_transactions
  TO anon, authenticated, service_role;
