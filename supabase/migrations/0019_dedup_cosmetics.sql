-- ============================================================================
--  Hamza Gym — 0019: Deduplicate cosmetics + add unique constraint
--
--  The 0016 seed INSERT used ON CONFLICT DO NOTHING, but there was no unique
--  constraint on (type, value), so every re-run added another copy of each
--  seed row. This migration:
--    1. Deletes duplicate cosmetics (keeps the one with lowest sort_order)
--    2. Cascades cleanup to user_cosmetics
--    3. Adds a unique constraint so future runs are safe
--
--  Idempotent — safe to run even if no duplicates exist.
-- ============================================================================

-- Delete user_cosmetics rows that point at the duplicates we're about to drop.
DELETE FROM public.user_cosmetics
WHERE cosmetic_id IN (
  SELECT id FROM (
    SELECT id, type, value,
      ROW_NUMBER() OVER (
        PARTITION BY type, value ORDER BY sort_order ASC, created_at ASC
      ) AS rn
    FROM public.cosmetics
  ) dups
  WHERE rn > 1
);

-- Delete the duplicate cosmetic rows themselves.
DELETE FROM public.cosmetics
WHERE id IN (
  SELECT id FROM (
    SELECT id, type, value,
      ROW_NUMBER() OVER (
        PARTITION BY type, value ORDER BY sort_order ASC, created_at ASC
      ) AS rn
    FROM public.cosmetics
  ) dups
  WHERE rn > 1
);

-- Add unique constraint to prevent future duplicates.
ALTER TABLE public.cosmetics
  DROP CONSTRAINT IF EXISTS cosmetics_type_value_unique;
ALTER TABLE public.cosmetics
  ADD CONSTRAINT cosmetics_type_value_unique UNIQUE (type, value);
