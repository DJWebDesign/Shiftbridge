-- ============================================================
-- Phase 10: Address Matching & Connection Request Flow
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. accept_connection RPC
--    Called by facility admin to accept a connection request.
--    Atomically:
--      1. Marks connection_requests.status = 'accepted'
--      2. Marks placeholder_facilities.connection_status = 'connected'
--      3. Inserts agency_facility_connections
--      4. Deletes all shifts for the placeholder facility
--    Returns the agency_id so the caller can send a notification.
-- ============================================================

CREATE OR REPLACE FUNCTION accept_connection(
  p_request_id   UUID,
  p_responded_by UUID
)
RETURNS TABLE (
  agency_id         UUID,
  placeholder_id    UUID,
  facility_id       UUID,
  deleted_shifts    BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_req               RECORD;
  v_deleted_count     BIGINT;
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

  -- 3. Insert agency_facility_connection (ignore if already exists)
  INSERT INTO agency_facility_connections (agency_id, facility_id, status, accepted_at)
  VALUES (v_req.agency_id, v_req.facility_id, 'active', now())
  ON CONFLICT (agency_id, facility_id) DO UPDATE
    SET status      = 'active',
        accepted_at = now(),
        updated_at  = now();

  -- 4. Delete all shifts linked to the placeholder facility
  DELETE FROM shifts
  WHERE placeholder_facility_id = v_req.placeholder_id;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN QUERY SELECT v_req.agency_id, v_req.placeholder_id, v_req.facility_id, v_deleted_count;
END;
$$;

-- ============================================================
-- 2. DB trigger on facilities INSERT:
--    When a real facility is created, scan placeholder_facilities
--    for an address + facility_type match and mark connection_status.
--    Also inserts an in-app notification for the agency admin.
-- ============================================================

CREATE OR REPLACE FUNCTION detect_placeholder_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_placeholder  RECORD;
  v_agency_admin RECORD;
BEGIN
  -- Find any placeholder facility with matching address_normalized + facility_type
  FOR v_placeholder IN
    SELECT pf.id, pf.agency_id, pf.name
    FROM placeholder_facilities pf
    WHERE pf.address_normalized = NEW.address_normalized
      AND pf.facility_type      = NEW.facility_type
      AND pf.connection_status  = 'unmatched'
  LOOP
    -- Mark as match_detected
    UPDATE placeholder_facilities
    SET connection_status   = 'match_detected',
        matched_facility_id = NEW.id,
        updated_at          = now()
    WHERE id = v_placeholder.id;

    -- Notify agency admin in-app
    SELECT aa.profile_id
    INTO v_agency_admin
    FROM agency_admins aa
    WHERE aa.agency_id = v_placeholder.agency_id
    LIMIT 1;

    IF FOUND THEN
      INSERT INTO notifications (profile_id, channel, event_type, message, payload)
      VALUES (
        v_agency_admin.profile_id,
        'in_app',
        'match_detected',
        'A real facility matching "' || v_placeholder.name || '" has joined ShiftBridge. Send a connection request to link your account.',
        jsonb_build_object(
          'placeholder_id', v_placeholder.id,
          'facility_id',    NEW.id
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Drop trigger if it already exists to allow re-running this migration
DROP TRIGGER IF EXISTS trg_detect_placeholder_match ON facilities;

CREATE TRIGGER trg_detect_placeholder_match
  AFTER INSERT ON facilities
  FOR EACH ROW
  EXECUTE FUNCTION detect_placeholder_match();

-- ============================================================
-- 3. Grant execute on the RPC to authenticated users
--    (facility admins call it via supabase.rpc())
-- ============================================================

GRANT EXECUTE ON FUNCTION accept_connection(UUID, UUID) TO authenticated;
