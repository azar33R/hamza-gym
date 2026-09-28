-- ============================================================================
--  Hamza Gym — 0042: custom-length plans (half a month, odd day counts)
--
--  Why this was needed: `plan_type` is an enum with only 5 fixed values, and
--  the actual length came from `duration_months int`. An int can't express half
--  a month, and 0 was already overloaded to mean "1-day pass", so an arbitrary
--  number of days (45 days, half a month, a 3-week trial) was impossible.
--
--  Fix: a `duration_days` column that takes precedence over duration_months
--  when set, plus a 'custom' plan_type so the coach can label it freely.
--
--  Semantics: duration_days is the number of days GRANTED, inclusive of the
--  start day. So 1 day ends on the start date (identical to the built-in
--  1-day pass), 15 days ends 14 days later.
--
--  Idempotent. Run in the Supabase SQL Editor after 0041.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  1. A plan type for coach-defined lengths
-- ---------------------------------------------------------------------------
ALTER TYPE public.plan_type ADD VALUE IF NOT EXISTS 'custom';

-- ---------------------------------------------------------------------------
--  2. The day-based duration
-- ---------------------------------------------------------------------------
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS duration_days int;

COMMENT ON COLUMN public.plans.duration_days IS
  'Days of access granted (inclusive of start day). When set, overrides duration_months.';

ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_duration_days_check;
ALTER TABLE public.plans
  ADD CONSTRAINT plans_duration_days_check
  CHECK (duration_days IS NULL OR duration_days >= 1);

-- ---------------------------------------------------------------------------
--  3. Backfill the built-in 1-day pass so it keeps working through the new path
-- ---------------------------------------------------------------------------
UPDATE public.plans
   SET duration_days = 1
 WHERE plan_type = '1-day'
   AND duration_days IS NULL;

-- ---------------------------------------------------------------------------
--  4. End-date maths now prefers duration_days
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activate_subscription (
  p_user_id uuid,
  p_plan_type plan_type,
  p_method payment_method,
  p_start_date date default null
)
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan  record;
  v_start date;
  v_end   date;
  v_sub   public.subscriptions;
BEGIN
  SELECT price_egp, duration_months, duration_days
    INTO v_plan
    FROM public.plans
   WHERE plan_type = p_plan_type;

  -- No plan row at all.
  IF v_plan.duration_months IS NULL AND v_plan.duration_days IS NULL THEN
    RAISE EXCEPTION 'Unknown plan type: %', p_plan_type;
  END IF;

  -- Start date: explicit override, otherwise today.
  v_start := COALESCE(p_start_date, current_date);

  IF v_plan.duration_days IS NOT NULL AND v_plan.duration_days > 0 THEN
    -- Day-based: the grant spans duration_days days counting the start day.
    v_end := (v_start + (v_plan.duration_days - 1))::date;
  ELSE
    -- Month-based (legacy). 0 months = 1-day pass (today only).
    v_end := (v_start + make_interval(months => greatest(v_plan.duration_months, 0)))::date;
    IF v_plan.duration_months = 0 THEN
      v_end := v_start;
    END IF;
  END IF;

  INSERT INTO public.subscriptions (user_id, plan_type, start_date, end_date, payment_method)
  VALUES (p_user_id, p_plan_type, v_start, v_end, p_method)
  RETURNING * INTO v_sub;

  UPDATE public.profiles
     SET subscription_status = 'active'
   WHERE id = p_user_id;

  RETURN v_sub;
END;
$$;
