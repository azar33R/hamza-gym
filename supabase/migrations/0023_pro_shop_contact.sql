-- ============================================================================
--  Hamza Gym — 0023: Pro Shop contact info + photo upload bucket
--
--  1. Storage bucket for admin-uploaded shop product photos
--  2. Contact-info columns on shop_orders (replaces Vodafone Cash capture)
--
--  Idempotent. Run in the Supabase SQL Editor after 0022.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  1. Storage bucket: shop-products
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
SELECT 'shop-products', 'shop-products', true, false, 52428800, NULL
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'shop-products');

-- Anyone can read shop product images (public bucket).
DROP POLICY IF EXISTS "Shop products readable by everyone" ON storage.objects;
CREATE POLICY "Shop products readable by everyone"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'shop-products');

-- Only staff/admin can upload/delete.
DROP POLICY IF EXISTS "Shop products writable by staff" ON storage.objects;
CREATE POLICY "Shop products writable by staff"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'shop-products' AND public.is_staff_or_admin());

DROP POLICY IF EXISTS "Shop products deletable by staff" ON storage.objects;
CREATE POLICY "Shop products deletable by staff"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'shop-products' AND public.is_staff_or_admin());

-- ---------------------------------------------------------------------------
--  2. Contact-info columns on shop_orders (nullable, so existing rows keep
--     their sender_wallet / txn_id history).
-- ---------------------------------------------------------------------------
ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS contact_name  text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_notes text;
