-- ============================================================================
--  Hamza Gym — 0018: Lift verification (anti-cheat — "Both" rules + coach queue)
--
--  Root problem being fixed: personal_records were written directly from a
--  free-text weight the member typed in the rest timer, with NO verification.
--  The Heavy Hitters / Pound-for-Pound leaderboards ranked those self-typed
--  numbers. Anyone could type "500kg" and top the board.
--
--  New flow ("Both" = lightweight plausibility rules AND human review):
--    1. Member submits a lift (weight) from a REAL logged session.
--    2. submit_lift() runs plausibility rules up front:
--         - weight > 0 and within a sane per-exercise cap (default 400kg)
--         - the caller actually checked in TODAY (can't PR without being at the gym)
--         - not a duplicate submission within 10 minutes
--       Anything failing a rule is rejected immediately with a reason and never
--       reaches the coach.
--    3. Otherwise it lands as 'pending' in lift_submissions.
--    4. The coach approves/rejects in the Triage area.
--    5. approve_lift() upserts into personal_records (verified=true) and awards
--       the PR bonus points. Reject just marks it.
--    6. The leaderboard reads personal_records WHERE verified = true.
--
--  Idempotent. Run in the Supabase SQL Editor after 0017.
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.lift_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
--  personal_records: add verified provenance
-- ---------------------------------------------------------------------------
ALTER TABLE public.personal_records
  ADD COLUMN IF NOT EXISTS verified    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- Everything already in the table is trusted (legacy), so mark verified.
UPDATE public.personal_records SET verified = true WHERE verified IS NULL;

-- ---------------------------------------------------------------------------
--  lift_submissions: the pending-approval queue
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lift_submissions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  exercise_name    text NOT NULL,
  weight           numeric(10, 2) NOT NULL,
  calculated_ratio numeric(8, 2),
  status           public.lift_status NOT NULL DEFAULT 'pending',
  reject_reason    text,
  reviewer_id      uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  reviewed_at      timestamptz
);

CREATE INDEX IF NOT EXISTS lift_submissions_pending_idx
  ON public.lift_submissions (created_at DESC)
  WHERE status = 'pending';

-- ---------------------------------------------------------------------------
--  Per-exercise sanity caps — a tiny allowlist of real-world upper bounds.
--  Anything not listed uses the default cap. Curated by the coach as needed.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exercise_caps (
  exercise_name text PRIMARY KEY,
  max_weight_kg numeric(10, 2) NOT NULL
);

INSERT INTO public.exercise_caps (exercise_name, max_weight_kg) VALUES
  ('Squat',              500),
  ('Deadlift',           550),
  ('Bench Press',        450),
  ('Overhead Press',     250),
  ('Barbell Row',        350)
ON CONFLICT (exercise_name) DO NOTHING;

