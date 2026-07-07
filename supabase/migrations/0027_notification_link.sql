-- ============================================================================
--  Hamza Gym — 0027: notification deep-link target
--
--  Notifications are surfaced in the admin bell. Clicking one should navigate
--  to whatever triggered it (payment request -> triage, dm -> chat, ...).
--  This adds a nullable `link` column that each sender sets to the relevant
--  app route.
-- ============================================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS link text NULL;
