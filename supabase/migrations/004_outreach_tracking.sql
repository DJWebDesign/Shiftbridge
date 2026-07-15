-- ============================================================
-- Migration 004: Outreach tracking
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- Saved outreach contacts per facility
-- Stores agency email addresses a facility has sent shift-needs emails to.
-- platform_outreach_sent_at reserved for future super-admin one-time invite feature.
CREATE TABLE IF NOT EXISTS facility_outreach_contacts (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id               UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  email                     TEXT NOT NULL,
  label                     TEXT,                     -- optional friendly name e.g. "Sunrise Staffing"
  last_used_at              TIMESTAMPTZ,              -- updated each time this address is sent to
  platform_outreach_sent_at TIMESTAMPTZ,              -- when ShiftBridge last sent a platform invite here
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id, email)
);

-- CTA click events
-- Captures clicks on "Learn About ShiftBridge" (coordinator confirm/decline pages)
-- and "Claim These Shifts on ShiftBridge →" (outreach emails).
-- All inserts use service-role; no RLS needed.
CREATE TABLE IF NOT EXISTS cta_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT NOT NULL,              -- 'coordinator_confirm' | 'coordinator_decline' | 'outreach_email'
  facility_id UUID REFERENCES facilities(id),
  token_id    UUID REFERENCES placeholder_confirm_tokens(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
