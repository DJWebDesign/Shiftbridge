-- 005: Allow 'agency_review' in shift_claims.status
--
-- 003_feature_additions.sql added the claim approval workflow
-- (agencies.require_claim_approval + shift_claims.agency_approved_at/by)
-- but never widened the CHECK constraint from 001_initial_schema.sql,
-- so claims fail with 23514 whenever require_claim_approval is on.
--
-- Idempotent: safe to re-run.

ALTER TABLE shift_claims DROP CONSTRAINT IF EXISTS shift_claims_status_check;

ALTER TABLE shift_claims ADD CONSTRAINT shift_claims_status_check
  CHECK (status IN ('pending', 'confirmed', 'rejected', 'withdrawn', 'agency_review'));
