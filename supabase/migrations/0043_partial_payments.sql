-- ============================================================================
--  Hamza Gym — 0043: partial payments (pay part now, owe the rest)
--
--  Why: the coach takes cash in hand (e.g. 200 of a 350 plan, "I'll pay the
--  rest later"). Until now `subscriptions` stored NO money columns and revenue
--  was derived from the plan catalog price, so a partial payment was booked as
--  full revenue and the member looked fully paid.
--
--  Design:
--  - `subscriptions.price_snapshot` — plan price at activation (prices change).
--  - `subscriptions.paid_amount`    — cash actually collected so far.
--  - `subscriptions.due_date`       — optional promise date for the remainder.
--  - `remaining` is ALWAYS computed (price_snapshot - paid_amount), never
--    stored, so it can't drift.
--  - `subscription_payments` ledger — one row per cash handover (activation +
--    each top-up), so there is a full history instead of an overwritten number.
--
--  Idempotent. Run in the Supabase SQL Editor after 0042.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  1. Money columns on subscriptions
-- ---------------------------------------------------------------------------
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS price_snapshot numeric(10, 2),
  ADD COLUMN IF NOT EXISTS paid_amount numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_date date;

COMMENT ON COLUMN public.subscriptions.price_snapshot IS
  'Plan price (EGP) at activation. Prices change; revenue must use this, not the live catalog.';
COMMENT ON COLUMN public.subscriptions.paid_amount IS
  'Cash actually collected so far (EGP). Kept equal to the sum of subscription_payments.';
COMMENT ON COLUMN public.subscriptions.due_date IS
  'Optional date the member promised the remainder by.';

-- ---------------------------------------------------------------------------
--  2. Payment ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  method payment_method NOT NULL DEFAULT 'manual_coach',
  note text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_payments_sub_idx
  ON public.subscription_payments (subscription_id);
CREATE INDEX IF NOT EXISTS subscription_payments_user_idx
  ON public.subscription_payments (user_id);

COMMENT ON TABLE public.subscription_payments IS
  'One row per cash handover: the activation payment plus every later top-up.';

-- ---------------------------------------------------------------------------
--  3. Backfill: every pre-existing subscription is assumed FULLY paid at the
--     plan price that was current when this runs (we have no record otherwise).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  v_price numeric(10, 2);
  v_sub_id uuid;
BEGIN
  FOR r IN
    SELECT s.id AS sub_id, s.user_id, s.plan_type, p.price_egp
      FROM public.subscriptions s
      LEFT JOIN public.plans p ON p.plan_type = s.plan_type
     WHERE s.price_snapshot IS NULL
  LOOP
    v_price := COALESCE(r.price_egp, 0);

    UPDATE public.subscriptions
       SET price_snapshot = v_price,
           paid_amount = v_price
     WHERE id = r.sub_id
    RETURNING id INTO v_sub_id;

    -- One ledger row per backfilled subscription, so paid_amount always equals
    -- the sum of the ledger and revenue never double-counts.
    INSERT INTO public.subscription_payments
      (subscription_id, user_id, amount, method, note)
    VALUES
      (v_sub_id, r.user_id, v_price, 'manual_coach', 'Backfilled as fully paid (0043)')
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
--  4. RLS — mirrors the subscriptions convention (owner reads, admins manage).
--     Server actions use the service role and bypass RLS regardless.
-- ---------------------------------------------------------------------------
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Payments viewable by owner or admin" ON public.subscription_payments;
CREATE POLICY "Payments viewable by owner or admin"
  ON public.subscription_payments FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage payments" ON public.subscription_payments;
CREATE POLICY "Admins manage payments"
  ON public.subscription_payments FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
