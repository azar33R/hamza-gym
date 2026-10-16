-- ============================================================================
--  Hamza Gym — 0044: auto-reminder preference for partial payments
--
--  Why: the coach wants "remind them automatically every 7 or 15 days" when a
--  member owes a remainder. The app needs somewhere to store that choice per
--  subscription so the future gateway/cron sender knows who to nudge and how
--  often.
--
--  Design:
--  - `subscriptions.reminder_every_days` — NULL = no auto reminders,
--    otherwise 7 or 15.
--  - `subscriptions.last_reminded_at` — last time a reminder went out, so the
--    sender can skip members nudged too recently.
--
--  Idempotent. Run in the Supabase SQL Editor after 0043.
-- ============================================================================

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS reminder_every_days integer
    CHECK (reminder_every_days IS NULL OR reminder_every_days IN (7, 15)),
  ADD COLUMN IF NOT EXISTS last_reminded_at timestamptz;

COMMENT ON COLUMN public.subscriptions.reminder_every_days IS
  'Auto-reminder cadence for an owed remainder: NULL = off, otherwise 7 or 15 days.';
COMMENT ON COLUMN public.subscriptions.last_reminded_at IS
  'Last time a payment reminder was sent for this subscription.';
