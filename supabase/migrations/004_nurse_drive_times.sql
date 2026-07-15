-- nurse_drive_times: cached driving distance from nurse home to each facility
-- Populated by /api/drive-time on first calculation; avoids recalculating every page load.
-- Cleared (delete by nurse_profile_id) when the nurse updates their home address.

CREATE TABLE IF NOT EXISTS nurse_drive_times (
  nurse_profile_id  UUID NOT NULL REFERENCES nurse_profiles(id) ON DELETE CASCADE,
  facility_id       UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  minutes           INTEGER,
  calculated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (nurse_profile_id, facility_id)
);

-- RLS: nurses can only read their own drive times; API route uses service role for writes
ALTER TABLE nurse_drive_times ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nurse_reads_own_drive_times" ON nurse_drive_times
  FOR SELECT USING (
    nurse_profile_id = get_my_nurse_profile_id()
  );
