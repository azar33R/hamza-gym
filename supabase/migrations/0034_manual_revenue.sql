-- ============================================================================
--  Hamza Gym — 0034: Manual revenue (cash 1-day passes, etc.)
--
--  Many members pay cash for a 1-day pass and never create an account, so the
--  admin needs a way to log that revenue manually and track how many 1-day
--  users visit each day. Generic enough to log other off-system cash too.
--
--  Idempotent. Run in the Supabase SQL Editor after 0033.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.manual_revenue (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type       text NOT NULL DEFAULT 'day_pass',
  log_date   date NOT NULL DEFAULT current_date,
  quantity   int  NOT NULL DEFAULT 1,
  amount     numeric(10, 2) NOT NULL DEFAULT 0,
  note       text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS manual_revenue_log_date_idx
  ON public.manual_revenue (log_date);

ALTER TABLE public.manual_revenue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manual revenue viewable by staff or admin" ON public.manual_revenue;
CREATE POLICY "Manual revenue viewable by staff or admin"
  ON public.manual_revenue FOR SELECT
  USING (public.is_staff_or_admin());

DROP POLICY IF EXISTS "Manual revenue managed by admin" ON public.manual_revenue;
CREATE POLICY "Manual revenue managed by admin"
  ON public.manual_revenue FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_revenue TO anon, authenticated, service_role;
