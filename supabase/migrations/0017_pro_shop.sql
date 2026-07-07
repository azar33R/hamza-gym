-- ============================================================================
--  Hamza Gym — 0017: Pro Shop (real-money products)
--
--  The coach sells physical goods (creatine, gear, supplements, …) for EGP.
--  Members order via Vodafone Cash (reusing the existing payment capture flow),
--  and the coach approves/rejects/fulfills orders in the admin area — same
--  pattern as subscription payment_requests.
--
--  Idempotent. Run in the Supabase SQL Editor after 0016.
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.shop_order_status AS ENUM
    ('pending', 'approved', 'rejected', 'fulfilled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
--  shop_products: the catalog (admin-managed)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shop_products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  price_egp   numeric(10, 2) NOT NULL DEFAULT 0,
  image_url   text,
  stock       int,                       -- NULL = unlimited
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
--  shop_orders: one per product purchase attempt
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shop_orders (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  product_id         uuid NOT NULL REFERENCES public.shop_products (id) ON DELETE RESTRICT,
  -- Snapshot the price at order time so later catalog edits don't rewrite history.
  price_egp_snapshot numeric(10, 2) NOT NULL,
  status             public.shop_order_status NOT NULL DEFAULT 'pending',
  -- Vodafone Cash capture fields (mirror payment_requests).
  sender_wallet      text,
  txn_id             text,
  reviewed_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
--  RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_orders   ENABLE ROW LEVEL SECURITY;

-- shop_products: anyone authenticated can read the catalog; staff/admin manage.
DROP POLICY IF EXISTS "Shop products readable by everyone" ON public.shop_products;
CREATE POLICY "Shop products readable by everyone"
  ON public.shop_products FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Shop products managed by staff or admin" ON public.shop_products;
CREATE POLICY "Shop products managed by staff or admin"
  ON public.shop_products FOR ALL
  USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

-- shop_orders: owner + staff/admin read; owner insert; staff/admin update.
DROP POLICY IF EXISTS "Shop orders viewable by owner or staff" ON public.shop_orders;
CREATE POLICY "Shop orders viewable by owner or staff"
  ON public.shop_orders FOR SELECT
  USING (auth.uid() = user_id OR public.is_staff_or_admin());

DROP POLICY IF EXISTS "Owner creates own shop orders" ON public.shop_orders;
CREATE POLICY "Owner creates own shop orders"
  ON public.shop_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Staff manage shop orders" ON public.shop_orders;
CREATE POLICY "Staff manage shop orders"
  ON public.shop_orders FOR UPDATE
  USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

-- ---------------------------------------------------------------------------
--  GRANTs
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_products TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_orders   TO anon, authenticated, service_role;
