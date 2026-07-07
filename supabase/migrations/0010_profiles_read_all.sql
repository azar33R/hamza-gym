-- ============================================================================
--  Hamza Gym — 0010: directory-readable profiles
--  Fixes "This person isn't available to message" on the subscriber chat
--  thread page, and lets the chat directory list other members.
--
--  The 0001 profiles SELECT policy only allowed owner-or-admin reads, so a
--  subscriber querying another user's profile (coach OR fellow member) got an
--  empty row back from RLS — which surfaced as the "not available" error.
--
--  This is a gym app: members need to recognize each other and message their
--  coaches. The whole profiles table is now SELECT-able by any authenticated
--  user (mirrors how the leaderboard already implicitly needs it). Writes
--  stay owner-only.
--
--  Idempotent. Run in the Supabase SQL Editor after 0001–0009.
-- ============================================================================

DROP POLICY IF EXISTS "Profiles are viewable by owner or admin"
  ON public.profiles;

DROP POLICY IF EXISTS "Profiles are viewable by owner, admin, or staff rows"
  ON public.profiles;

DROP POLICY IF EXISTS "Profiles readable by any authenticated user"
  ON public.profiles;

-- Any signed-in user can read any profile (directory, chat lookups, etc.).
CREATE POLICY "Profiles readable by any authenticated user"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Sanity check (uncomment to inspect):
-- SELECT polname FROM pg_policy WHERE polrelid = 'public.profiles'::regclass;
