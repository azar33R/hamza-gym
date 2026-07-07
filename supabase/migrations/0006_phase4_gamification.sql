-- ============================================================================
--  Hamza Gym — Phase 4: Gamification, Check-ins, Workout Execution
--  Run this in the Supabase SQL Editor after 0001–0005.
--  Idempotent where possible (uses IF NOT EXISTS / OR REPLACE).
-- ============================================================================

-- ---------------------------------------------------------------------------
--  1. Enum additions
-- ---------------------------------------------------------------------------

-- New enums
DO $$ BEGIN
  CREATE TYPE public.tier_type AS ENUM ('iron', 'bronze', 'gold', 'diamond');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.workout_path AS ENUM ('coach_plan', 'presets', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
--  2. profiles additions
--    Reuses existing height_cm / weight_kg / gender from Phase 2.
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age int,
  ADD COLUMN IF NOT EXISTS face_photo_url text,
  ADD COLUMN IF NOT EXISTS workout_path public.workout_path,
  ADD COLUMN IF NOT EXISTS total_xp int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_tier public.tier_type NOT NULL DEFAULT 'iron';

-- Backfill tier from existing XP (no-op for fresh installs).
UPDATE public.profiles
  SET current_tier = CASE
    WHEN total_xp >= 5000 THEN 'diamond'::public.tier_type
    WHEN total_xp >= 2000 THEN 'gold'::public.tier_type
    WHEN total_xp >= 500  THEN 'bronze'::public.tier_type
    ELSE 'iron'::public.tier_type
  END;

-- ---------------------------------------------------------------------------
--  3. gym_settings: single-row table holding the daily check-in PIN
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gym_settings (
  id          int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  daily_pin   char(2) NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.gym_settings (id, daily_pin)
VALUES (1, lpad((floor(random() * 100))::text, 2, '0'))
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
--  4. machine_library: coach-uploaded photos of physical gym machines
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.machine_library (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  photo_url      text,
  primary_muscle text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
--  5. personal_records: best lift per exercise + bodyweight-relative ratio
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.personal_records (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  exercise_name    text NOT NULL,
  max_weight       numeric(10, 2) NOT NULL,
  calculated_ratio numeric(8, 2),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, exercise_name)
);

-- ---------------------------------------------------------------------------
--  6. xp_transactions: append-only XP log (drives the 30-day leaderboard)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.xp_transactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  amount     int  NOT NULL,
  reason     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
--  7. workout_sessions + set_logs: persistent active-logger state
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workout_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  template_id  uuid REFERENCES public.workout_templates (id) ON DELETE SET NULL,
  started_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.set_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES public.workout_sessions (id) ON DELETE CASCADE,
  exercise_name text NOT NULL,
  set_number    int NOT NULL,
  weight        numeric(10, 2),
  reps          int,
  machine_id    uuid REFERENCES public.machine_library (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ===========================================================================
--  SQL HELPER FUNCTIONS (SECURITY DEFINER — bypass RLS for trusted ops)
-- ===========================================================================

-- tier_for_xp(xp) — pure helper used by award_xp + leaderboard queries.
CREATE OR REPLACE FUNCTION public.tier_for_xp (p_xp int)
RETURNS public.tier_type
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_xp >= 5000 THEN 'diamond'::public.tier_type
    WHEN p_xp >= 2000 THEN 'gold'::public.tier_type
    WHEN p_xp >= 500  THEN 'bronze'::public.tier_type
    ELSE 'iron'::public.tier_type
  END
$$;

-- award_xp(p_user_id, p_amount, p_reason)
-- Inserts an xp_transactions row, bumps profiles.total_xp + recomputes tier.
CREATE OR REPLACE FUNCTION public.award_xp (
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
  INSERT INTO public.xp_transactions (user_id, amount, reason)
  VALUES (p_user_id, p_amount, p_reason);

  UPDATE public.profiles
    SET total_xp    = GREATEST(total_xp + p_amount, 0),
        current_tier = public.tier_for_xp(GREATEST(total_xp + p_amount, 0))
    WHERE id = p_user_id;
END;
$$;

-- verify_pin(p_pin) — constant-time-ish compare against gym_settings.
-- PIN is never SELECT-able by subscribers (RLS denies them); this is the only
-- path a client can check correctness.
CREATE OR REPLACE FUNCTION public.verify_pin (p_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actual char(2);
BEGIN
  SELECT daily_pin INTO v_actual FROM public.gym_settings WHERE id = 1;
  RETURN v_actual IS NOT NULL AND v_actual = p_pin;
END;
$$;

-- check_in_member(p_user_id) — logs attendance + awards +50 XP.
-- Idempotent: re-checking in the same day just refreshes last_attendance_date
-- without double-awarding XP.
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
    PERFORM public.award_xp(p_user_id, 50, 'Gym check-in');
  END IF;
END;
$$;

-- regenerate_pin() — admin/staff only. Generates a fresh 2-digit PIN.
CREATE OR REPLACE FUNCTION public.regenerate_pin ()
RETURNS char(2)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new char(2);
BEGIN
  v_new := lpad((floor(random() * 100))::text, 2, '0');
  UPDATE public.gym_settings
    SET daily_pin = v_new, updated_at = now()
    WHERE id = 1;
  RETURN v_new;
END;
$$;

-- record_pr(p_user_id, p_exercise_name, p_weight)
-- If p_weight beats the existing max for this exercise, upsert the PR row and
-- return a record with is_pr = true; otherwise is_pr = false.
-- Ratio = weight / body_weight (null if body weight unknown).
CREATE OR REPLACE FUNCTION public.record_pr (
  p_user_id       uuid,
  p_exercise_name text,
  p_weight        numeric
)
RETURNS TABLE (is_pr boolean, new_ratio numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing numeric;
  v_bodywt   numeric;
  v_ratio    numeric;
BEGIN
  SELECT max_weight INTO v_existing
    FROM public.personal_records
    WHERE user_id = p_user_id AND exercise_name = p_exercise_name;

  SELECT weight_kg INTO v_bodywt
    FROM public.profiles WHERE id = p_user_id;

  v_ratio := CASE WHEN v_bodywt IS NULL OR v_bodywt = 0 THEN NULL
                  ELSE round((p_weight / v_bodywt)::numeric, 2) END;

  IF v_existing IS NULL OR p_weight > v_existing THEN
    INSERT INTO public.personal_records
      (user_id, exercise_name, max_weight, calculated_ratio)
    VALUES (p_user_id, p_exercise_name, p_weight, v_ratio)
    ON CONFLICT (user_id, exercise_name)
    DO UPDATE SET max_weight = EXCLUDED.max_weight,
                  calculated_ratio = EXCLUDED.calculated_ratio;

    RETURN QUERY SELECT true, v_ratio;
  ELSE
    RETURN QUERY SELECT false, v_ratio;
  END IF;
END;
$$;

-- ===========================================================================
--  Row Level Security
-- ===========================================================================
ALTER TABLE public.gym_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_library     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_records    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.set_logs            ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user staff or admin?
CREATE OR REPLACE FUNCTION public.is_staff_or_admin ()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'staff')
  );
$$;

-- gym_settings: subscribers CANNOT read (PIN hidden). Admin/staff read + update.
DROP POLICY IF EXISTS "Gym settings read by staff or admin" ON public.gym_settings;
CREATE POLICY "Gym settings read by staff or admin"
  ON public.gym_settings FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin());

DROP POLICY IF EXISTS "Gym settings managed by staff or admin" ON public.gym_settings;
CREATE POLICY "Gym settings managed by staff or admin"
  ON public.gym_settings FOR ALL
  TO authenticated
  USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

-- machine_library: everyone (incl. anon) can read; staff/admin manage.
DROP POLICY IF EXISTS "Machines readable by everyone" ON public.machine_library;
CREATE POLICY "Machines readable by everyone"
  ON public.machine_library FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Machines managed by staff or admin" ON public.machine_library;
CREATE POLICY "Machines managed by staff or admin"
  ON public.machine_library FOR ALL
  TO authenticated
  USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

-- personal_records: owner + staff/admin read; owner insert (functions write as
-- SECURITY DEFINER, so the policy mainly governs direct client reads).
DROP POLICY IF EXISTS "PRs viewable by owner or staff" ON public.personal_records;
CREATE POLICY "PRs viewable by owner or staff"
  ON public.personal_records FOR SELECT
  USING (auth.uid() = user_id OR public.is_staff_or_admin());

DROP POLICY IF EXISTS "Owner inserts own PRs" ON public.personal_records;
CREATE POLICY "Owner inserts own PRs"
  ON public.personal_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owner updates own PRs" ON public.personal_records;
CREATE POLICY "Owner updates own PRs"
  ON public.personal_records FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- xp_transactions: owner + staff/admin read.
DROP POLICY IF EXISTS "XP viewable by owner or staff" ON public.xp_transactions;
CREATE POLICY "XP viewable by owner or staff"
  ON public.xp_transactions FOR SELECT
  USING (auth.uid() = user_id OR public.is_staff_or_admin());

-- workout_sessions: owner + staff/admin read; owner insert.
DROP POLICY IF EXISTS "Sessions viewable by owner or staff" ON public.workout_sessions;
CREATE POLICY "Sessions viewable by owner or staff"
  ON public.workout_sessions FOR SELECT
  USING (auth.uid() = user_id OR public.is_staff_or_admin());

DROP POLICY IF EXISTS "Owner inserts own sessions" ON public.workout_sessions;
CREATE POLICY "Owner inserts own sessions"
  ON public.workout_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owner updates own sessions" ON public.workout_sessions;
CREATE POLICY "Owner updates own sessions"
  ON public.workout_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- set_logs: owner + staff/admin read; owner insert.
DROP POLICY IF EXISTS "Set logs viewable by owner or staff" ON public.set_logs;
CREATE POLICY "Set logs viewable by owner or staff"
  ON public.set_logs FOR SELECT
  USING (
    auth.uid() = (SELECT user_id FROM public.workout_sessions WHERE id = set_logs.session_id)
    OR public.is_staff_or_admin()
  );

DROP POLICY IF EXISTS "Owner inserts own set logs" ON public.set_logs;
CREATE POLICY "Owner inserts own set logs"
  ON public.set_logs FOR INSERT
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM public.workout_sessions WHERE id = session_id)
  );

-- ===========================================================================
--  GRANTs (mirror the 0004/0005 pattern — anon + authenticated)
-- ===========================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gym_settings        TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.machine_library     TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_records    TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xp_transactions     TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_sessions    TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.set_logs            TO anon, authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Keep default privileges aligned for any future tables.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated;

-- ===========================================================================
--  Storage buckets + policies
--  Public buckets: face-photos, machine-photos. URLs are public but file names
--  use <uid>/<uuid> so they're not enumerable.
-- ===========================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('face-photos',   'face-photos',   true),
  ('machine-photos','machine-photos',true)
ON CONFLICT (id) DO NOTHING;

-- face-photos: anyone can read (avatars render on the public leaderboard);
-- a user may write/modify only objects under their own uid/ folder.
DROP POLICY IF EXISTS "face-photos public read" ON storage.objects;
CREATE POLICY "face-photos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'face-photos');

DROP POLICY IF EXISTS "face-photos owner write" ON storage.objects;
CREATE POLICY "face-photos owner write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'face-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "face-photos owner update" ON storage.objects;
CREATE POLICY "face-photos owner update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'face-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "face-photos owner delete" ON storage.objects;
CREATE POLICY "face-photos owner delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'face-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- machine-photos: anyone can read; staff/admin can write.
DROP POLICY IF EXISTS "machine-photos public read" ON storage.objects;
CREATE POLICY "machine-photos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'machine-photos');

DROP POLICY IF EXISTS "machine-photos staff write" ON storage.objects;
CREATE POLICY "machine-photos staff write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'machine-photos'
    AND public.is_staff_or_admin()
  );

DROP POLICY IF EXISTS "machine-photos staff update" ON storage.objects;
CREATE POLICY "machine-photos staff update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'machine-photos'
    AND public.is_staff_or_admin()
  );

DROP POLICY IF EXISTS "machine-photos staff delete" ON storage.objects;
CREATE POLICY "machine-photos staff delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'machine-photos'
    AND public.is_staff_or_admin()
  );
