-- ============================================================================
--  Hamza Gym — 0026: Fix ambiguous `status` column in submit_lift()
--
--  submit_lift() declares RETURNS TABLE (status text, ...) which creates an
--  output parameter named `status`. Inside the function body, `AND status`
--  in WHERE clauses against lift_submissions (which ALSO has a `status`
--  column) becomes ambiguous — PostgreSQL can't tell the column from the
--  output parameter.
--
--  Fix: qualify every table-column reference as lift_submissions.status.
--
--  Idempotent. Run after 0025.
-- ============================================================================

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
      AND lift_submissions.status = 'pending'
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
