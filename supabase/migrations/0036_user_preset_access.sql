-- ============================================================================
--  Hamza Gym — 0036: Per-user preset unlock access
--
--  Presets are unlocked per member by a coach/staff before they can be pinned
--  to that member's weekly schedule. Locking also clears any pinned days that
--  referenced the now-locked preset. Run in the Supabase SQL Editor after 0035.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_preset_access (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  preset_id  text NOT NULL,
  unlocked_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, preset_id)
);

ALTER TABLE public.user_preset_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Preset access managed by staff or admin" ON public.user_preset_access;
CREATE POLICY "Preset access managed by staff or admin"
  ON public.user_preset_access FOR ALL
  USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

DROP POLICY IF EXISTS "Preset access readable by owner" ON public.user_preset_access;
CREATE POLICY "Preset access readable by owner"
  ON public.user_preset_access FOR SELECT
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preset_access TO anon, authenticated, service_role;
