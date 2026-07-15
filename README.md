# ShiftBridge

Per diem nursing shift staffing platform. Facilities post shifts; staffing agencies assign nurses to claim them.

## Roles

| Role | Description |
|------|-------------|
| `super_admin` | Platform administration, account management |
| `agency_admin` | Manages nurses, views shifts across connected facilities |
| `facility_admin` | Posts shifts, reviews and confirms claims |
| `nurse` | Claims available shifts, views schedule |

## Stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **Styling:** Tailwind CSS v4
- **Database/Auth:** Supabase (hosted, Row Level Security)
- **SMS:** Twilio (optional)
- **Email:** Resend (optional)
- **Maps:** Google Maps Distance Matrix + Places API (optional)

## Getting Started

```bash
npm install
npm run dev       # http://localhost:3000
```

### Environment Variables

Copy `.env.local.example` (or create `.env.local`) with the following:

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Optional — SMS notifications
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# Optional — Email notifications
RESEND_API_KEY=
RESEND_FROM_ADDRESS=

# Optional — Drive times + address autocomplete
GOOGLE_MAPS_API_KEY=

# Optional — Production email links
NEXT_PUBLIC_SITE_URL=https://yourdomain.com

# Dev only — redirect all outgoing emails to this address
RESEND_DEV_OVERRIDE_EMAIL=
```

Features degrade gracefully when optional keys are absent — SMS/email are silently skipped, drive times show as null, address autocomplete falls back to plain text input.

## Database Migrations

No Supabase CLI — paste SQL directly into **Supabase Dashboard → SQL Editor**.

```
supabase/migrations/
  001_initial_schema.sql          — full schema
  002_phase10_address_matching.sql — address matching trigger + RPC
  003_feature_additions.sql       — shift notes, agency profile, claim approval, notification preferences
  004_outreach_tracking.sql       — outreach contacts + CTA tracking
```

Also required for demo mode:

```sql
CREATE TABLE demo_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id UUID,
  facility_id UUID,
  nurse_profile_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
```

Required RLS policies (paste into SQL Editor):

```sql
-- Nurses read active facility names
CREATE POLICY "nurse_reads_active_facilities" ON facilities
FOR SELECT USING (status = 'active');

-- Nurses read pay tier configs for their agencies
CREATE POLICY "nurse_reads_own_agency_tiers" ON pay_tier_configs
FOR SELECT USING (
  agency_id IN (
    SELECT agency_id FROM agency_nurse_relationships
    WHERE nurse_profile_id = get_my_nurse_profile_id()
      AND status = 'active'
  )
);
```

## Commands

```bash
npm run dev       # Dev server at http://localhost:3000
npm run build     # Type-check + compile
npm run lint      # ESLint
npm run start     # Serve production build
npx tsc --noEmit  # Type-check only
```

## Test Accounts

| Email | Password | Role |
|-------|----------|------|
| agency@test.com | TestPass123! | agency_admin → Sunrise Staffing |
| facility@test.com | TestPass123! | facility_admin → Oakwood Care Center |

Seed test data (requires super_admin): navigate to `/admin/seed` and click **Run Seed**. Creates 3 facilities, 5 test nurses (one per credential type), and ~30 open shifts. Idempotent.

## Interactive Demo

A one-click demo environment can be launched from the login page. Each demo session seeds an isolated agency, two facilities, nurses, shifts, and a placeholder facility — all scoped to that session and automatically cleaned up after 4 hours.

Demo cleanup (super_admin): `POST /api/demo/cleanup` or use the **Demo Sessions** tab in the admin dashboard.

## Key Features

- **Shift calendar** — facility and agency views with real-time updates via Supabase postgres_changes
- **Claim workflow** — double-booking check, optional agency pre-approval, coordinator one-click confirm/decline via email
- **Placeholder facilities** — agencies post shifts before a real Supabase connection exists; address matching auto-detects when the real facility signs up
- **Notifications** — in-app (real-time bell), SMS (Twilio), email (Resend); per-user opt-out preferences
- **Drive times** — Google Distance Matrix shows nurses their commute to each facility; cached in sessionStorage
- **Shift needs outreach email** — facility admins email off-platform agencies a branded shift availability summary
- **DNR system** — facilities flag nurses; cancels future confirmed shifts and hides that facility from the nurse's shift feed
- **Fill rate & reliability scores** — credential-level fill rate trends and per-nurse cancel/late-cancel rates
- **CSV export** — agency shifts by month with hours, pay, and tier data
- **Mass text** — agency admins bulk-SMS nurses by credential type

## Project Structure

```
src/
  app/
    (auth)/           — login, signup, password reset
    (admin)/          — super admin dashboard, seed tool
    (agency)/         — agency admin: staff, shifts, facilities, settings
    (facility)/       — facility admin: shifts, claims, staff, settings
    (nurse)/          — nurse: available shifts, schedule, settings
    (demo)/           — demo role wrappers (re-exports real pages)
    api/              — all API routes
  components/
    calendar/         — shift calendar, day panel, agency calendar
    shifts/           — ShiftCard, NurseShiftList, ShiftClaimQueue
    notifications/    — NotificationBell, NotificationPreferencesForm
    layout/           — SidebarNav, DemoSidebarNav
    agency/           — AgencyProfileForm, ClaimApprovalToggle, MassTextModal
    facility/         — RepeatNurseTable, ShiftOutreachModal, FacilityNotesForm
    placeholders/     — PlaceholderFacilityForm, AddressMatchAlert, ConnectionRequestModal
    staff/            — StaffRosterTable, NursysLookupForm
    ui/               — AddressAutocompleteInput
  hooks/
    useRealtimeShifts.ts
    useDoubleBookingCheck.ts
    useNotifications.ts
    useDriveTime.ts
  lib/
    supabase/         — client.ts, server.ts, admin.ts, types.ts
    twilio/           — sendSms()
    resend/           — sendEmail()
    notifications/    — dispatchNotifications() with preference filtering
    google-maps/      — getDriveTimes()
    demo/             — isDemoUser() helper
    utils/            — pay.ts, address.ts
  middleware.ts       — role-based routing from JWT app_metadata
```

## Auth Notes

- Role is stored in `auth.users.raw_app_meta_data` as `{ "role": "agency_admin" }` — no DB query in middleware
- After setting a role via SQL, users must log out and back in for the JWT to update
- After `signInWithPassword`, use `window.location.href = '/'` (hard redirect) — do NOT use `router.push()` as it causes SSR cookie conflicts

To set a role manually:

```sql
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "super_admin"}'::jsonb
WHERE email = 'user@example.com';
```
