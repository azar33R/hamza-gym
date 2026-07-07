-- ============================================================================
--  Hamza Gym — 0020: Fix missing GRANT on user_weekly_schedule
--
--  Migration 0014 was applied before the GRANT ALL line was added. The table
--  only has default privileges, so INSERT/UPDATE/DELETE fail with "permission
--  denied for table user_weekly_schedule" even though RLS policies are set.
--
--  Idempotent — GRANT IF NOT applied has no effect.
-- ============================================================================

GRANT ALL ON public.user_weekly_schedule TO anon, authenticated, service_role;
