-- ============================================================================
--  Hamza Gym — Phase 2: Admin Command Center
--  Run this in the Supabase SQL Editor after 0001_init.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  New enum types
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM ('nudge', 'broadcast', 'payment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
--  Extend profiles (Phase 2 fields — all nullable, populated in Phase 3)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists height_cm numeric,
  add column if not exists weight_kg numeric,
  add column if not exists gender text,
  add column if not exists last_workout_date date,
  add column if not exists last_attendance_date date;

-- ---------------------------------------------------------------------------
--  plans: admin-managed plan catalog (replaces the static config array)
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid (),
  plan_type plan_type not null unique,
  label text not null,
  price_egp numeric(10, 2) not null default 0,
  duration_months int not null,          -- months of access granted (0 = 1-day)
  features text[] not null default '{}',
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now ()
);

-- Seed the five plan types with editable placeholder prices.
insert into public.plans (plan_type, label, price_egp, duration_months, features, sort_order)
values
  ('1-day',   '1-Day Pass',   50,   0,  ARRAY['Full gym access', 'Coach guidance'], 1),
  ('1-month', '1-Month Plan', 400,  1,  ARRAY['Full gym access', 'Coach guidance', 'Workout tracking'], 2),
  ('3-month', '3-Month Plan', 1100, 3,  ARRAY['Full gym access', 'Coach guidance', 'Workout tracking'], 3),
  ('6-month', '6-Month Plan', 2000, 6,  ARRAY['Full gym access', 'Coach guidance', 'Workout tracking', 'Priority support'], 4),
  ('1-year',  '1-Year Plan',  3600, 12, ARRAY['Full gym access', 'Coach guidance', 'Workout tracking', 'Priority support', 'Nutrition plan'], 5)
on conflict (plan_type) do nothing;

-- ---------------------------------------------------------------------------
--  workout_templates: coach-authored routines
-- ---------------------------------------------------------------------------
create table if not exists public.workout_templates (
  id uuid primary key default gen_random_uuid (),
  name text not null,
  description text,
  exercises jsonb not null default '[]',  -- [{ name, sets, reps }]
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now ()
);

-- ---------------------------------------------------------------------------
--  scheduled_workouts: templates assigned to a client on a given day
-- ---------------------------------------------------------------------------
create table if not exists public.scheduled_workouts (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.profiles (id) on delete cascade,
  template_id uuid not null references public.workout_templates (id) on delete cascade,
  scheduled_date date not null,
  created_at timestamptz not null default now (),
  unique (user_id, scheduled_date)
);

-- ---------------------------------------------------------------------------
--  notifications: in-app inbox (also drives future push)
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text,
  type notification_type not null default 'broadcast',
  is_read boolean not null default false,
  created_at timestamptz not null default now ()
);

-- ---------------------------------------------------------------------------
--  push_subscriptions: browser push endpoints
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now ()
);

-- ---------------------------------------------------------------------------
--  attendance_log: check-in history
-- ---------------------------------------------------------------------------
create table if not exists public.attendance_log (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.profiles (id) on delete cascade,
  checked_in_at timestamptz not null default now (),
  created_at timestamptz not null default now ()
);

-- ---------------------------------------------------------------------------
--  SQL helper: activate_subscription(p_user_id, p_plan_type, p_method)
--  Computes start/end dates from the plan, inserts a subscriptions row,
--  flips the profile to 'active'. SECURITY DEFINER bypasses RLS friction.
--  Returns the new subscriptions row.
-- ---------------------------------------------------------------------------
create or replace function public.activate_subscription (
  p_user_id uuid,
  p_plan_type plan_type,
  p_method payment_method
)
returns public.subscriptions
language plpgsql
security definer
as $$
declare
  v_plan     record;
  v_start    date := current_date;
  v_end      date;
  v_sub      public.subscriptions;
begin
  select price_egp, duration_months into v_plan
  from public.plans where plan_type = p_plan_type;

  -- End date: duration_months from today. 0 months = 1-day pass (today only).
  if v_plan.duration_months is null then
    raise exception 'Unknown plan type: %', p_plan_type;
  end if;

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

-- ---------------------------------------------------------------------------
--  Row Level Security for new tables
-- ---------------------------------------------------------------------------
alter table public.plans enable row level security;
alter table public.workout_templates enable row level security;
alter table public.scheduled_workouts enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.attendance_log enable row level security;

-- plans: everyone can read the catalog; admins manage.
DROP POLICY IF EXISTS "Plans are readable by everyone" ON public.plans;
CREATE POLICY "Plans are readable by everyone"
  ON public.plans FOR SELECT
  USING (true);
DROP POLICY IF EXISTS "Admins manage plans" ON public.plans;
CREATE POLICY "Admins manage plans"
  ON public.plans FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- workout_templates: admins manage; subscribers read (to view their schedule).
DROP POLICY IF EXISTS "Templates readable by admin or authenticated" ON public.workout_templates;
CREATE POLICY "Templates readable by admin or authenticated"
  ON public.workout_templates FOR SELECT
  USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admins manage templates" ON public.workout_templates;
CREATE POLICY "Admins manage templates"
  ON public.workout_templates FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- scheduled_workouts: owner reads own; admins manage.
DROP POLICY IF EXISTS "Scheduled workouts viewable by owner or admin" ON public.scheduled_workouts;
CREATE POLICY "Scheduled workouts viewable by owner or admin"
  ON public.scheduled_workouts FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "Admins manage scheduled workouts" ON public.scheduled_workouts;
CREATE POLICY "Admins manage scheduled workouts"
  ON public.scheduled_workouts FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- notifications: owner reads/updates own; admins create (insert) for anyone.
DROP POLICY IF EXISTS "Notifications viewable by owner or admin" ON public.notifications;
CREATE POLICY "Notifications viewable by owner or admin"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "Admins create notifications" ON public.notifications;
CREATE POLICY "Admins create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Owner marks own notifications read" ON public.notifications;
CREATE POLICY "Owner marks own notifications read"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins manage notifications" ON public.notifications;
CREATE POLICY "Admins manage notifications"
  ON public.notifications FOR ALL
  USING (public.is_admin());

-- push_subscriptions: owner reads/inserts own; admins read all for sending.
DROP POLICY IF EXISTS "Push subs viewable by owner or admin" ON public.push_subscriptions;
CREATE POLICY "Push subs viewable by owner or admin"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "Users insert own push sub" ON public.push_subscriptions;
CREATE POLICY "Users insert own push sub"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users delete own push sub" ON public.push_subscriptions;
CREATE POLICY "Users delete own push sub"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- attendance_log: owner reads own; admins manage.
DROP POLICY IF EXISTS "Attendance viewable by owner or admin" ON public.attendance_log;
CREATE POLICY "Attendance viewable by owner or admin"
  ON public.attendance_log FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "Admins manage attendance" ON public.attendance_log;
CREATE POLICY "Admins manage attendance"
  ON public.attendance_log FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
