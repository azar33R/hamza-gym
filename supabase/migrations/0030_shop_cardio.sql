-- ============================================================================
--  Hamza Gym — 0030: Pro-shop cardio add-on
--
--  Lets an admin price an optional "cardio" add-on per product. Buyers can
--  tick a checkbox at checkout to include cardio, which adds cardio_price to
--  the order total. The choice is snapshotted onto the order.
--
--  Idempotent. Run in the Supabase SQL Editor after 0029.
-- ============================================================================

ALTER TABLE public.shop_products
  ADD COLUMN IF NOT EXISTS cardio_price numeric(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS cardio boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cardio_price_snapshot numeric(10, 2) NOT NULL DEFAULT 0;
