-- ============================================================
-- ShiftBridge Initial Schema Migration v2
-- Tables first → Functions → Policies → Triggers
-- ============================================================

-- ============================================================
-- TABLES (no policies yet)
-- ============================================================

CREATE TABLE profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL CHECK (role IN ('super_admin','agency_admin','facility_admin','nurse')),
  full_name   TEXT        NOT NULL,
  email       TEXT        NOT NULL UNIQUE,
  phone       TEXT,
  avatar_url  TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_role  ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);

-- ---------------------------------------------------------------

CREATE TABLE agencies (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  address     TEXT,
  city        TEXT,
  state       TEXT,
  zip         TEXT,
  phone       TEXT,
  status      TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deactivated')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------

CREATE TABLE agency_admins (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID        NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  agency_id   UUID        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agency_admins_agency_id ON agency_admins(agency_id);

-- ---------------------------------------------------------------

CREATE TABLE facilities (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL,
  facility_type       TEXT        NOT NULL CHECK (facility_type IN ('long_term_care','assisted_living','hospital','rehabilitation','memory_care')),
  address_line1       TEXT        NOT NULL,
  address_line2       TEXT,
  city                TEXT        NOT NULL,
  state               TEXT        NOT NULL,
  zip                 TEXT        NOT NULL,
  address_normalized  TEXT        NOT NULL,
  lat                 NUMERIC(10,7),
  lng                 NUMERIC(10,7),
  status              TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deactivated')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_facilities_address_norm ON facilities(address_normalized);
CREATE INDEX idx_facilities_status       ON facilities(status);

-- ---------------------------------------------------------------

CREATE TABLE facility_admins (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID        NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  facility_id UUID        NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_facility_admins_facility_id ON facility_admins(facility_id);

-- ---------------------------------------------------------------

CREATE TABLE agency_facility_connections (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     UUID        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  facility_id   UUID        NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  bill_rate     NUMERIC(8,2),
  status        TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','inactive')),
  requested_by  UUID        REFERENCES profiles(id),
  requested_at  TIMESTAMPTZ,
  accepted_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agency_id, facility_id)
);
CREATE INDEX idx_afc_agency_id   ON agency_facility_connections(agency_id);
CREATE INDEX idx_afc_facility_id ON agency_facility_connections(facility_id);

-- ---------------------------------------------------------------

CREATE TABLE facility_shift_configs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id      UUID        NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  credential_type  TEXT        NOT NULL CHECK (credential_type IN ('CNA','CMA','LPN','LPN_IV','RN')),
  shift_name       TEXT        NOT NULL,
  start_time       TIME        NOT NULL,
  end_time         TIME        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(facility_id, credential_type, shift_name)
);
CREATE INDEX idx_fsc_facility_id ON facility_shift_configs(facility_id);

-- ---------------------------------------------------------------

CREATE TABLE pay_tier_configs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     UUID        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  tier_number   SMALLINT    NOT NULL CHECK (tier_number IN (1,2,3)),
  custom_label  TEXT        NOT NULL DEFAULT '',
  bonus_amount  NUMERIC(8,2) NOT NULL DEFAULT 0,
  bonus_type    TEXT        NOT NULL DEFAULT 'per_hour' CHECK (bonus_type IN ('per_hour','flat')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agency_id, tier_number)
);

-- ---------------------------------------------------------------

CREATE TABLE nurse_profiles (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          UUID        NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  license_number      TEXT        NOT NULL,
  license_state       TEXT        NOT NULL,
  credential_type     TEXT        NOT NULL CHECK (credential_type IN ('CNA','CMA','LPN','LPN_IV','RN')),
  license_status      TEXT        NOT NULL DEFAULT 'active' CHECK (license_status IN ('active','expired','suspended','revoked')),
  license_expiration  DATE,
  iv_certified        BOOLEAN     NOT NULL DEFAULT false,
  iv_cert_source      TEXT        CHECK (iv_cert_source IN ('manual','implicit_rn')),
  cpr_expiration      DATE,
  tb_test_date        DATE,
  covid_vaccinated    BOOLEAN     NOT NULL DEFAULT false,
  phone               TEXT,
  home_address        TEXT,
  home_address_lat    NUMERIC(10,7),
  home_address_lng    NUMERIC(10,7),
  profile_photo_url   TEXT,
  nursys_last_checked TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(license_number, license_state)
);
CREATE INDEX idx_np_credential_type ON nurse_profiles(credential_type);
CREATE INDEX idx_np_license         ON nurse_profiles(license_number, license_state);

-- ---------------------------------------------------------------

CREATE TABLE agency_nurse_relationships (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id        UUID        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  nurse_profile_id UUID        NOT NULL REFERENCES nurse_profiles(id) ON DELETE CASCADE,
  base_pay_rate    NUMERIC(8,2),
  notes            TEXT,
  status           TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agency_id, nurse_profile_id)
);
CREATE INDEX idx_anr_agency_id        ON agency_nurse_relationships(agency_id);
CREATE INDEX idx_anr_nurse_profile_id ON agency_nurse_relationships(nurse_profile_id);

