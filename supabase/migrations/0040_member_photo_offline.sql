-- ============================================================================
--  Hamza Gym — 0040: offline member creation (with live photo)
--
--  When the coach adds a member while offline, the whole creation — form
--  fields + the live client photo — is queued locally and replayed once back
--  online. To replay idempotently (without creating a duplicate account if a
--  sync attempt partially completed), the sync engine stamps a client-side
--  op id on the profile; the next replay sees it and skips re-creating the
--  user.
--
--  Idempotent. Run in the Supabase SQL Editor after 0039.
-- ============================================================================

DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS client_op_id text;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS profiles_client_op_id_key
    ON public.profiles (client_op_id)
    WHERE client_op_id IS NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;