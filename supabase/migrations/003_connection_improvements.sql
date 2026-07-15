-- ============================================================
-- Migration 003: Connection Request Improvements
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================
-- Changes:
--   1. Add initiated_by_role column to connection_requests
--   2. Add RLS policies so facility can insert + agency can update
--   3. Replace accept_connection RPC:
--      - Migrates confirmed placeholder shifts to the real facility
--      - Deletes remaining open/claimed placeholder shifts
--      - Returns migrated_shifts count in addition to deleted_shifts
-- ============================================================

-- ---------------------------------------------------------------
-- 1. Add initiated_by_role to connection_requests
-- ---------------------------------------------------------------
ALTER TABLE connection_requests
  ADD COLUMN IF NOT EXISTS initiated_by_role TEXT
    NOT NULL DEFAULT 'agency'
    CHECK (initiated_by_role IN ('agency', 'facility'));

-- ---------------------------------------------------------------
-- 2. RLS: facility can INSERT connection requests (facility-initiated)
-- ---------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'connection_requests'
      AND policyname = 'facility_insert'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "facility_insert" ON connection_requests
        FOR INSERT
        WITH CHECK (facility_id = get_my_facility_id())
    $policy$;
  END IF;
END
$$;

-- ---------------------------------------------------------------
-- 3. RLS: agency can UPDATE connection requests
--    (needed when facility initiates and agency responds)
-- ---------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'connection_requests'
      AND policyname = 'agency_responds'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "agency_responds" ON connection_requests
        FOR UPDATE
        USING (agency_id = get_my_agency_id())
    $policy$;
  END IF;
END
$$;

-- ---------------------------------------------------------------
-- 4. Updated accept_connection RPC
--    Now migrates confirmed placeholder shifts instead of deleting.
--    Must DROP first because the return type gains a new column.
-- ---------------------------------------------------------------
DROP FUNCTION IF EXISTS accept_connection(UUID, UUID);

-- Output columns use r_ prefix to avoid ambiguity with same-named table
-- columns (agency_id, facility_id, etc.) referenced inside the function body.
-- PL/pgSQL RETURNS TABLE columns become variables in scope, which causes
-- PostgreSQL error 42702 ("ambiguous column reference") on any unqualified
-- reference to those names — including in ON CONFLICT target lists.
CREATE OR REPLACE FUNCTION accept_connection(
  p_request_id   UUID,
  p_responded_by UUID
)
RETURNS TABLE (
  r_agency_id       UUID,
  r_placeholder_id  UUID,
  r_facility_id     UUID,
  r_deleted_shifts  BIGINT,
  r_migrated_shifts BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_req             RECORD;
  v_deleted_count   BIGINT;
  v_migrated_count  BIGINT;
BEGIN
  -- Lock and fetch the request
  SELECT cr.id, cr.agency_id, cr.facility_id, cr.placeholder_id, cr.status
  INTO v_req
  FROM connection_requests cr
  WHERE cr.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Connection request not found';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Connection request is not pending (status: %)', v_req.status;
  END IF;

  -- 1. Mark request accepted
  UPDATE connection_requests
  SET status       = 'accepted',
      responded_by = p_responded_by,
      responded_at = now()
  WHERE id = p_request_id;

  -- 2. Mark placeholder connected
  UPDATE placeholder_facilities
  SET connection_status = 'connected',
      updated_at        = now()
  WHERE id = v_req.placeholder_id;

  -- 3. Upsert agency_facility_connection.
  --    Use explicit INSERT + UPDATE instead of ON CONFLICT to avoid column
  --    name ambiguity between the table column and the r_* output params.
  UPDATE agency_facility_connections AS afc
  SET status      = 'active',
      accepted_at = now(),
      updated_at  = now()
  WHERE afc.agency_id  = v_req.agency_id
    AND afc.facility_id = v_req.facility_id;

  IF NOT FOUND THEN
    INSERT INTO agency_facility_connections (agency_id, facility_id, status, accepted_at)
    VALUES (v_req.agency_id, v_req.facility_id, 'active', now());
  END IF;

  -- 4. Migrate confirmed placeholder shifts to the real facility.
  --    Nurses keep their confirmed shifts — no disruption.
  UPDATE shifts
  SET facility_id             = v_req.facility_id,
      placeholder_facility_id = NULL
  WHERE placeholder_facility_id = v_req.placeholder_id
    AND status = 'confirmed';

  GET DIAGNOSTICS v_migrated_count = ROW_COUNT;

  -- 5. Delete remaining open / claimed placeholder shifts.
  --    Confirmed shifts are already moved (placeholder_facility_id = NULL),
  --    so they are not affected by this delete.
  DELETE FROM shifts
  WHERE placeholder_facility_id = v_req.placeholder_id;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN QUERY
    SELECT v_req.agency_id,
           v_req.placeholder_id,
           v_req.facility_id,
           v_deleted_count,
           v_migrated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION accept_connection(UUID, UUID) TO authenticated;
