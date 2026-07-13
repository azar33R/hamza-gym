-- ============================================================================
--  Hamza Gym — 0031: Plan cardio add-on
--
--  Admins price an optional "cardio" add-on per subscription plan. At checkout
--  the member can tick a checkbox to include cardio, which adds cardio_price
--  to the amount they pay. The choice is snapshotted onto the payment request.
--
--  Idempotent. Run in the Supabase SQL Editor after 0030.
-- ============================================================================

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS cardio_price numeric(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS cardio boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cardio_price_snapshot numeric(10, 2) NOT NULL DEFAULT 0;
