-- ============================================================================
--  Hamza Gym — FIX: Grant table permissions + fix trigger
--  Run this in the Supabase SQL Editor to fix "permission denied" errors.
--  This grants the anon and authenticated roles access to all tables,
--  then ensures the profile auto-creation trigger works correctly.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  1. GRANT permissions on all tables (anon = unauthenticated browsing,
--     authenticated = logged-in users — this is what the app uses via anon key)
-- ---------------------------------------------------------------------------
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_requests TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_templates TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_workouts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_log TO anon, authenticated;

-- ---------------------------------------------------------------------------
--  2. Fix the trigger function (0001 had "security deferrer" — not valid SQL;
--     use the correct "security definer" so it runs as the table owner).
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
--  3. Backfill: if any auth.users rows don't have a profiles row, create them.
--  This catches users who signed up before the trigger existed.
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
--  4. Make yourself admin (if not already)
-- ---------------------------------------------------------------------------
UPDATE public.profiles
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'mrm491527@gmail.com')
  AND role != 'admin';
