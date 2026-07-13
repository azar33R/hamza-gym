-- ============================================================================
--  Hamza Gym — 0033: member access codes
--
--  Admins manually create member accounts and hand out a one-time access
--  code. The member enters the code on the login screen to open their
--  account (the code is then consumed). See lib/member-actions.ts.
--
--  Idempotent. Run in the Supabase SQL Editor after 0032.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.member_access_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text NOT NULL,
  user_id    uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  used_at    timestamptz,
  expires_at timestamptz,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS member_access_codes_code_key
    ON public.member_access_codes (code);
EXCEPTION WHEN others THEN NULL; END $$;

ALTER TABLE public.member_access_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Member access codes managed by admin" ON public.member_access_codes;
CREATE POLICY "Member access codes managed by admin"
  ON public.member_access_codes FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_access_codes TO anon, authenticated, service_role;
