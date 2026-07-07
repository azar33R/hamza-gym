-- ============================================================================
--  Add vodafone_cash_wallet to gym_settings so the admin can change it
--  at runtime instead of editing config.ts. Also adds gym_name, gym_address,
--  and gym_hours so all business info is live-editable.
-- ============================================================================

ALTER TABLE public.gym_settings
  ADD COLUMN IF NOT EXISTS vodafone_cash_wallet text DEFAULT NULL;

-- Backfill from the existing config if it was never set.
UPDATE public.gym_settings
SET vodafone_cash_wallet = NULL
WHERE id = 1 AND vodafone_cash_wallet IS NULL;
