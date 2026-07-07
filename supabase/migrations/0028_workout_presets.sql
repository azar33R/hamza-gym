-- ============================================================================
--  Hamza Gym — 0028: admin-editable, gym-wide workout presets
--
--  The old WORKOUT_PRESETS array was hard-coded in lib/constants.ts (Push/Pull/
--  Leg/...). This moves them into the DB so the admin can edit, add, and remove
--  gym-wide starter routines. Seeded from the original static values.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workout_presets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  emoji       text,
  exercises   jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by  uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Every authenticated user can read the gym's presets.
ALTER TABLE public.workout_presets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Workout presets readable by authenticated"
  ON public.workout_presets;
CREATE POLICY "Workout presets readable by authenticated"
  ON public.workout_presets FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only staff/admin may write.
DROP POLICY IF EXISTS "Workout presets writable by staff"
  ON public.workout_presets;
CREATE POLICY "Workout presets writable by staff"
  ON public.workout_presets FOR ALL
  USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

-- Keep updated_at fresh.
CREATE OR REPLACE FUNCTION public.touch_workout_preset()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workout_presets_touch ON public.workout_presets;
CREATE TRIGGER workout_presets_touch
  BEFORE UPDATE ON public.workout_presets
  FOR EACH ROW EXECUTE FUNCTION public.touch_workout_preset();

-- Seed from the original static presets.
INSERT INTO public.workout_presets (name, description, emoji, exercises)
VALUES
  ('Push Day', 'Chest, shoulders & triceps.', '💥',
   '[{"name":"Bench Press","sets":4,"reps":8},{"name":"Overhead Press","sets":3,"reps":10},{"name":"Incline Dumbbell Press","sets":3,"reps":10},{"name":"Lateral Raise","sets":3,"reps":12},{"name":"Triceps Pushdown","sets":3,"reps":12}]'::jsonb),
  ('Pull Day', 'Back & biceps.', '🏋️',
   '[{"name":"Lat Pulldown","sets":4,"reps":8},{"name":"Barbell Row","sets":4,"reps":8},{"name":"Seated Cable Row","sets":3,"reps":10},{"name":"Face Pull","sets":3,"reps":15},{"name":"Biceps Curl","sets":3,"reps":12}]'::jsonb),
  ('Leg Day', 'Quads, hamstrings & glutes.', '🦵',
   '[{"name":"Squat","sets":4,"reps":8},{"name":"Romanian Deadlift","sets":3,"reps":10},{"name":"Leg Press","sets":3,"reps":12},{"name":"Leg Curl","sets":3,"reps":12},{"name":"Calf Raise","sets":4,"reps":15}]'::jsonb),
  ('Full Body', 'Hit everything in one session.', '🔥',
   '[{"name":"Squat","sets":3,"reps":8},{"name":"Bench Press","sets":3,"reps":8},{"name":"Barbell Row","sets":3,"reps":10},{"name":"Overhead Press","sets":3,"reps":10},{"name":"Plank","sets":3,"reps":45}]'::jsonb),
  ('Upper Body', 'Chest, back, shoulders & arms.', '💪',
   '[{"name":"Bench Press","sets":4,"reps":8},{"name":"Lat Pulldown","sets":4,"reps":8},{"name":"Overhead Press","sets":3,"reps":10},{"name":"Seated Cable Row","sets":3,"reps":10},{"name":"Biceps Curl","sets":3,"reps":12},{"name":"Triceps Pushdown","sets":3,"reps":12}]'::jsonb),
  ('Core & Abs', 'Quick finisher or light day.', '🎯',
   '[{"name":"Plank","sets":3,"reps":45},{"name":"Hanging Leg Raise","sets":3,"reps":12},{"name":"Cable Crunch","sets":3,"reps":15},{"name":"Russian Twist","sets":3,"reps":20}]'::jsonb)
ON CONFLICT DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_presets TO anon, authenticated, service_role;
