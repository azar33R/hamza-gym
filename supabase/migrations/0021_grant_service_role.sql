-- ============================================================================
--  Hamza Gym — 0021: Grant service_role on tables created after 0005
--
--  Migrations 0012 and 0014 were applied before their GRANT lines were added
--  (they were made idempotent in a later edit). The GRANTs that ran only target
--  anon + authenticated, but server-side code uses serviceClient() which
--  connects as service_role. Without explicit privileges the queries fail with
--  "permission denied for table".
--
--  Idempotent — GRANT IF NOT applied has no effect.
-- ============================================================================

GRANT ALL ON public.user_workout_templates TO anon, authenticated, service_role;
GRANT ALL ON public.user_weekly_schedule TO anon, authenticated, service_role;
