-- ============================================================
-- Migration 007: Address-only placeholder matching
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================
-- Two independently-entered records for the same building often
-- disagree on facility_type (e.g. "Long-Term Care" vs "Memory Care"
-- for the same address, entered by two different people). A match
-- only ever produces an in-app suggestion -- the agency still has to
-- send a connection request and the facility still has to accept it
-- -- so requiring exact facility_type equality was unnecessary
-- friction that silently prevented real matches from ever firing.
-- Match on address_normalized alone.
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
  -- Find any placeholder facility with matching address_normalized
  FOR v_placeholder IN
    SELECT pf.id, pf.agency_id, pf.name
    FROM placeholder_facilities pf
    WHERE pf.address_normalized = NEW.address_normalized
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

-- Trigger definition is unchanged (still points at this function by name);
-- CREATE OR REPLACE FUNCTION updates its body in place, no need to re-create it.
