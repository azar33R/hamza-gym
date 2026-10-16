-- ============================================================================
--  Hamza Gym — 0045: cardio add-on on subscriptions
--
--  Why: plans carry an optional cardio add-on price (`plans.cardio_price`) and
--  member checkout + payment_requests already snapshot it — but `subscriptions`
--  had NO cardio columns. Manual member creation and cash activation therefore
--  silently dropped cardio: the member got cardio access without ever paying
--  for it, and revenue never saw the add-on.
--
--  Design (mirrors payment_requests from 0031):
--  - `subscriptions.cardio` — was the add-on included?
--  - `subscriptions.cardio_price_snapshot` — add-on price at activation.
--  - `price_snapshot` remains the TOTAL owed (plan + cardio), so revenue and
--    remaining-balance maths need no changes — they already read the snapshot.
--
--  Idempotent. Run in the Supabase SQL Editor after 0044.
-- ============================================================================

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS cardio boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cardio_price_snapshot numeric(10, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.subscriptions.cardio IS
  'Whether the cardio add-on was included in this subscription.';
COMMENT ON COLUMN public.subscriptions.cardio_price_snapshot IS
  'Cardio add-on price (EGP) at activation. Part of price_snapshot total.';
