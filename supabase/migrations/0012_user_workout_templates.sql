-- ============================================================================
--  Hamza Gym — User-authored workout templates
--  Lets a subscriber save their own custom routines (presets they customized
--  or built from scratch) so they can pick them again later. Run in the
--  Supabase SQL Editor.
-- ============================================================================

create table if not exists public.user_workout_templates (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  -- Same shape as workout_templates.exercises: [{ name, sets, reps, machine_id?, photo_url? }]
  exercises jsonb not null default '[]',
  created_at timestamptz not null default now ()
);

alter table public.user_workout_templates enable row level security;

-- Owner can do anything with their own plans.
DROP POLICY IF EXISTS "Users manage own workout templates" ON public.user_workout_templates;
CREATE POLICY "Users manage own workout templates"
  ON public.user_workout_templates FOR ALL
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Explicit grants (DEFAULT PRIVILEGES only covers objects created by the role
-- that ran 0005, so a brand-new table needs its own GRANT — matches the v2 fix).
GRANT ALL ON public.user_workout_templates TO anon, authenticated;
