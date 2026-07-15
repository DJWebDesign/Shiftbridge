-- 006: Schema catch-up
--
-- Several columns/tables were added directly in the Supabase Dashboard SQL
-- Editor without a migration file. This migration records them so a fresh
-- database built from this folder matches the live dev database.
--
-- Status against the live dev DB (verified 2026-07-06):
--   * placeholder_facilities.lat/lng        — ALREADY APPLIED (no-op here)
--   * agencies.house_for_facility_id        — ALREADY APPLIED (no-op here)
--   * facilities/placeholder facility_notes — ALREADY APPLIED (no-op here)
--   * demo_sessions rebuild                 — MUST RUN: the live table has an
--     old shape (session_token, ip_address, ...) that does NOT match what
--     /api/demo/launch writes (auth_user_id, agency_id, nurse_profile_ids, ...),
--     so demo launch fails until this runs. Table is empty; drop is safe.
--
-- Idempotent: safe to re-run.

-- Placeholder facility coordinates (captured from Places autocomplete;
-- used by /api/drive-time for placeholder shifts)
ALTER TABLE placeholder_facilities ADD COLUMN IF NOT EXISTS lat NUMERIC(10,7);
ALTER TABLE placeholder_facilities ADD COLUMN IF NOT EXISTS lng NUMERIC(10,7);

-- House agency pattern for facility staff enrollment
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS house_for_facility_id UUID REFERENCES facilities(id) UNIQUE;

-- Facility notes shown to nurses on shift cards
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS facility_notes TEXT;
ALTER TABLE placeholder_facilities ADD COLUMN IF NOT EXISTS facility_notes TEXT;

-- Rebuild demo_sessions with the shape /api/demo/launch and /api/demo/cleanup expect.
-- analytics_events.demo_session_id has an FK to demo_sessions (001), which blocks
-- a plain DROP — detach it first, then re-attach it to the rebuilt table.
ALTER TABLE analytics_events DROP CONSTRAINT IF EXISTS analytics_events_demo_session_id_fkey;
DROP TABLE IF EXISTS demo_sessions;
CREATE TABLE demo_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id         UUID,
  facility_id       UUID,
  nurse_profile_ids UUID[] DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL
);

-- Any demo_session_id values in analytics_events reference the dropped table's
-- rows and are meaningless — null them before re-adding the constraint.
UPDATE analytics_events SET demo_session_id = NULL WHERE demo_session_id IS NOT NULL;
ALTER TABLE analytics_events
  ADD CONSTRAINT analytics_events_demo_session_id_fkey
  FOREIGN KEY (demo_session_id) REFERENCES demo_sessions(id) ON DELETE SET NULL;
