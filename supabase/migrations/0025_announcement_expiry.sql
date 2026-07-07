-- ============================================================================
--  Hamza Gym — 0025: Announcement expiration
--
--  Adds an optional expires_at column to notifications so coaches can set
--  how long a broadcast announcement stays visible on subscriber dashboards.
--  NULL means never expire (backward-compatible with existing rows).
--
--  Idempotent. Run after 0024.
-- ============================================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;
