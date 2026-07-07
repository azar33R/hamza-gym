-- ============================================================================
--  Hamza Gym — 0024: Allow product deletion when fulfilled orders exist
--
--  1. Drop FK → re-add with ON DELETE CASCADE so deleting a product also
--     removes its associated orders (safe now that we allow manual deletion of
--     fulfilled/rejected orders).
--  2. Add DELETE policy so staff can clean up fulfilled/rejected orders.
--
--  Idempotent. Run after 0023.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  1. Rebuild FK constraint
-- ---------------------------------------------------------------------------
ALTER TABLE public.shop_orders
  DROP CONSTRAINT IF EXISTS shop_orders_product_id_fkey;

ALTER TABLE public.shop_orders
  ADD CONSTRAINT shop_orders_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.shop_products (id)
  ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
--  2. DELETE policy for shop_orders (staff can delete fulfilled/rejected)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff delete shop orders" ON public.shop_orders;
CREATE POLICY "Staff delete shop orders"
  ON public.shop_orders FOR DELETE
  USING (public.is_staff_or_admin());
