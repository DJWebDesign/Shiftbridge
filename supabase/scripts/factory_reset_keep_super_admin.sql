-- ================================================================
-- FACTORY RESET — 2026-07-15
-- Wipes ALL application data and EVERY login except the super admin
-- (derrickjagneaux@gmail.com). For a clean-slate walkthrough of
-- signup and all workflows.
--
-- Run in: Supabase Dashboard → SQL Editor.
-- Safe to re-run. Aborts before deleting anything if the super
-- admin account can't be found.
--
-- NOTE: run supabase/migrations/006_schema_catchup.sql FIRST if you
-- haven't yet — it rebuilds demo_sessions to the shape the demo
-- launch/cleanup routes expect.
-- ================================================================

-- Guard: abort if the super admin isn't there.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'derrickjagneaux@gmail.com') THEN
    RAISE EXCEPTION 'Super admin derrickjagneaux@gmail.com not found — aborting, nothing deleted.';
  END IF;
END $$;

BEGIN;

-- 1. Wipe every application table (CASCADE resolves FK ordering).
--    profiles is NOT truncated — the super admin's row lives there;
--    everyone else's profile is removed by the auth.users delete below.
TRUNCATE TABLE
  notifications,
  notification_preferences,
  analytics_events,
  cta_events,
  facility_outreach_contacts,
  nurse_drive_times,
  placeholder_confirm_tokens,
  dnr_records,
  shift_claims,
  shifts,
  connection_requests,
  placeholder_facilities,
  agency_facility_connections,
  agency_nurse_relationships,
  facility_shift_configs,
  pay_tier_configs,
  nurse_profiles,
  agency_admins,
  facility_admins,
  facilities,
  agencies,
  demo_sessions
CASCADE;

-- 2. Delete every login except the super admin.
--    profiles.id → auth.users(id) is ON DELETE CASCADE, so each
--    deleted auth user takes their profile (and auth sessions,
--    identities, refresh tokens) with them.
DELETE FROM auth.users
WHERE email <> 'derrickjagneaux@gmail.com';

COMMIT;

-- Verify: each of these should return exactly one row — you.
SELECT id, email FROM auth.users;
SELECT id, email, role FROM profiles;
