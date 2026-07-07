-- ============================================================================
--  Hamza Gym — 0007: Phase 4 GRANT repair
--  Fixes "permission denied for table workout_sessions" (and the other Phase 4
--  tables) if the grants in 0006 didn't apply — e.g. when the table already
--  existed before the GRANT ran, or the migration was applied in pieces.
--
--  Safe to re-run (idempotent). Run in the Supabase SQL Editor.
-- ============================================================================

-- Re-grant full DML on every Phase 4 table to anon + authenticated (the roles
-- the SSR/browser clients connect as) AND to the service role.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gym_settings     TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.machine_library  TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_records TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xp_transactions  TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_sessions TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.set_logs         TO anon, authenticated, service_role;

-- Sequences backing any serial/identity columns.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Sanity check: list the live grants so you can confirm they applied.
-- (Commented out — uncomment to inspect.)
-- SELECT grantee, table_name, privilege_type
--   FROM information_schema.role_table_grants
--   WHERE table_schema = 'public'
--     AND table_name IN ('workout_sessions','set_logs','xp_transactions','personal_records','gym_settings','machine_library')
--   ORDER BY table_name, grantee;