-- ---------------------------------------------------------------

CREATE TABLE placeholder_facilities (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id           UUID        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name                TEXT        NOT NULL,
  facility_type       TEXT        NOT NULL CHECK (facility_type IN ('long_term_care','assisted_living','hospital','rehabilitation','memory_care')),
  address_line1       TEXT        NOT NULL,
  address_line2       TEXT,
  city                TEXT        NOT NULL,
  state               TEXT        NOT NULL,
  zip                 TEXT        NOT NULL,
  address_normalized  TEXT        NOT NULL,
  coordinator_email   TEXT,
  matched_facility_id UUID        REFERENCES facilities(id),
  connection_status   TEXT        NOT NULL DEFAULT 'unmatched' CHECK (connection_status IN ('unmatched','match_detected','request_pending','connected','declined')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pf_agency_id    ON placeholder_facilities(agency_id);
CREATE INDEX idx_pf_address_norm ON placeholder_facilities(address_normalized);

-- ---------------------------------------------------------------

CREATE TABLE connection_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       UUID        NOT NULL REFERENCES agencies(id),
  facility_id     UUID        NOT NULL REFERENCES facilities(id),
  placeholder_id  UUID        NOT NULL REFERENCES placeholder_facilities(id),
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  requested_by    UUID        REFERENCES profiles(id),
  responded_by    UUID        REFERENCES profiles(id),
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at    TIMESTAMPTZ,
  message         TEXT
);

-- ---------------------------------------------------------------

CREATE TABLE shifts (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id             UUID        REFERENCES facilities(id),
  placeholder_facility_id UUID        REFERENCES placeholder_facilities(id),
  agency_id               UUID        REFERENCES agencies(id),
  credential_required     TEXT        NOT NULL CHECK (credential_required IN ('CNA','CMA','LPN','LPN_IV','RN')),
  shift_date              DATE        NOT NULL,
  start_time              TIME        NOT NULL,
  end_time                TIME        NOT NULL,
  priority_tier           SMALLINT    NOT NULL DEFAULT 1 CHECK (priority_tier IN (1,2,3)),
  status                  TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open','claimed','confirmed','canceled','filled')),
  is_placeholder          BOOLEAN     NOT NULL DEFAULT false,
  posted_by               UUID        NOT NULL REFERENCES profiles(id),
  canceled_by             UUID        REFERENCES profiles(id),
  canceled_at             TIMESTAMPTZ,
  cancel_reason           TEXT,
  is_late_cancel          BOOLEAN     DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shifts_facility_xor CHECK (
    (facility_id IS NOT NULL AND placeholder_facility_id IS NULL) OR
    (facility_id IS NULL AND placeholder_facility_id IS NOT NULL)
  )
);
CREATE INDEX idx_shifts_facility_id    ON shifts(facility_id);
CREATE INDEX idx_shifts_placeholder_id ON shifts(placeholder_facility_id);
CREATE INDEX idx_shifts_date_status    ON shifts(shift_date, status);
CREATE INDEX idx_shifts_credential     ON shifts(credential_required, status);
CREATE INDEX idx_shifts_agency_id      ON shifts(agency_id);

-- ---------------------------------------------------------------

CREATE TABLE shift_claims (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id         UUID        NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  nurse_profile_id UUID        NOT NULL REFERENCES nurse_profiles(id),
  agency_id        UUID        NOT NULL REFERENCES agencies(id),
  status           TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected','withdrawn')),
  claimed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at     TIMESTAMPTZ,
  confirmed_by     UUID        REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shift_id, nurse_profile_id)
);
CREATE INDEX idx_sc_shift_id ON shift_claims(shift_id);
CREATE INDEX idx_sc_nurse_id ON shift_claims(nurse_profile_id);
CREATE INDEX idx_sc_status   ON shift_claims(status);

-- ---------------------------------------------------------------

