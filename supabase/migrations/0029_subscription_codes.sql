-- ============================================================================
--  Hamza Gym — 0029: Subscription Codes
--
--  Admins create redeemable codes that grant a subscription plan directly
--  (no payment). A non-subscriber enters the code in the app to activate via
--  the existing activate_subscription() RPC.
--
--  Each code is configurable: max_uses (default 1) and an optional expiry.
--  Idempotent. Run in the Supabase SQL Editor after 0028.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  subscription_codes: admin-managed redemption codes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_codes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text NOT NULL,
  plan_type    public.plan_type NOT NULL,
  label        text,
  max_uses     int NOT NULL DEFAULT 1,
  used_count   int NOT NULL DEFAULT 0,
  created_by   uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  redeemed_by  uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  redeemed_at  timestamptz,
  expires_at   timestamptz,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS subscription_codes_code_key
    ON public.subscription_codes (code);
EXCEPTION WHEN others THEN NULL; END $$;

-- ---------------------------------------------------------------------------
--  RLS — codes are secret, admins only
-- ---------------------------------------------------------------------------
ALTER TABLE public.subscription_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Subscription codes managed by admin" ON public.subscription_codes;
CREATE POLICY "Subscription codes managed by admin"
  ON public.subscription_codes FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
--  GRANTs
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_codes TO anon, authenticated, service_role;
