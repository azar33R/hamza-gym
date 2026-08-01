-- ============================================================================
--  Hamza Gym — 0039: activate_subscription with a custom start date
--
--  The coach may backdate a membership (payment received last week) or
--  schedule one to start later, so activate_subscription() now accepts an
--  optional p_start_date. When omitted it defaults to today (old behaviour).
--
--  Idempotent. Run in the Supabase SQL Editor after 0038.
-- ============================================================================

create or replace function public.activate_subscription (
  p_user_id uuid,
  p_plan_type plan_type,
  p_method payment_method,
  p_start_date date default null
)
returns public.subscriptions
language plpgsql
security definer
as $$
declare
  v_plan     record;
  v_start    date;
  v_end      date;
  v_sub      public.subscriptions;
begin
  select price_egp, duration_months into v_plan
  from public.plans where plan_type = p_plan_type;

  -- End date: duration_months from the start date. 0 months = 1-day pass.
  if v_plan.duration_months is null then
    raise exception 'Unknown plan type: %', p_plan_type;
  end if;

  -- Start date: explicit override, otherwise today.
  v_start := coalesce(p_start_date, current_date);

  v_end := (v_start + make_interval(months => greatest(v_plan.duration_months, 0)))::date;
  if v_plan.duration_months = 0 then
    v_end := v_start;
  end if;

  insert into public.subscriptions (user_id, plan_type, start_date, end_date, payment_method)
  values (p_user_id, p_plan_type, v_start, v_end, p_method)
  returning * into v_sub;

  update public.profiles
    set subscription_status = 'active'
    where id = p_user_id;

  return v_sub;
end;
$$;
