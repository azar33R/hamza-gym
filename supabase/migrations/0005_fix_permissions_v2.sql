-- ============================================================================
--  Hamza Gym — FULL PERMISSION FIX (v2)
--  Run this ENTIRE script in the Supabase SQL Editor.
--  It grants schema-level + table-level + sequence permissions for EVERY table.
--  Also fixes the trigger and backfills missing profiles.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  1. Grant schema-level access (Supabase needs this before table GRANTs work)
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT CREATE ON SCHEMA public TO anon, authenticated;

-- ---------------------------------------------------------------------------
--  2. Grant permissions on ALL sequences
-- ---------------------------------------------------------------------------
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;

-- ---------------------------------------------------------------------------
--  3. Grant ALL table permissions — profiles
-- ---------------------------------------------------------------------------
GRANT ALL ON public.profiles TO anon, authenticated;
GRANT ALL ON public.subscriptions TO anon, authenticated;
GRANT ALL ON public.payment_requests TO anon, authenticated;
GRANT ALL ON public.plans TO anon, authenticated;
GRANT ALL ON public.workout_templates TO anon, authenticated;
GRANT ALL ON public.scheduled_workouts TO anon, authenticated;
GRANT ALL ON public.notifications TO anon, authenticated;
GRANT ALL ON public.push_subscriptions TO anon, authenticated;
GRANT ALL ON public.attendance_log TO anon, authenticated;

-- Also grant to the supabase_auth_admin role if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO supabase_auth_admin;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;
  END IF;
END $$;

-- Set default privileges so any FUTURE tables also get permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;

-- ---------------------------------------------------------------------------
--  4. Fix the trigger function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user ()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, subscription_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    'subscriber',
    'inactive'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user ();

-- ---------------------------------------------------------------------------
--  5. Backfill missing profiles
-- ---------------------------------------------------------------------------
INSERT INTO public.profiles (id, full_name, role, subscription_status)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data ->> 'full_name', ''),
  'subscriber',
  'inactive'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
--  6. Make mrm491527 admin
-- ---------------------------------------------------------------------------
UPDATE public.profiles
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'mrm491527@gmail.com')
  AND role != 'admin';

-- ---------------------------------------------------------------------------
--  7. Add 'staff' to user_role enum
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'staff'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
     ALTER TYPE public.user_role ADD VALUE 'staff' AFTER 'subscriber';
  END IF;
END $$;
