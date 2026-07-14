-- ============================================================================
--  Hamza Gym — 0037: drop user_preset_access
--
--  The per-user preset-unlock table (0036) was the wrong target — the built-in
--  starter presets stay public for everyone. A coach template is "enabled" for
--  a member simply by being scheduled for them (scheduled_workouts), and the
--  admin removes it from the schedule tab to hide it again. So this table is
--  unused and removed. Run in the Supabase SQL Editor after 0036.
-- ============================================================================

DROP TABLE IF EXISTS public.user_preset_access;