CREATE TABLE dnr_records (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id      UUID        NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  nurse_profile_id UUID        NOT NULL REFERENCES nurse_profiles(id) ON DELETE CASCADE,
  agency_id        UUID        NOT NULL REFERENCES agencies(id),
  created_by       UUID        NOT NULL REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(facility_id, nurse_profile_id)
);
CREATE INDEX idx_dnr_facility_id ON dnr_records(facility_id);
CREATE INDEX idx_dnr_nurse_id    ON dnr_records(nurse_profile_id);
CREATE INDEX idx_dnr_agency_id   ON dnr_records(agency_id);

-- ---------------------------------------------------------------

CREATE TABLE notifications (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id       UUID        REFERENCES profiles(id),
  recipient_email  TEXT,
  recipient_phone  TEXT,
  channel          TEXT        NOT NULL CHECK (channel IN ('sms','in_app','email')),
  event_type       TEXT        NOT NULL,
  message          TEXT        NOT NULL,
  payload          JSONB       DEFAULT '{}',
  read_at          TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,
  status           TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_profile_id ON notifications(profile_id);
CREATE INDEX idx_notifications_unread     ON notifications(profile_id) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_status     ON notifications(status);

-- ---------------------------------------------------------------

CREATE TABLE placeholder_confirm_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id    UUID        NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  token       TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  email       TEXT        NOT NULL,
  used_at     TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------

CREATE TABLE demo_sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token    TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour'),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address       TEXT,
  user_agent       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------

CREATE TABLE analytics_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_session_id UUID        REFERENCES demo_sessions(id) ON DELETE SET NULL,
  profile_id      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  event_type      TEXT        NOT NULL,
  event_data      JSONB       DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ae_event_type ON analytics_events(event_type);
CREATE INDEX idx_ae_created_at ON analytics_events(created_at);

-- ============================================================
-- VIEWS
-- ============================================================

-- Strips private fields before facility admins can see nurse data
CREATE VIEW nurse_profiles_facility_view AS
  SELECT
    id, profile_id, license_number, license_state,
    credential_type, license_status, license_expiration,
    iv_certified, cpr_expiration, tb_test_date,
    covid_vaccinated, phone, profile_photo_url,
    created_at, updated_at
  FROM nurse_profiles;

-- ============================================================
-- HELPER FUNCTIONS (tables now exist)
-- ============================================================

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_my_agency_id()
RETURNS UUID AS $$
  SELECT agency_id FROM agency_admins WHERE profile_id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_my_facility_id()
RETURNS UUID AS $$
  SELECT facility_id FROM facility_admins WHERE profile_id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_my_nurse_profile_id()
RETURNS UUID AS $$
  SELECT id FROM nurse_profiles WHERE profile_id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_visible_credentials(p_nurse_id UUID)
RETURNS TEXT[] AS $$
  SELECT CASE credential_type
    WHEN 'CNA'    THEN ARRAY['CNA']
    WHEN 'CMA'    THEN ARRAY['CNA','CMA']
    WHEN 'LPN'    THEN ARRAY['LPN']
    WHEN 'LPN_IV' THEN ARRAY['LPN','LPN_IV']
    WHEN 'RN'     THEN ARRAY['RN','LPN','LPN_IV']
  END
  FROM nurse_profiles WHERE id = p_nurse_id
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE profiles                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE agencies                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_admins              ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilities                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_admins            ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_facility_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_shift_configs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pay_tier_configs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE nurse_profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_nurse_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE placeholder_facilities     ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_requests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_claims               ENABLE ROW LEVEL SECURITY;
ALTER TABLE dnr_records                ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications              ENABLE ROW LEVEL SECURITY;
ALTER TABLE placeholder_confirm_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_sessions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events           ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- profiles
CREATE POLICY "own_profile_select"              ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "own_profile_update"              ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "super_admin_all"                 ON profiles FOR ALL    USING (get_my_role() = 'super_admin');
CREATE POLICY "agency_admin_select_nurses"      ON profiles FOR SELECT USING (
  role = 'nurse' AND id IN (
    SELECT np.profile_id FROM nurse_profiles np
    JOIN agency_nurse_relationships anr ON anr.nurse_profile_id = np.id
    WHERE anr.agency_id = get_my_agency_id()
  )
);
CREATE POLICY "facility_admin_select_claimants" ON profiles FOR SELECT USING (
  role = 'nurse' AND id IN (
    SELECT np.profile_id FROM nurse_profiles np
    JOIN shift_claims sc ON sc.nurse_profile_id = np.id
    JOIN shifts s ON s.id = sc.shift_id
    WHERE s.facility_id = get_my_facility_id()
  )
);

-- agencies
CREATE POLICY "own_agency_select"       ON agencies FOR SELECT USING (id = get_my_agency_id());
CREATE POLICY "super_admin_all"         ON agencies FOR ALL    USING (get_my_role() = 'super_admin');
CREATE POLICY "facility_sees_connected" ON agencies FOR SELECT USING (
  id IN (
    SELECT agency_id FROM agency_facility_connections
    WHERE facility_id = get_my_facility_id() AND status = 'active'
  )
);

-- agency_admins
CREATE POLICY "own_record"      ON agency_admins FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY "super_admin_all" ON agency_admins FOR ALL    USING (get_my_role() = 'super_admin');

-- facilities
CREATE POLICY "facility_admin_own"    ON facilities FOR SELECT USING (id = get_my_facility_id());
CREATE POLICY "agency_sees_connected" ON facilities FOR SELECT USING (
  id IN (
    SELECT facility_id FROM agency_facility_connections
    WHERE agency_id = get_my_agency_id() AND status = 'active'
  )
);
CREATE POLICY "super_admin_all"       ON facilities FOR ALL USING (get_my_role() = 'super_admin');

-- facility_admins
CREATE POLICY "own_record"      ON facility_admins FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY "super_admin_all" ON facility_admins FOR ALL    USING (get_my_role() = 'super_admin');

-- agency_facility_connections
CREATE POLICY "agency_sees_own"   ON agency_facility_connections FOR SELECT USING (agency_id = get_my_agency_id());
CREATE POLICY "facility_sees_own" ON agency_facility_connections FOR SELECT USING (facility_id = get_my_facility_id());
CREATE POLICY "super_admin_all"   ON agency_facility_connections FOR ALL    USING (get_my_role() = 'super_admin');

-- facility_shift_configs
CREATE POLICY "facility_admin_manages" ON facility_shift_configs FOR ALL USING (facility_id = get_my_facility_id());
CREATE POLICY "super_admin_all"        ON facility_shift_configs FOR ALL USING (get_my_role() = 'super_admin');

-- pay_tier_configs
CREATE POLICY "agency_admin_manages" ON pay_tier_configs FOR ALL USING (agency_id = get_my_agency_id());
CREATE POLICY "super_admin_all"      ON pay_tier_configs FOR ALL USING (get_my_role() = 'super_admin');

-- nurse_profiles
CREATE POLICY "own_nurse_profile"       ON nurse_profiles FOR ALL    USING (profile_id = auth.uid());
CREATE POLICY "agency_admin_manages"    ON nurse_profiles FOR ALL    USING (
  id IN (SELECT nurse_profile_id FROM agency_nurse_relationships WHERE agency_id = get_my_agency_id())
);
CREATE POLICY "facility_sees_claimants" ON nurse_profiles FOR SELECT USING (
  id IN (
    SELECT sc.nurse_profile_id FROM shift_claims sc
    JOIN shifts s ON s.id = sc.shift_id
    WHERE s.facility_id = get_my_facility_id()
  )
);
CREATE POLICY "super_admin_all"         ON nurse_profiles FOR ALL    USING (get_my_role() = 'super_admin');

-- agency_nurse_relationships
CREATE POLICY "own_agency_anr"  ON agency_nurse_relationships FOR ALL    USING (agency_id = get_my_agency_id());
CREATE POLICY "nurse_sees_own"  ON agency_nurse_relationships FOR SELECT USING (nurse_profile_id = get_my_nurse_profile_id());
CREATE POLICY "super_admin_all" ON agency_nurse_relationships FOR ALL    USING (get_my_role() = 'super_admin');

-- placeholder_facilities
CREATE POLICY "agency_admin_manages" ON placeholder_facilities FOR ALL USING (agency_id = get_my_agency_id());
CREATE POLICY "super_admin_all"      ON placeholder_facilities FOR ALL USING (get_my_role() = 'super_admin');

-- connection_requests
CREATE POLICY "agency_sees_own"   ON connection_requests FOR SELECT     USING (agency_id = get_my_agency_id());
CREATE POLICY "agency_insert"     ON connection_requests FOR INSERT WITH CHECK (agency_id = get_my_agency_id());
CREATE POLICY "facility_sees_own" ON connection_requests FOR SELECT     USING (facility_id = get_my_facility_id());
CREATE POLICY "facility_responds" ON connection_requests FOR UPDATE     USING (facility_id = get_my_facility_id());
CREATE POLICY "super_admin_all"   ON connection_requests FOR ALL        USING (get_my_role() = 'super_admin');

-- shifts
CREATE POLICY "facility_admin_manages"     ON shifts FOR ALL    USING (facility_id = get_my_facility_id());
CREATE POLICY "agency_sees_connected"      ON shifts FOR SELECT USING (
  (facility_id IN (
    SELECT facility_id FROM agency_facility_connections
    WHERE agency_id = get_my_agency_id() AND status = 'active'
  ))
  OR (is_placeholder = true AND agency_id = get_my_agency_id())
);
CREATE POLICY "agency_manages_placeholder" ON shifts FOR ALL    USING (is_placeholder = true AND agency_id = get_my_agency_id());
CREATE POLICY "nurse_sees_open_shifts"     ON shifts FOR SELECT USING (
  status = 'open'
  AND credential_required = ANY(get_visible_credentials(get_my_nurse_profile_id()))
  AND (
    facility_id IS NULL
    OR facility_id NOT IN (
      SELECT facility_id FROM dnr_records WHERE nurse_profile_id = get_my_nurse_profile_id()
    )
  )
);
CREATE POLICY "nurse_sees_own_confirmed"   ON shifts FOR SELECT USING (
  id IN (
    SELECT shift_id FROM shift_claims
    WHERE nurse_profile_id = get_my_nurse_profile_id() AND status = 'confirmed'
  )
);
CREATE POLICY "super_admin_all"            ON shifts FOR ALL    USING (get_my_role() = 'super_admin');

-- shift_claims
CREATE POLICY "nurse_manages_own"        ON shift_claims FOR ALL    USING (nurse_profile_id = get_my_nurse_profile_id());
CREATE POLICY "facility_sees_for_shifts" ON shift_claims FOR SELECT USING (
  shift_id IN (SELECT id FROM shifts WHERE facility_id = get_my_facility_id())
);
CREATE POLICY "facility_confirms"        ON shift_claims FOR UPDATE USING (
  shift_id IN (SELECT id FROM shifts WHERE facility_id = get_my_facility_id())
);
CREATE POLICY "agency_sees_own"          ON shift_claims FOR SELECT USING (agency_id = get_my_agency_id());
CREATE POLICY "super_admin_all"          ON shift_claims FOR ALL    USING (get_my_role() = 'super_admin');

-- dnr_records
CREATE POLICY "facility_admin_insert" ON dnr_records FOR INSERT WITH CHECK (facility_id = get_my_facility_id());
CREATE POLICY "facility_sees_own"     ON dnr_records FOR SELECT USING (facility_id = get_my_facility_id());
CREATE POLICY "agency_sees_own_staff" ON dnr_records FOR SELECT USING (agency_id = get_my_agency_id());
CREATE POLICY "super_admin_all"       ON dnr_records FOR ALL    USING (get_my_role() = 'super_admin');

-- notifications
CREATE POLICY "own_notifications" ON notifications FOR ALL USING (profile_id = auth.uid());
CREATE POLICY "super_admin_all"   ON notifications FOR ALL USING (get_my_role() = 'super_admin');

-- placeholder_confirm_tokens (only accessible via service role in API routes)
CREATE POLICY "super_admin_all" ON placeholder_confirm_tokens FOR ALL USING (get_my_role() = 'super_admin');

-- demo_sessions
CREATE POLICY "super_admin_all" ON demo_sessions FOR ALL USING (get_my_role() = 'super_admin');

-- analytics_events
CREATE POLICY "super_admin_all" ON analytics_events FOR ALL USING (get_my_role() = 'super_admin');

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at               BEFORE UPDATE ON profiles                    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_agencies_updated_at               BEFORE UPDATE ON agencies                    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_facilities_updated_at             BEFORE UPDATE ON facilities                  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_afc_updated_at                    BEFORE UPDATE ON agency_facility_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_nurse_profiles_updated_at         BEFORE UPDATE ON nurse_profiles              FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_anr_updated_at                    BEFORE UPDATE ON agency_nurse_relationships  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_placeholder_facilities_updated_at BEFORE UPDATE ON placeholder_facilities      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_shifts_updated_at                 BEFORE UPDATE ON shifts                      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_shift_claims_updated_at           BEFORE UPDATE ON shift_claims                FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_pay_tier_configs_updated_at       BEFORE UPDATE ON pay_tier_configs            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
