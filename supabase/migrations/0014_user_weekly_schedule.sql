-- ============================================================================
--  Hamza Gym — User recurring weekly schedule
--  Lets a subscriber pin one plan per weekday (Mon–Sun) so their split repeats
--  every week. source_type identifies which plan family the row points at:
--    • 'preset' → WORKOUT_PRESETS id (e.g. 'preset-push') — client-resolved
--    • 'custom' → user_workout_templates.id (the member's own saved plan)
--    • 'coach'  → workout_templates.id (a coach template)
--  source_id is text so preset slugs and uuids coexist. Run in the SQL Editor.
-- ============================================================================

create table if not exists public.user_weekly_schedule (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- 0 = Sunday, matching JS Date#getDay().
  day_of_week smallint not null check (day_of_week between 0 and 6),
  source_type text not null check (source_type in ('preset', 'custom', 'coach')),
  source_id text not null,
  created_at timestamptz not null default now (),
  -- One plan per weekday per user.
  unique (user_id, day_of_week)
);

alter table public.user_weekly_schedule enable row level security;

-- Owner can do anything with their own weekly schedule.
DROP POLICY IF EXISTS "Users manage own weekly schedule" ON public.user_weekly_schedule;
CREATE POLICY "Users manage own weekly schedule"
  ON public.user_weekly_schedule FOR ALL
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Explicit grants — DEFAULT PRIVILEGES only covers objects created by the role
-- that ran 0005, so a brand-new table needs its own GRANT (matches 0012 fix).
GRANT ALL ON public.user_weekly_schedule TO anon, authenticated;
