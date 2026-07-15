-- Feature 1: Shift Notes
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS notes TEXT;

-- Feature 6: Agency Profile / Public Info
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Feature 5: Claim Approval Workflow
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS require_claim_approval BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE shift_claims ADD COLUMN IF NOT EXISTS agency_approved_at TIMESTAMPTZ;
ALTER TABLE shift_claims ADD COLUMN IF NOT EXISTS agency_approved_by UUID REFERENCES profiles(id);

-- Feature 4: Notification Preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id)
);