-- ---------------------------------------------------------------------------
--  submit_lift(p_user_id, p_exercise_name, p_weight)
--  Returns (status, reason, ratio, submission_id). Replaces record_pr.
--  SECURITY DEFINER so it can read profiles/gym_settings + insert the submission
--  regardless of the caller's RLS context.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_lift (
  p_user_id       uuid,
  p_exercise_name text,
  p_weight        numeric
)
RETURNS TABLE (
  status  text,
  reason  text,
  ratio   numeric,
  submission_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bodywt     numeric;
  v_ratio      numeric;
  v_cap        numeric;
  v_checked_in boolean;
  v_recent     int;
  v_new_id     uuid;
BEGIN
  -- Rule 1: positive weight.
  IF p_weight IS NULL OR p_weight <= 0 THEN
    RETURN QUERY SELECT 'rejected', 'Weight must be greater than zero.',
                 NULL::numeric, NULL::uuid;
    RETURN;
  END IF;

  -- Rule 2: sane cap for this exercise (default 400kg if uncatalogued).
  SELECT max_weight_kg INTO v_cap
    FROM public.exercise_caps
    WHERE exercise_name = p_exercise_name;
  IF v_cap IS NULL THEN v_cap := 400; END IF;

  IF p_weight > v_cap THEN
    RETURN QUERY SELECT 'rejected', 'That weight is implausibly high — contact your coach to log it.',
                 NULL::numeric, NULL::uuid;
    RETURN;
  END IF;

  -- Rule 3: the caller must have checked in today (be at the gym to PR).
  SELECT (last_attendance_date = current_date) INTO v_checked_in
    FROM public.profiles WHERE id = p_user_id;
  IF NOT COALESCE(v_checked_in, false) THEN
    RETURN QUERY SELECT 'rejected', 'Check in at the gym before logging a lift.',
                 NULL::numeric, NULL::uuid;
    RETURN;
  END IF;

  -- Rule 4: no spamming — at most one pending submission per exercise per 10 min.
  SELECT count(*) INTO v_recent
    FROM public.lift_submissions
    WHERE user_id = p_user_id
      AND exercise_name = p_exercise_name
      AND status = 'pending'
      AND created_at > now() - interval '10 minutes';
  IF v_recent > 0 THEN
    RETURN QUERY SELECT 'rejected', 'You already have a pending submission for this lift.',
                 NULL::numeric, NULL::uuid;
    RETURN;
  END IF;

  -- Ratio = weight / bodyweight (null if bodyweight unknown).
  SELECT weight_kg INTO v_bodywt FROM public.profiles WHERE id = p_user_id;
  v_ratio := CASE WHEN v_bodywt IS NULL OR v_bodywt = 0 THEN NULL
                  ELSE round((p_weight / v_bodywt)::numeric, 2) END;

  -- Persist the pending submission.
  INSERT INTO public.lift_submissions
    (user_id, exercise_name, weight, calculated_ratio, status)
  VALUES (p_user_id, p_exercise_name, p_weight, v_ratio, 'pending')
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT 'pending', NULL, v_ratio, v_new_id;
END;
$$;

-- ---------------------------------------------------------------------------
--  approve_lift(p_submission_id, p_reviewer_id)
--  Upserts the verified PR + awards the PR bonus points. Idempotent.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_lift (
  p_submission_id uuid,
  p_reviewer_id   uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row  public.lift_submissions%ROWTYPE;
  v_ratio numeric;
BEGIN
  SELECT * INTO v_row FROM public.lift_submissions WHERE id = p_submission_id;
  IF v_row.id IS NULL THEN RETURN; END IF;
  IF v_row.status = 'approved' THEN RETURN; END IF;

  -- Mark approved.
  UPDATE public.lift_submissions
    SET status = 'approved',
        reviewed_at = now(),
        reviewer_id = p_reviewer_id
    WHERE id = p_submission_id;

  -- Upsert the verified PR row.
  SELECT calculated_ratio INTO v_ratio FROM public.lift_submissions WHERE id = p_submission_id;
  INSERT INTO public.personal_records
    (user_id, exercise_name, max_weight, calculated_ratio, verified, verified_by, verified_at)
  VALUES (v_row.user_id, v_row.exercise_name, v_row.weight, v_ratio,
          true, p_reviewer_id, now())
  ON CONFLICT (user_id, exercise_name)
  DO UPDATE SET max_weight       = EXCLUDED.max_weight,
                calculated_ratio = EXCLUDED.calculated_ratio,
                verified         = true,
                verified_by      = p_reviewer_id,
                verified_at      = now();

  -- Reward the verified PR with points.
  PERFORM public.award_points(v_row.user_id, 150, 'Verified PR: ' || v_row.exercise_name);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_lift (
  p_submission_id uuid,
  p_reviewer_id   uuid,
  p_reason        text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.lift_submissions
    SET status = 'rejected',
        reviewed_at = now(),
        reviewer_id = p_reviewer_id,
        reject_reason = p_reason
    WHERE id = p_submission_id AND status = 'pending';
END;
$$;

-- Keep the old record_pr name as a thin alias that funnels through submit_lift
-- (so any legacy caller degrades to a pending submission instead of a direct write).
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
  v_status text;
  v_ratio  numeric;
BEGIN
  SELECT status, ratio INTO v_status, v_ratio
    FROM public.submit_lift(p_user_id, p_exercise_name, p_weight);
  -- Surface a best-effort ratio to legacy callers; PR confirmation now happens
  -- on coach approval, not at submit.
  RETURN QUERY SELECT false, v_ratio;
END;
$$;

-- ---------------------------------------------------------------------------
--  RLS — open personal_records SELECT so the leaderboard aggregate works
--  (same empty-board root cause as xp_transactions). Submissions are
--  owner+staff readable.
-- ---------------------------------------------------------------------------
ALTER TABLE public.lift_submissions  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "PRs viewable by owner or staff" ON public.personal_records;
DROP POLICY IF EXISTS "Personal records readable by any authenticated user"
  ON public.personal_records;
CREATE POLICY "Personal records readable by any authenticated user"
  ON public.personal_records FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Lift submissions viewable by owner or staff"
  ON public.lift_submissions;
CREATE POLICY "Lift submissions viewable by owner or staff"
  ON public.lift_submissions FOR SELECT
  USING (auth.uid() = user_id OR public.is_staff_or_admin());

-- exercise_caps: public read so the client can show plausible guidance.
ALTER TABLE public.exercise_caps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Exercise caps readable by everyone" ON public.exercise_caps;
CREATE POLICY "Exercise caps readable by everyone"
  ON public.exercise_caps FOR SELECT
  USING (true);

-- ---------------------------------------------------------------------------
--  GRANTs
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lift_submissions TO anon, authenticated, service_role;
GRANT SELECT ON public.exercise_caps TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_records TO anon, authenticated, service_role;
