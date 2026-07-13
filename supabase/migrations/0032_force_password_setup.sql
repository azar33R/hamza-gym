-- ============================================================================
--  Hamza Gym — 0032: force_password_setup flag
--
--  Members created manually by an admin (via an access code) have no password
--  yet. After they sign in with the code, the app forces them to set a
--  password so they can sign in normally afterwards. This flag drives that
--  one-time prompt.
--
--  Idempotent. Run in the Supabase SQL Editor after 0031.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS force_password_setup boolean NOT NULL DEFAULT false;
