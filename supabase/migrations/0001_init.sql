-- ============================================================================
--  Hamza Gym — initial schema
--  Run this in the Supabase SQL Editor (or `supabase db push`).
-- ============================================================================

-- ---------------------------------------------------------------------------
--  Enum types (idempotent — skip if already exists)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('admin', 'subscriber');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM (
    'inactive', 'pending_approval', 'active', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.plan_type AS ENUM (
    '1-day', '1-month', '3-month', '6-month', '1-year'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM ('vodafone_cash', 'manual_coach');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_request_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
--  Tables
-- ---------------------------------------------------------------------------

-- profiles: one row per auth user. id mirrors auth.users.id.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role user_role not null default 'subscriber',
  subscription_status subscription_status not null default 'inactive',
  created_at timestamptz not null default now()
);

-- subscriptions: granted membership periods (created once a payment is approved).
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_type plan_type not null,
  start_date date,
  end_date date,
  payment_method payment_method not null,
  created_at timestamptz not null default now ()
);

-- payment_requests: offline Vodafone Cash transfers awaiting coach approval.
create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_type plan_type not null,
  sender_wallet_number text not null,
  transaction_id text not null,
  status payment_request_status not null default 'pending',
  created_at timestamptz not null default now ()
);

-- ---------------------------------------------------------------------------
--  Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_requests enable row level security;

-- Helper: is the current user an admin?
create or replace function public.is_admin ()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid () and role = 'admin'
  );
$$;

-- profiles: a user can read/insert/update their own row; admins see all.
DROP POLICY IF EXISTS "Profiles are viewable by owner or admin" ON public.profiles;
CREATE POLICY "Profiles are viewable by owner or admin"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- subscriptions: owner can read; admins read all and manage.
DROP POLICY IF EXISTS "Subscriptions viewable by owner or admin" ON public.subscriptions;
CREATE POLICY "Subscriptions viewable by owner or admin"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage subscriptions" ON public.subscriptions;
CREATE POLICY "Admins manage subscriptions"
  ON public.subscriptions FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- payment_requests: owner can read + create; admins can do all.
DROP POLICY IF EXISTS "Payment requests viewable by owner or admin" ON public.payment_requests;
CREATE POLICY "Payment requests viewable by owner or admin"
  ON public.payment_requests FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can create their payment requests" ON public.payment_requests;
CREATE POLICY "Users can create their payment requests"
  ON public.payment_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage payment requests" ON public.payment_requests;
CREATE POLICY "Admins manage payment requests"
  ON public.payment_requests FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
--  Trigger: auto-create profile on signup
--  Fires inside Postgres with SECURITY DEFINER — bypasses RLS entirely.
--  Reads raw_user_meta_data->>'full_name' from the auth.users row.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer -- runs as table owner (bypasses RLS)
as $$
begin
  insert into public.profiles (id, full_name, role, subscription_status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'subscriber',
    'inactive'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user ();
