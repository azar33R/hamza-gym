-- ============================================================================
--  Hamza Gym — 0016: Cosmetics (nicknames + banners)
--
--  Members spend points on cosmetics, or unlock some for free at a tier.
--  One equipped nickname + one equipped banner per user (enforced by RPC).
--
--  cosmetic.value  → the nickname string (type='nickname') or the banner
--                    gradient key (type='banner'); the client maps the key to
--                    a CSS gradient.
--  price_points    → points cost to BUY. NULL = not buyable.
--  unlock_tier     → tier at which it unlocks for FREE. NULL = tier-gated never.
--  Both set        → buyable now OR free once you reach that tier.
--
--  Idempotent. Run in the Supabase SQL Editor after 0015.
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.cosmetic_type AS ENUM ('nickname', 'banner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
--  cosmetics: the admin-managed catalog
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cosmetics (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type          public.cosmetic_type NOT NULL,
  name          text NOT NULL,            -- display label e.g. "The Beast"
  value         text NOT NULL,            -- nickname string or banner gradient key
  price_points  int,                       -- NULL = not buyable with points
  unlock_tier   public.tier_type,          -- NULL = never tier-unlocked
  is_active     boolean NOT NULL DEFAULT true,
  sort_order    int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- A cosmetic is either buyable or tier-unlocked (or both) — never neither,
-- otherwise no one could ever get it.
ALTER TABLE public.cosmetics
  DROP CONSTRAINT IF EXISTS cosmetics_acquirable_check;
ALTER TABLE public.cosmetics
  ADD CONSTRAINT cosmetics_acquirable_check
  CHECK (price_points IS NOT NULL OR unlock_tier IS NOT NULL);

-- Prevent duplicate entries with the same type+value.
ALTER TABLE public.cosmetics
  DROP CONSTRAINT IF EXISTS cosmetics_type_value_unique;
ALTER TABLE public.cosmetics
  ADD CONSTRAINT cosmetics_type_value_unique UNIQUE (type, value);

-- ---------------------------------------------------------------------------
--  user_cosmetics: who owns + has equipped what
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_cosmetics (
  user_id      uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  cosmetic_id  uuid NOT NULL REFERENCES public.cosmetics (id) ON DELETE CASCADE,
  acquired_at  timestamptz NOT NULL DEFAULT now(),
  equipped     boolean NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, cosmetic_id)
);

-- Enforce at most one equipped nickname + one equipped banner per user.
-- (Also enforced in the equip RPC for atomicity; this is defense-in-depth.)
-- Uses a trigger instead of a partial index because PG forbids subqueries in
-- index predicates. The trigger joins to the cosmetics table to check the type.
CREATE OR REPLACE FUNCTION public.check_one_equipped_per_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type public.cosmetic_type;
  v_count int;
BEGIN
  SELECT type INTO v_type FROM public.cosmetics WHERE id = NEW.cosmetic_id;
  IF v_type IS NULL THEN
    RAISE EXCEPTION 'cosmetic not found';
  END IF;

  IF NEW.equipped THEN
    SELECT COUNT(*) INTO v_count
    FROM public.user_cosmetics uc
    JOIN public.cosmetics c ON c.id = uc.cosmetic_id
    WHERE uc.user_id = NEW.user_id
      AND uc.equipped = true
      AND c.type = v_type
      AND uc.cosmetic_id <> NEW.cosmetic_id;
    IF v_count > 0 THEN
      RAISE EXCEPTION 'only one equipped % allowed per user', v_type;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_one_equipped_per_type ON public.user_cosmetics;
CREATE TRIGGER check_one_equipped_per_type
  BEFORE INSERT OR UPDATE OF equipped ON public.user_cosmetics
  FOR EACH ROW
  EXECUTE FUNCTION public.check_one_equipped_per_type();

-- ---------------------------------------------------------------------------
--  equip_cosmetic(p_cosmetic_id)
--  SECURITY DEFINER: atomically grants (if not owned) then sets equipped, and
--  un-equips any other cosmetic of the same type for the caller. Returns ok.
--  NOTE: this only flips the equip flag — it does NOT spend points. Buying
--  happens via lib/cosmetics-actions → spend_points + insert, then equip.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.equip_cosmetic (
  p_user_id    uuid,
  p_cosmetic_id uuid
)
RETURNS TABLE (ok boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type public.cosmetic_type;
  v_owned boolean;
BEGIN
  SELECT type INTO v_type FROM public.cosmetics WHERE id = p_cosmetic_id;
  IF v_type IS NULL THEN
    RETURN QUERY SELECT false;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_cosmetics
    WHERE user_id = p_user_id AND cosmetic_id = p_cosmetic_id
  ) INTO v_owned;

  IF NOT v_owned THEN
    RETURN QUERY SELECT false;
    RETURN;
  END IF;

  -- Un-equip any other cosmetic of the same type for this user.
  UPDATE public.user_cosmetics uc
    SET equipped = false
    WHERE uc.user_id = p_user_id
      AND uc.equipped = true
      AND uc.cosmetic_id <> p_cosmetic_id
      AND EXISTS (
        SELECT 1 FROM public.cosmetics c
        WHERE c.id = uc.cosmetic_id AND c.type = v_type
      );

  UPDATE public.user_cosmetics
    SET equipped = true
    WHERE user_id = p_user_id AND cosmetic_id = p_cosmetic_id;

  RETURN QUERY SELECT true;
END;
$$;

CREATE OR REPLACE FUNCTION public.unequip_cosmetic (
  p_user_id    uuid,
  p_cosmetic_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_cosmetics
    SET equipped = false
    WHERE user_id = p_user_id AND cosmetic_id = p_cosmetic_id;
END;
$$;

-- ---------------------------------------------------------------------------
--  Seed catalog — nicknames + banners (mix of buyable / tier-unlock / both)
-- ---------------------------------------------------------------------------
INSERT INTO public.cosmetics (type, name, value, price_points, unlock_tier, is_active, sort_order)
VALUES
  -- Nicknames: free at tier
  ('nickname', 'لسه بيسخن',    'لسه بيسخن',     NULL, 'iron',    true, 1),
  ('nickname', 'فورمة الساحل', 'فورمة الساحل',  NULL, 'bronze',  true, 2),
  ('nickname', 'عاش يا بطل',   'عاش يا بطل',     NULL, 'gold',    true, 3),
  ('nickname', 'الدبابة',       'الدبابة',       300,  NULL,      true, 10),
  ('nickname', 'مقطّع السمكة',  'مقطّع السمكة',  400,  NULL,      true, 11),
  ('nickname', 'كبير الجيم',    'كبير الجيم',    500,  NULL,      true, 12),
  ('nickname', 'مقفّل العداد',  'مقفّل العداد',  650,  NULL,      true, 13),
  ('nickname', 'مكنة أوزان',    'مكنة أوزان',    NULL, 'diamond', true, 4),
  -- Banners: gradient keys (client maps these to CSS).
  ('banner', 'شرار الحديد',    'iron',         NULL, 'iron',    true, 101),
  ('banner', 'حريقة أوزان',    'bronze',       NULL, 'bronze',  true, 102),
  ('banner', 'بطل من دهب',     'gold',         NULL, 'gold',    true, 103),
  ('banner', 'فورمة ألماظ',    'diamond',      NULL, 'diamond', true, 104),
  ('banner', 'باور عالي',      'lime',         250,  NULL,      true, 110),
  ('banner', 'من كوكب تاني',   'inferno',      450,  NULL,      true, 111),
  ('banner', 'ملك الحديد',     'galaxy',       600,  NULL,      true, 112),
  ('banner', 'أعصاب تلاجة',    'purple',       550,  NULL,      true, 113)
ON CONFLICT (type, value) DO NOTHING;

-- ---------------------------------------------------------------------------
--  RLS + GRANTs
-- ---------------------------------------------------------------------------
ALTER TABLE public.cosmetics      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_cosmetics ENABLE ROW LEVEL SECURITY;

-- cosmetics: anyone can read the catalog; staff/admin manage.
DROP POLICY IF EXISTS "Cosmetics readable by everyone" ON public.cosmetics;
CREATE POLICY "Cosmetics readable by everyone"
  ON public.cosmetics FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Cosmetics managed by staff or admin" ON public.cosmetics;
CREATE POLICY "Cosmetics managed by staff or admin"
  ON public.cosmetics FOR ALL
  USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

-- user_cosmetics: owner + staff/admin read; owner insert/update (the equip RPC
-- runs as SECURITY DEFINER so it isn't blocked by these policies).
DROP POLICY IF EXISTS "User cosmetics viewable by owner or staff"
  ON public.user_cosmetics;
CREATE POLICY "User cosmetics viewable by owner or staff"
  ON public.user_cosmetics FOR SELECT
  USING (auth.uid() = user_id OR public.is_staff_or_admin());

DROP POLICY IF EXISTS "Owner inserts own user cosmetics"
  ON public.user_cosmetics;
CREATE POLICY "Owner inserts own user cosmetics"
  ON public.user_cosmetics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owner updates own user cosmetics"
  ON public.user_cosmetics;
CREATE POLICY "Owner updates own user cosmetics"
  ON public.user_cosmetics FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cosmetics      TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_cosmetics TO anon, authenticated, service_role;
