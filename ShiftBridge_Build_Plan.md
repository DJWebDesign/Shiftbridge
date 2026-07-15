# ShiftBridge — Comprehensive Technical Build Plan

> **Version:** 1.1 | **Date:** 2026-03-31
> **Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · Supabase

---

## Context

ShiftBridge is a closed-roster per diem nursing shift staffing platform. Facilities post shifts; staffing agencies see those shifts and their nurses claim them. The platform replaces spreadsheets and phone/text chains with real-time, role-gated dashboards. The four user roles — Super Admin, Agency Admin, Facility Admin, Nurse — each have a fully distinct workflow. This plan covers everything needed to build and test the platform before a single line of code is written.

**To convert to PDF:** `pandoc ShiftBridge_Build_Plan.md -o ShiftBridge_Build_Plan.pdf`
**To convert to DOCX:** `pandoc ShiftBridge_Build_Plan.md -o ShiftBridge_Build_Plan.docx`

---

## Part 1 — Database Schema

### 1.1 Core Auth / Users

**`profiles`** — extends `auth.users` with role and status
```
id            UUID        PK, FK → auth.users(id) ON DELETE CASCADE
role          TEXT        NOT NULL, CHECK IN ('super_admin','agency_admin','facility_admin','nurse')
full_name     TEXT        NOT NULL
email         TEXT        NOT NULL UNIQUE
phone         TEXT
avatar_url    TEXT
is_active     BOOLEAN     NOT NULL DEFAULT true
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
```
Indexes: `idx_profiles_role(role)`, `idx_profiles_email(email)`

---

### 1.2 Agency / Facility Management

**`agencies`**
```
id            UUID        PK DEFAULT gen_random_uuid()
name          TEXT        NOT NULL
address       TEXT
city          TEXT
state         TEXT
zip           TEXT
phone         TEXT
status        TEXT        NOT NULL DEFAULT 'active', CHECK IN ('active','suspended','deactivated')
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
```

**`agency_admins`** — links profiles (role=agency_admin) to their agency
```
id            UUID        PK DEFAULT gen_random_uuid()
profile_id    UUID        NOT NULL UNIQUE, FK → profiles(id) ON DELETE CASCADE
agency_id     UUID        NOT NULL, FK → agencies(id) ON DELETE CASCADE
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
```
Index: `idx_agency_admins_agency_id(agency_id)`

**`facilities`**
```
id                  UUID        PK DEFAULT gen_random_uuid()
name                TEXT        NOT NULL
facility_type       TEXT        NOT NULL, CHECK IN ('long_term_care','assisted_living','hospital','rehabilitation','memory_care')
address_line1       TEXT        NOT NULL
address_line2       TEXT
city                TEXT        NOT NULL
state               TEXT        NOT NULL
zip                 TEXT        NOT NULL
address_normalized  TEXT        NOT NULL  -- lowercase, stripped for matching
lat                 NUMERIC(10,7)
lng                 NUMERIC(10,7)
status              TEXT        NOT NULL DEFAULT 'active', CHECK IN ('active','suspended','deactivated')
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
```
Indexes: `idx_facilities_address_norm(address_normalized)`, `idx_facilities_status(status)`

**`facility_admins`** — links profiles (role=facility_admin) to their facility
```
id            UUID        PK DEFAULT gen_random_uuid()
profile_id    UUID        NOT NULL UNIQUE, FK → profiles(id) ON DELETE CASCADE
facility_id   UUID        NOT NULL, FK → facilities(id) ON DELETE CASCADE
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
```
Index: `idx_facility_admins_facility_id(facility_id)`

**`agency_facility_connections`** — live connections between agencies and facilities
```
id                  UUID        PK DEFAULT gen_random_uuid()
agency_id           UUID        NOT NULL, FK → agencies(id) ON DELETE CASCADE
facility_id         UUID        NOT NULL, FK → facilities(id) ON DELETE CASCADE
bill_rate           NUMERIC(8,2)
status              TEXT        NOT NULL DEFAULT 'pending', CHECK IN ('pending','active','inactive')
requested_by        UUID        FK → profiles(id)
requested_at        TIMESTAMPTZ
accepted_at         TIMESTAMPTZ
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE(agency_id, facility_id)
```
Indexes: `idx_afc_agency_id(agency_id)`, `idx_afc_facility_id(facility_id)`

**`facility_shift_configs`** — one-time setup of named shift slots per credential type per facility
```
id               UUID        PK DEFAULT gen_random_uuid()
facility_id      UUID        NOT NULL, FK → facilities(id) ON DELETE CASCADE
credential_type  TEXT        NOT NULL, CHECK IN ('CNA','CMA','LPN','LPN_IV','RN')
shift_name       TEXT        NOT NULL  -- e.g. 'Day', 'Night', '1st', '2nd', '3rd'
start_time       TIME        NOT NULL
end_time         TIME        NOT NULL
created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE(facility_id, credential_type, shift_name)
```
Index: `idx_fsc_facility_id(facility_id)`

**`pay_tier_configs`** — per-agency tier label/bonus configuration
```
id            UUID        PK DEFAULT gen_random_uuid()
agency_id     UUID        NOT NULL, FK → agencies(id) ON DELETE CASCADE
tier_number   SMALLINT    NOT NULL, CHECK IN (1,2,3)
custom_label  TEXT        NOT NULL DEFAULT ''
bonus_amount  NUMERIC(8,2) NOT NULL DEFAULT 0
bonus_type    TEXT        NOT NULL DEFAULT 'per_hour', CHECK IN ('per_hour','flat')
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE(agency_id, tier_number)
```

---

### 1.3 Nurse Profiles

**`nurse_profiles`** — canonical nurse identity keyed by license number
```
id                    UUID        PK DEFAULT gen_random_uuid()
profile_id            UUID        NOT NULL UNIQUE, FK → profiles(id) ON DELETE CASCADE
license_number        TEXT        NOT NULL
license_state         TEXT        NOT NULL
credential_type       TEXT        NOT NULL, CHECK IN ('CNA','CMA','LPN','LPN_IV','RN')
license_status        TEXT        NOT NULL DEFAULT 'active', CHECK IN ('active','expired','suspended','revoked')
license_expiration    DATE
iv_certified          BOOLEAN     NOT NULL DEFAULT false
iv_cert_source        TEXT        CHECK IN ('manual','implicit_rn')  -- 'nursys' removed: IV cert not a NURSYS data field
cpr_expiration        DATE
tb_test_date          DATE
covid_vaccinated      BOOLEAN     NOT NULL DEFAULT false
phone                 TEXT
home_address          TEXT        -- stored, never transmitted to other parties
home_address_lat      NUMERIC(10,7)
home_address_lng      NUMERIC(10,7)
profile_photo_url     TEXT
nursys_last_checked   TIMESTAMPTZ
created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE(license_number, license_state)
```
Indexes: `idx_np_credential_type(credential_type)`, `idx_np_license(license_number, license_state)`

**`agency_nurse_relationships`** — per-agency data isolated from other agencies
```
id              UUID        PK DEFAULT gen_random_uuid()
agency_id       UUID        NOT NULL, FK → agencies(id) ON DELETE CASCADE
nurse_profile_id UUID       NOT NULL, FK → nurse_profiles(id) ON DELETE CASCADE
base_pay_rate   NUMERIC(8,2)
notes           TEXT        -- private to agency
status          TEXT        NOT NULL DEFAULT 'active', CHECK IN ('active','inactive')
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE(agency_id, nurse_profile_id)
```
Indexes: `idx_anr_agency_id(agency_id)`, `idx_anr_nurse_profile_id(nurse_profile_id)`

---

### 1.4 Placeholder Facilities

**`placeholder_facilities`**
```
id                    UUID        PK DEFAULT gen_random_uuid()
agency_id             UUID        NOT NULL, FK → agencies(id) ON DELETE CASCADE
name                  TEXT        NOT NULL
facility_type         TEXT        NOT NULL, CHECK IN ('long_term_care','assisted_living','hospital','rehabilitation','memory_care')
address_line1         TEXT        NOT NULL
address_line2         TEXT
city                  TEXT        NOT NULL
state                 TEXT        NOT NULL
zip                   TEXT        NOT NULL
address_normalized    TEXT        NOT NULL
coordinator_email     TEXT
matched_facility_id   UUID        FK → facilities(id)  -- set when address match detected
connection_status     TEXT        NOT NULL DEFAULT 'unmatched',
                                  CHECK IN ('unmatched','match_detected','request_pending','connected','declined')
created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
```
Index: `idx_pf_agency_id(agency_id)`, `idx_pf_address_norm(address_normalized)`

**`connection_requests`** — formal connection request from agency to facility
```
id                    UUID        PK DEFAULT gen_random_uuid()
agency_id             UUID        NOT NULL, FK → agencies(id)
facility_id           UUID        NOT NULL, FK → facilities(id)
placeholder_id        UUID        NOT NULL, FK → placeholder_facilities(id)
status                TEXT        NOT NULL DEFAULT 'pending', CHECK IN ('pending','accepted','declined')
requested_by          UUID        FK → profiles(id)
responded_by          UUID        FK → profiles(id)
requested_at          TIMESTAMPTZ NOT NULL DEFAULT now()
responded_at          TIMESTAMPTZ
message               TEXT
```

---

### 1.5 Shifts

**`shifts`**
```
id                        UUID        PK DEFAULT gen_random_uuid()
facility_id               UUID        FK → facilities(id)             -- NULL if placeholder shift
placeholder_facility_id   UUID        FK → placeholder_facilities(id) -- NULL if real facility shift
agency_id                 UUID        FK → agencies(id)               -- set for placeholder shifts
credential_required       TEXT        NOT NULL, CHECK IN ('CNA','CMA','LPN','LPN_IV','RN')
shift_date                DATE        NOT NULL
start_time                TIME        NOT NULL
end_time                  TIME        NOT NULL
priority_tier             SMALLINT    NOT NULL DEFAULT 1, CHECK IN (1,2,3)
status                    TEXT        NOT NULL DEFAULT 'open',
                                      CHECK IN ('open','claimed','confirmed','canceled','filled')
is_placeholder            BOOLEAN     NOT NULL DEFAULT false
posted_by                 UUID        NOT NULL, FK → profiles(id)
canceled_by               UUID        FK → profiles(id)
canceled_at               TIMESTAMPTZ
cancel_reason             TEXT
is_late_cancel            BOOLEAN     DEFAULT false
created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()

CONSTRAINT shifts_facility_xor CHECK (
  (facility_id IS NOT NULL AND placeholder_facility_id IS NULL) OR
  (facility_id IS NULL AND placeholder_facility_id IS NOT NULL)
)
```
Indexes: `idx_shifts_facility_id(facility_id)`, `idx_shifts_placeholder_id(placeholder_facility_id)`,
`idx_shifts_date_status(shift_date, status)`, `idx_shifts_credential(credential_required)`, `idx_shifts_agency_id(agency_id)`

**`shift_claims`**
```
id               UUID        PK DEFAULT gen_random_uuid()
shift_id         UUID        NOT NULL, FK → shifts(id) ON DELETE CASCADE
nurse_profile_id UUID        NOT NULL, FK → nurse_profiles(id)
agency_id        UUID        NOT NULL, FK → agencies(id)
status           TEXT        NOT NULL DEFAULT 'pending', CHECK IN ('pending','confirmed','rejected','withdrawn')
claimed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
confirmed_at     TIMESTAMPTZ
confirmed_by     UUID        FK → profiles(id)
created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE(shift_id, nurse_profile_id)
```
Indexes: `idx_sc_shift_id(shift_id)`, `idx_sc_nurse_id(nurse_profile_id)`, `idx_sc_status(status)`

**`dnr_records`**
```
id               UUID        PK DEFAULT gen_random_uuid()
facility_id      UUID        NOT NULL, FK → facilities(id) ON DELETE CASCADE
nurse_profile_id UUID        NOT NULL, FK → nurse_profiles(id) ON DELETE CASCADE
agency_id        UUID        NOT NULL, FK → agencies(id)
created_by       UUID        NOT NULL, FK → profiles(id)
created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE(facility_id, nurse_profile_id)
```
Indexes: `idx_dnr_facility_id(facility_id)`, `idx_dnr_nurse_id(nurse_profile_id)`, `idx_dnr_agency_id(agency_id)`

---

### 1.6 Notifications

**`notifications`**
```
id                UUID        PK DEFAULT gen_random_uuid()
profile_id        UUID        FK → profiles(id)   -- NULL for external email recipients
recipient_email   TEXT                             -- for external (coordinator) emails
recipient_phone   TEXT                             -- for SMS
channel           TEXT        NOT NULL, CHECK IN ('sms','in_app','email')
event_type        TEXT        NOT NULL             -- e.g. 'shift_confirmed', 'credential_expiring'
message           TEXT        NOT NULL
payload           JSONB       DEFAULT '{}'
read_at           TIMESTAMPTZ                      -- NULL = unread (in-app only)
sent_at           TIMESTAMPTZ
status            TEXT        NOT NULL DEFAULT 'pending', CHECK IN ('pending','sent','failed')
created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
```
Indexes: `idx_notifications_profile_id(profile_id)`, `idx_notifications_unread(read_at)` WHERE read_at IS NULL,
`idx_notifications_status(status)`

**`placeholder_confirm_tokens`** — single-use email confirmation links for coordinators
```
id               UUID        PK DEFAULT gen_random_uuid()
shift_id         UUID        NOT NULL, FK → shifts(id) ON DELETE CASCADE
token            TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex')
email            TEXT        NOT NULL
used_at          TIMESTAMPTZ
expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
```

---

### 1.7 Analytics / Demo

**`demo_sessions`**
```
id                UUID        PK DEFAULT gen_random_uuid()
session_token     TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex')
expires_at        TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour')
last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT now()
ip_address        TEXT
user_agent        TEXT
created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
```

**`analytics_events`**
```
id               UUID        PK DEFAULT gen_random_uuid()
demo_session_id  UUID        FK → demo_sessions(id) ON DELETE SET NULL
profile_id       UUID        FK → profiles(id) ON DELETE SET NULL
event_type       TEXT        NOT NULL  -- 'demo_shift_posted', 'demo_claim_made', 'demo_credential_viewed', 'demo_shift_confirmed'
event_data       JSONB       DEFAULT '{}'
created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
```
Indexes: `idx_ae_event_type(event_type)`, `idx_ae_created_at(created_at)`

---

## Part 2 — Supabase RLS Policies

Enable RLS on all tables. Use these helper functions in policies:

```sql
CREATE OR REPLACE FUNCTION get_my_role() RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_my_agency_id() RETURNS UUID AS $$
  SELECT agency_id FROM agency_admins WHERE profile_id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_my_facility_id() RETURNS UUID AS $$
  SELECT facility_id FROM facility_admins WHERE profile_id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_my_nurse_profile_id() RETURNS UUID AS $$
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
```

### profiles
| Policy | Operation | Condition |
|--------|-----------|-----------|
| own_profile_select | SELECT | `id = auth.uid()` |
| super_admin_all | ALL | `get_my_role() = 'super_admin'` |
| agency_admin_select_nurses | SELECT | `role = 'nurse' AND id IN (SELECT np.profile_id FROM nurse_profiles np JOIN agency_nurse_relationships anr ON anr.nurse_profile_id = np.id WHERE anr.agency_id = get_my_agency_id())` |
| facility_admin_select_claimants | SELECT | `role = 'nurse' AND id IN (SELECT np.profile_id FROM nurse_profiles np JOIN shift_claims sc ON sc.nurse_profile_id = np.id JOIN shifts s ON s.id = sc.shift_id WHERE s.facility_id = get_my_facility_id())` |
| own_profile_update | UPDATE | `id = auth.uid()` |

### nurse_profiles
| Policy | Operation | Condition |
|--------|-----------|-----------|
| own_nurse_profile | ALL | `profile_id = auth.uid()` |
| agency_admin_manages | ALL | `id IN (SELECT nurse_profile_id FROM agency_nurse_relationships WHERE agency_id = get_my_agency_id())` |
| facility_sees_claimants | SELECT | `id IN (SELECT nurse_profile_id FROM shift_claims sc JOIN shifts s ON s.id = sc.shift_id WHERE s.facility_id = get_my_facility_id())` |
| super_admin_all | ALL | `get_my_role() = 'super_admin'` |

> **Privacy:** Create a view `nurse_profiles_facility_view` that excludes `home_address`, `home_address_lat`, `home_address_lng`, `nursys_last_checked`. Facility admins query this view, not the base table.

### agency_nurse_relationships
| Policy | Operation | Condition |
|--------|-----------|-----------|
| own_agency_anr | ALL | `agency_id = get_my_agency_id()` |
| nurse_sees_own | SELECT | `nurse_profile_id = get_my_nurse_profile_id()` |
| super_admin_all | ALL | `get_my_role() = 'super_admin'` |

### shifts
| Policy | Operation | Condition |
|--------|-----------|-----------|
| facility_admin_manages | ALL | `facility_id = get_my_facility_id()` |
| agency_sees_connected_shifts | SELECT | `(facility_id IN (SELECT facility_id FROM agency_facility_connections WHERE agency_id = get_my_agency_id() AND status = 'active')) OR (is_placeholder = true AND agency_id = get_my_agency_id())` |
| nurse_sees_open_shifts | SELECT | `status = 'open' AND credential_required = ANY(get_visible_credentials(get_my_nurse_profile_id())) AND (facility_id IS NULL OR facility_id NOT IN (SELECT facility_id FROM dnr_records WHERE nurse_profile_id = get_my_nurse_profile_id()))` |
| nurse_sees_own_confirmed | SELECT | `id IN (SELECT shift_id FROM shift_claims WHERE nurse_profile_id = get_my_nurse_profile_id() AND status = 'confirmed')` |
| super_admin_all | ALL | `get_my_role() = 'super_admin'` |

### shift_claims
| Policy | Operation | Condition |
|--------|-----------|-----------|
| nurse_manages_own | ALL | `nurse_profile_id = get_my_nurse_profile_id()` |
| facility_sees_for_their_shifts | SELECT | `shift_id IN (SELECT id FROM shifts WHERE facility_id = get_my_facility_id())` |
| facility_confirms | UPDATE | `shift_id IN (SELECT id FROM shifts WHERE facility_id = get_my_facility_id())` |
| agency_sees_own | SELECT | `agency_id = get_my_agency_id()` |
| super_admin_all | ALL | `get_my_role() = 'super_admin'` |

### dnr_records
| Policy | Operation | Condition |
|--------|-----------|-----------|
| facility_admin_insert | INSERT | `facility_id = get_my_facility_id()` |
| agency_sees_own_staff | SELECT | `agency_id = get_my_agency_id()` |
| facility_sees_own | SELECT | `facility_id = get_my_facility_id()` |
| super_admin_all | ALL | `get_my_role() = 'super_admin'` |

### notifications
| Policy | Operation | Condition |
|--------|-----------|-----------|
| own_notifications | ALL | `profile_id = auth.uid()` |
| super_admin_all | ALL | `get_my_role() = 'super_admin'` |

### All other tables (placeholder_facilities, connection_requests, pay_tier_configs, facility_shift_configs)
- Agency admins: full CRUD on rows where `agency_id = get_my_agency_id()`
- Facility admins: full CRUD on `facility_shift_configs` where `facility_id = get_my_facility_id()`
- Super admin: full access to all rows
- Nurses and non-owners: no access

---

## Part 3 — Architecture Overview

### 3.1 Auth & Role-Based Routing

Supabase Auth issues JWTs (`sub` = `auth.uid()`). On sign-in, `middleware.ts` reads the user's `role` from `profiles` via `@supabase/ssr` and enforces:

```
/login, /demo           → public (no auth required)
/agency/*               → requires role = agency_admin
/facility/*             → requires role = facility_admin
/nurse/*                → requires role = nurse
/admin/*                → requires role = super_admin
/api/*                  → validated per route handler
```

Role is validated server-side on every request — never trusted from client state. Server Components call `createServerClient()` and re-validate the session before rendering protected data.

### 3.2 Multi-Agency Nurse Data Isolation

- `nurse_profiles` holds shared identity (license, credentials, health certs)
- `agency_nurse_relationships` holds per-agency private data (pay rate, notes) — one row per agency per nurse
- RLS ensures Agency A cannot read Agency B's relationship row for the same nurse
- `base_pay_rate` and `notes` live only in `agency_nurse_relationships`, never in `nurse_profiles`
- Facility admins query `nurse_profiles_facility_view` (address fields stripped)

### 3.3 Real-Time Strategy

Supabase Realtime `postgres_changes` subscriptions, established in client components via custom hooks:

| Dashboard | Subscribes To | Filter |
|-----------|---------------|--------|
| Agency Admin | `shifts` | `facility_id=in.(connected facility IDs)` |
| Agency Admin | `shift_claims` | `agency_id=eq.myAgencyId` |
| Facility Admin | `shifts` | `facility_id=eq.myFacilityId` |
| Facility Admin | `shift_claims` | via shift join |
| Nurse | `shift_claims` | `nurse_profile_id=eq.myNurseId` |
| All | `notifications` | `profile_id=eq.myProfileId` |

On payload receipt: update local React state directly (do not refetch). Always unsubscribe in `useEffect` cleanup.

### 3.4 API Routes Pattern

All external calls (NURSYS, Twilio, Resend, Google Maps) happen in Next.js Route Handlers so keys never reach the client. Service-role Supabase client is only used in API routes (never in Server Components that render to users).

---

## Part 4 — File & Folder Structure

```
c:\ShiftBridge\
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                          # Landing / redirect
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   └── reset-password/page.tsx
│   │   ├── (agency)/
│   │   │   ├── layout.tsx                    # Agency nav + auth guard
│   │   │   └── agency/[agencyId]/
│   │   │       ├── page.tsx                  # Agency dashboard
│   │   │       ├── shifts/page.tsx           # Unified shift calendar
│   │   │       ├── staff/
│   │   │       │   ├── page.tsx              # Staff roster
│   │   │       │   └── [nurseId]/page.tsx    # Staff profile
│   │   │       ├── facilities/
│   │   │       │   ├── page.tsx              # All facilities
│   │   │       │   └── [facilityId]/page.tsx # Placeholder facility detail
│   │   │       └── settings/page.tsx         # Pay tiers + agency settings
│   │   ├── (facility)/
│   │   │   ├── layout.tsx                    # Facility nav + auth guard
│   │   │   └── facility/[facilityId]/
│   │   │       ├── page.tsx                  # Facility dashboard
│   │   │       ├── shifts/page.tsx           # Shift calendar + posting
│   │   │       ├── claims/page.tsx           # Pending confirmation queue
│   │   │       ├── agencies/page.tsx         # Connected agencies + bill rates
│   │   │       ├── staff/page.tsx            # Internal float pool
│   │   │       └── settings/page.tsx         # Shift config setup
│   │   ├── (nurse)/
│   │   │   ├── layout.tsx                    # Nurse nav + auth guard
│   │   │   └── nurse/
│   │   │       ├── page.tsx                  # Available shifts
│   │   │       └── schedule/page.tsx         # Consolidated multi-agency schedule
│   │   ├── (admin)/
│   │   │   ├── layout.tsx                    # Super admin nav + auth guard
│   │   │   └── admin/
│   │   │       ├── page.tsx                  # Platform overview
│   │   │       ├── accounts/page.tsx
│   │   │       ├── connections/page.tsx
│   │   │       ├── placeholders/page.tsx
│   │   │       └── analytics/page.tsx
│   │   ├── demo/
│   │   │   ├── page.tsx                      # Demo landing / role selector
│   │   │   ├── facility/page.tsx
│   │   │   ├── agency/page.tsx
│   │   │   └── nurse/page.tsx
│   │   ├── confirm/[token]/page.tsx          # Coordinator one-click confirm (no login)
│   │   └── api/
│   │       ├── auth/callback/route.ts
│   │       ├── nursys/lookup/route.ts
│   │       ├── shifts/
│   │       │   ├── claim/route.ts
│   │       │   ├── confirm/route.ts
│   │       │   ├── cancel/route.ts
│   │       │   └── export/route.ts           # CSV export
│   │       ├── notifications/send/route.ts
│   │       ├── drive-time/route.ts           # Google Maps proxy (no address exposure)
│   │       ├── placeholders/
│   │       │   ├── match/route.ts
│   │       │   └── connect/route.ts
│   │       ├── confirm-token/route.ts        # Validate + consume coordinator token
│   │       ├── demo/
│   │       │   ├── create/route.ts
│   │       │   └── cleanup/route.ts
│   │       └── webhooks/twilio/route.ts
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Dropdown.tsx
│   │   │   ├── Tabs.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Spinner.tsx
│   │   │   └── Toast.tsx
│   │   ├── calendar/
│   │   │   ├── ShiftCalendar.tsx
│   │   │   ├── ShiftDayPanel.tsx
│   │   │   └── CalendarLegend.tsx
│   │   ├── shifts/
│   │   │   ├── ShiftCard.tsx
│   │   │   ├── ShiftPostForm.tsx
│   │   │   ├── ShiftClaimQueue.tsx
│   │   │   ├── CredentialCard.tsx
│   │   │   ├── TierBadge.tsx
│   │   │   └── ShiftStatusBadge.tsx
│   │   ├── staff/
│   │   │   ├── StaffRosterTable.tsx
│   │   │   ├── StaffProfileForm.tsx
│   │   │   ├── NursysLookupForm.tsx
│   │   │   ├── CredentialAlertsWidget.tsx
│   │   │   └── DNRSummaryTable.tsx
│   │   ├── placeholders/
│   │   │   ├── PlaceholderFacilityForm.tsx
│   │   │   ├── PlaceholderShiftForm.tsx
│   │   │   ├── ConnectionRequestModal.tsx
│   │   │   └── AddressMatchAlert.tsx
│   │   ├── notifications/
│   │   │   ├── NotificationBell.tsx
│   │   │   ├── NotificationList.tsx
│   │   │   └── MassTextModal.tsx
│   │   ├── dashboard/
│   │   │   ├── AgencyDashboard.tsx
│   │   │   ├── FacilityDashboard.tsx
│   │   │   ├── NurseDashboard.tsx
│   │   │   ├── SuperAdminDashboard.tsx
│   │   │   ├── ActivityFeed.tsx
│   │   │   ├── FinancialSnapshot.tsx
│   │   │   └── StatsCard.tsx
│   │   └── onboarding/
│   │       ├── OnboardingFlow.tsx
│   │       └── OnboardingStep.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                     # Browser client
│   │   │   ├── server.ts                     # Server client (SSR)
│   │   │   ├── admin.ts                      # Service-role client (API routes only)
│   │   │   └── types.ts                      # Generated via supabase gen types
│   │   ├── nursys/
│   │   │   ├── client.ts
│   │   │   └── types.ts
│   │   ├── twilio/client.ts
│   │   ├── resend/
│   │   │   ├── client.ts
│   │   │   └── templates/
│   │   │       ├── ShiftConfirmationEmail.tsx
│   │   │       ├── ConnectionRequestEmail.tsx
│   │   │       └── CredentialAlertEmail.tsx
│   │   ├── google-maps/drive-time.ts
│   │   └── utils/
│   │       ├── address.ts                    # Address normalization
│   │       ├── credentials.ts               # Credential visibility logic (JS mirror)
│   │       ├── date.ts
│   │       └── csv.ts
│   ├── hooks/
│   │   ├── useRealtimeShifts.ts
│   │   ├── useNotifications.ts
│   │   ├── useDoubleBookingCheck.ts
│   │   └── useDriveTime.ts
│   ├── types/
│   │   ├── database.ts                       # Generated from Supabase
│   │   ├── roles.ts
│   │   └── shifts.ts
│   └── middleware.ts                         # Auth guard + role-based redirect
├── public/
├── .env.local                                # (gitignored)
├── .env.example
├── jest.config.ts
├── jest.setup.ts
├── tailwind.config.ts
├── tsconfig.json
└── next.config.ts
```

---

## Part 5 — Build Phases

### Phase 1 — Foundation
**Goal:** Working auth, DB, routing, and role-gated shell pages.
**Prerequisites:** Supabase project created, Next.js project scaffolded.

**Tasks:**
- Scaffold Next.js App Router project with TypeScript and Tailwind CSS
- Create Supabase project; run complete DB schema migration (all tables, indexes, RLS, helper functions)
- Generate TypeScript types: `supabase gen types typescript --local > src/lib/supabase/types.ts`
- Implement `lib/supabase/{client,server,admin}.ts`
- Implement `middleware.ts`: read session → extract role → redirect to correct dashboard or `/login`
- Create bare-bones layout for each route group with auth guard
- Login page with Supabase email/password auth
- Forgot-password and reset-password pages
- Super admin can create agency_admin and facility_admin accounts (basic account creation form)
- Design system: color palette in `tailwind.config.ts`, core UI primitives (`Button`, `Input`, `Card`, `Badge`)

**Completion criteria:**
- Login with each of the 4 roles redirects to correct route
- Unauthenticated or wrong-role request redirects to `/login`
- Password reset flow works end-to-end
- Full DB schema migrated with RLS enabled on all tables

**Tests:**
- `middleware.test.ts`: role routing for each of the 4 roles, unauthenticated redirect
- `login/page.test.tsx`: form renders, submit, error on bad credentials
- `address.test.ts`: normalization utility (20+ address variations)

---

### Phase 2 — Nurse Profile Management (NURSYS Integration)
**Goal:** Agency admin can create and manage nurse profiles. RN/LPN via NURSYS lookup; CNA/CMA via manual entry.
**Prerequisites:** Phase 1 complete.

> **⚠ NURSYS Integration Notes (confirmed via NCSBN research):**
> - NURSYS e-Notify is a **monitoring service**, not a stateless lookup API. Before building, confirm with NCSBN whether on-demand lookup for a newly entered license number is supported, or whether the nurse must first be enrolled on your institution's Nurse List.
> - **CNA and CMA are not in NURSYS.** These credentials are regulated by state health departments, not boards of nursing. CNA/CMA profiles require full manual entry.
> - **IV certification is not a NURSYS data field.** Boards of nursing do not track IV therapy certification. This is always a manual toggle.
> - **No sandbox environment exists.** All development testing hits production. Build a comprehensive mock fixture library for all test scenarios.
> - **90-day mandatory password rotation.** Must implement a rotation job with alerting — a lapse silently breaks all API calls.
> - **Data is not real-time.** License status reflects the last board submission to NURSYS, not a live board query.

**Tasks:**
- `POST /api/nursys/lookup`: call NURSYS e-Notify API with `{ licenseNumber, state }`, parse and return profile data (name, license type, status, expiration). **RN and LPN only.**
- `NursysLookupForm`: license + state → auto-fills name/credential/status/expiration for RN/LPN. Shows credential type selector first; if CNA or CMA selected, skips NURSYS and goes directly to manual entry form.
- Manual entry form: all fields for CNA/CMA (name, credential type, license/cert number, status, expiration)
- IV certification: **always manual toggle** for all credential types. RN defaults to `iv_certified = true` with `iv_cert_source = 'implicit_rn'`; all others default to false with manual override.
- Manual fields for all profiles: phone, home address (geocoded to lat/lng server-side), profile photo (Supabase Storage)
- Health credentials form: CPR expiration, TB test date, COVID checkbox
- `agency_nurse_relationships` created with base pay rate on profile save
- Staff roster table: credential type badges, status indicators
- Individual staff profile page (agency admin view): all fields editable; "Re-verify with NURSYS" button for RN/LPN profiles
- NURSYS periodic re-check: Edge Function or scheduled server action checks enrolled RN/LPN nurses monthly; notifies on status change. Never marks a license expired if NURSYS is unreachable.
- 90-day API password rotation job with alerting (Supabase Edge Function + cron)
- Credential expiration query: `nurse_profiles WHERE expiration < now() + 30 days` → create `notifications` rows

**Completion criteria:**
- NURSYS lookup auto-fills profile for a known RN or LPN license number
- CNA/CMA credential type routes directly to manual entry (no NURSYS call attempted)
- IV certification toggle defaults correctly for each credential type; manual override works
- Profile photo uploads and displays
- 30-day expiration alerts written to notifications table

**Tests:**
- `nursys/lookup.test.ts`: mock API fixtures for RN + LPN; test parsing of name, status, expiration
- `NursysLookupForm.test.tsx`: RN/LPN auto-fill behavior; CNA/CMA routes to manual form; error states (not found, revoked, timeout)
- `StaffProfileForm.test.tsx`: required fields validation, photo upload, manual entry for CNA/CMA
- IV cert defaults: unit test asserting correct `iv_certified` default per credential type
- Credential expiration utility: 30-day boundary calculations

---

### Phase 3 — Pay Tier Configuration
**Goal:** Agency admin configures three pay tiers with custom labels and bonus amounts.
**Prerequisites:** Phase 1 complete.

**Tasks:**
- Pay tier settings at `/agency/[agencyId]/settings`
- Three-tier form: label + bonus amount + bonus type (per_hour / flat)
- `calculateEffectivePay(basePay, tier, tierConfigs): number` utility function

**Completion criteria:** Tier config saves; effective pay calculates correctly for all bonus type combinations.

**Tests:**
- `calculateEffectivePay.test.ts`: matrix of base pay × tier × bonus type

---

### Phase 4 — Facility Shift Configuration Setup
**Goal:** Facility admin completes one-time setup of named shift slots.
**Prerequisites:** Phase 1 complete.

**Tasks:**
- Shift config page at `/facility/[facilityId]/settings`
- Per credential type: add named shifts with start/end times
- Saved to `facility_shift_configs`
- Shown as first-login reminder if not yet configured

**Completion criteria:** Facility admin defines 2+ credential types with named shifts; config persists.

**Tests:**
- `ShiftConfigForm.test.tsx`: add/remove/edit slots per credential type

---

### Phase 5 — Facility Shift Posting (Real Facilities)
**Goal:** Facility admin posts shifts via calendar; shifts appear in real-time on agency dashboards.
**Prerequisites:** Phase 4 + at least one agency-facility connection.

**Tasks:**
- `ShiftCalendar`: month view, color-coded (open=blue, claimed=amber, confirmed=green, canceled=gray)
- Click day → `ShiftDayPanel` with buttons per configured credential+shift combo
- Quantity input creates N separate shift records
- Tier selector (default Tier 1)
- `POST /api/shifts` with server-side validation
- Tier editing on open shifts: `PATCH /api/shifts/[id]` (tier only), immediate real-time propagation
- `useRealtimeShifts` hook: subscribe to `shifts` changes for connected facility IDs
- Agency admin unified calendar: all connected facilities' shifts in one view

**Completion criteria:**
- Shift posted by facility appears on agency calendar within 2 seconds
- Tier escalation updates in real-time
- Calendar status colors correct

**Tests:**
- `ShiftCalendar.test.tsx`: day rendering, status color mapping
- `ShiftPostForm.test.tsx`: quantity creates correct record count, validation
- `useRealtimeShifts.test.ts`: mock channel; state updates on payload
- API `POST /api/shifts`: valid and invalid payload responses

---

### Phase 6 — Nurse Shift Discovery & Claiming
**Goal:** Nurses see filtered available shifts and can claim with double-booking prevention.
**Prerequisites:** Phases 2 and 5 complete.

**Tasks:**
- Nurse available shifts list: RLS handles credential + DNR filtering at DB level
- `ShiftCard`: facility name, date, time, tier badge, pay rate (base + tier bonus), drive time (placeholder until Phase 12)
- Agency selector dropdown for multi-agency nurses
- `POST /api/shifts/claim`: service-role double-booking check before inserting claim
- Double-booking check: `SELECT COUNT(*) FROM shift_claims sc JOIN shifts s ON s.id = sc.shift_id WHERE sc.nurse_profile_id = $1 AND sc.status = 'confirmed' AND s.shift_date = $2 AND (s.start_time, s.end_time) OVERLAPS ($3, $4)` — return 409 if > 0
- `useDoubleBookingCheck` hook: client-side pre-check for UX warning before API submission
- Pending claims section

**Completion criteria:**
- All 5 credential visibility rules verified
- DNR'd facility shifts invisible to nurse
- Double-booking detected and rejected across agencies
- Claim creates `shift_claims` row; shift status → 'claimed'

**Tests:**
- `ShiftCard.test.tsx`: renders all fields, claim button
- `useDoubleBookingCheck.test.ts`: time overlap detection across various ranges
- API `claim` route: success, 409 double-booking, already-filled shift
- Credential visibility integration: one test per credential type

---

### Phase 7 — Claim Review & Confirmation by Facility
**Goal:** Facility admin reviews claim queue with credential cards and confirms a nurse.
**Prerequisites:** Phase 6 complete.

**Tasks:**
- `ShiftClaimQueue`: pending claims per shift, sorted by `claimed_at` (chronological)
- `CredentialCard`: photo, name, credential type, license number/status/expiration, CPR, TB, COVID — **no home address, no pay rate**
- `POST /api/shifts/confirm`: set winning claim → 'confirmed', all others → 'rejected', shift → 'confirmed'
- Post-shift DNR: available on confirmed shift detail after `shift_date < today`
- `POST /api/shifts/cancel`: ≥12 hours before start → reopen + clear claims; <12 hours → `is_late_cancel = true`, reopen

**Completion criteria:**
- Confirm sets winning claim + rejects others atomically
- Credential card renders no private fields
- Late-cancel correctly flags `is_late_cancel`

**Tests:**
- `CredentialCard.test.tsx`: assert home_address and base_pay_rate never in rendered output
- `ShiftClaimQueue.test.tsx`: chronological order, credential card expand/collapse
- API `confirm` route: atomicity, idempotency (confirm same claim twice)
- API `cancel` route: late-cancel threshold (exactly 12 hours, 11h59m, 12h01m)

---

### Phase 8 — Notifications (SMS + In-App + Email)
**Goal:** All key events trigger correct notifications.
**Prerequisites:** Phase 7 complete; Twilio and Resend accounts configured.

**Tasks:**
- `lib/twilio/client.ts`, `lib/resend/client.ts`
- `POST /api/notifications/send`: dispatcher called by other API routes after mutations
- In-app: store in `notifications` table (channel='in_app'); mark read on click
- `NotificationBell`: unread badge count; dropdown list; real-time via `useNotifications` hook
- `useNotifications`: Supabase Realtime on `notifications WHERE profile_id = myId`
- Notification event triggers:
  - Nurse claims shift → facility admin (or coordinator email if placeholder)
  - Shift confirmed → winning nurse (SMS + in-app); others → in-app "shift filled"
  - Shift canceled → confirmed nurse (SMS + in-app) + facility admin
  - Credential expiring 30 days → agency admin in-app (daily batch)
  - DNR issued → agency admin in-app
- `POST /api/webhooks/twilio`: delivery receipt handler with Twilio signature verification

**Completion criteria:**
- SMS sent for claim/confirm/cancel events (verified in Twilio test logs)
- In-app badge shows correct unread count; clears on read
- All notification types stored in DB with correct `event_type`

**Tests:**
- Mock Twilio/Resend in all tests
- `NotificationBell.test.tsx`: badge count, dropdown, mark-as-read
- Dispatcher unit tests: one test per event type
- Twilio webhook: valid signature passes, invalid signature returns 403

---

### Phase 9 — Placeholder Facilities & Manual Shift Entry
**Goal:** Agency operates fully without any connected real facilities.
**Prerequisites:** Phase 2 complete.

**Tasks:**
- `PlaceholderFacilityForm`: name, type, address, optional coordinator email
- `PlaceholderShiftForm`: inline on calendar, date pre-filled, minimal fields, "Save and add another" flow
- Placeholder shifts shown on agency unified calendar
- Coordinator email flow:
  - Shift claimed → Resend email with shift details + token link
  - Generate token in `placeholder_confirm_tokens`
  - `/confirm/[token]`: validate token → mark used → confirm shift → notify nurse + agency admin → show ShiftBridge signup CTA
- Placeholder shifts included in CSV export (labeled as placeholder)

**Completion criteria:**
- 5 shifts entered in <3 clicks each via "Save and add another"
- Email with valid one-use link sent; link confirms; second click shows "already confirmed"

**Tests:**
- `PlaceholderShiftForm.test.tsx`: "Save and add another" resets form, pre-fills date
- Token: uniqueness, 7-day expiry boundary
- `/confirm/[token]` route: valid, expired, already-used token cases
- CSV export: placeholder shifts present with correct label

---

### Phase 10 — Address Matching & Connection Request Flow
**Goal:** Address-matched facilities trigger connection workflow with atomic placeholder shift deletion.
**Prerequisites:** Phase 9 complete.

**Tasks:**
- `lib/utils/address.ts`: normalize (lowercase, strip punctuation, expand abbreviations: St→street, Ave→avenue, Blvd→boulevard, strip Apt/Suite/Unit)
- Supabase DB trigger on `facilities INSERT`: scan `placeholder_facilities.address_normalized` + `facility_type` for match → set `connection_status = 'match_detected'`, `matched_facility_id`, notify agency admin
- `AddressMatchAlert` component on agency facilities page
- Connection request: `POST /api/placeholders/connect` → creates `connection_requests`, emails + in-app notifies facility admin
- Facility dashboard shows pending request with agency details
- Accept: PL/pgSQL transaction via `supabase.rpc('accept_connection', ...)`:
  1. Update `connection_requests.status = 'accepted'`
  2. Update `placeholder_facilities.connection_status = 'connected'`
  3. Insert `agency_facility_connections`
  4. `DELETE FROM shifts WHERE placeholder_facility_id = $1`
  5. Notify agency admin
- Warning modal pre-accept: "Will permanently delete X shifts. Cannot be undone."
- Decline: `connection_status = 'declined'`; placeholder continues; can resend

**Completion criteria:**
- Normalization matches: "123 Main St", "123 Main Street", "123 MAIN ST." all resolve to same string
- Accept is fully atomic (PL/pgSQL transaction)
- All placeholder shifts deleted after accept
- Decline leaves placeholder untouched

**Tests:**
- `address.test.ts`: 20+ variation matrix
- Atomicity: mock DB failure mid-transaction → verify no partial state
- Warning modal: displays correct shift count before delete
- Decline flow: placeholder shift still queryable, resend creates new connection request row

---

### Phase 11 — DNR System
**Goal:** Facility admins DNR nurses; affected shifts instantly hidden.
**Prerequisites:** Phase 7 complete.

**Tasks:**
- DNR action on confirmed shift detail row, available only when `shift_date < today`
- `POST /api/shifts/[id]/dnr`: validate, create `dnr_records`, notify agency admin in-app
- Agency admin DNR summary widget: all DNR records for their roster (nurse name, facility, date)
- Shift visibility exclusion already handled by RLS (verified in Phase 6 integration tests)

**Completion criteria:**
- DNR record created; nurse cannot see that facility's shifts immediately
- Agency admin sees DNR summary; nurse receives no notification

**Tests:**
- API route: only callable on past shifts by facility admin; returns 403 otherwise
- `DNRSummaryTable.test.tsx`: renders all records
- Integration: nurse shift query before DNR vs after DNR

---

### Phase 12 — Drive Time Integration
**Goal:** Nurses see estimated drive time on shift cards.
**Prerequisites:** Phase 6 complete; `GOOGLE_MAPS_API_KEY` configured.

**Tasks:**
- `lib/google-maps/drive-time.ts`: Distance Matrix API wrapper (up to 25 destinations per call)
- `POST /api/drive-time`: server-side only — fetch nurse `home_address_lat/lng` via service-role client → call Google Maps → return `{ minutes }`; home coordinates never leave server
- `useDriveTime(shiftId)` hook: calls `/api/drive-time`, caches per shiftId in session
- `ShiftCard` renders "~X min away" or nothing if no home address
- Batch: group shift list by unique facility before calling API

**Completion criteria:**
- Drive time appears on shift cards
- Home address coordinates absent from all client-side network requests
- Single Distance Matrix call for multiple shifts at same facility (verified in network tab)

**Tests:**
- `drive-time.ts`: batching logic with mocked Google Maps
- API route: verify service-role fetch; coordinates not in response body
- `ShiftCard.test.tsx`: renders drive time; renders nothing when null

---

### Phase 13 — Full Dashboards, CSV Export & Mass Text
**Goal:** Complete dashboards for all four roles.
**Prerequisites:** Phases 1–12 complete.

**Agency Admin Dashboard:**
- Shift tabs: Confirmed / Pending / Canceled (with late-cancel flag)
- Facility view: hours worked, cancellation rate, unconfirmed claims with manual status (Filled in house / Other agency / Unresponsive)
- Staff view: shifts worked/canceled, hours, DNR flags
- Financial snapshot: sum of (hours × base_pay_rate) per confirmed shift this month
- Credential alerts widget: staff expiring in 30 days (license, CPR, TB)
- Open shifts needing attention: unfilled placeholder shifts sorted by tier + duration open
- Recent activity feed (Realtime on `analytics_events`)
- `MassTextModal`: select credential type → compose → `POST /api/notifications/mass-text` → Twilio call per matching nurse
- CSV export: `GET /api/shifts/export?agencyId=x&month=yyyy-mm`

**Facility Admin Dashboard:**
- Calendar with all shift tabs
- Pending confirmation queue (from Phase 7)
- Agency overview: confirmed shifts per agency, bill rate input, estimated monthly cost
- Internal staff view (float pool — show scheduled, hours this month)

**Nurse Dashboard:**
- Available shifts with agency selector
- My Schedule: multi-agency consolidated calendar, color-coded by agency, PDF download
- Pending claims section

**Super Admin Dashboard:**
- Platform stats cards
- Agency-facility connection matrix (searchable)
- Placeholder facility management
- Account CRUD (create/edit/suspend/deactivate, password reset)

**Completion criteria:**
- CSV opens correctly in Excel with all expected columns
- Mass text sends to all nurses of selected credential type (verified in Twilio logs)
- All aggregations verified against raw DB data

**Tests:**
- `csv.test.ts`: output format for various shift data shapes
- `MassTextModal.test.tsx`: credential filter, confirmation step required before send
- `FinancialSnapshot.test.tsx`: hours × pay rate calculation accuracy
- `ActivityFeed.test.tsx`: renders Realtime events

---

### Phase 14 — Demo System, Analytics & Onboarding
**Goal:** Interactive demo, platform analytics, guided onboarding.
**Prerequisites:** All prior phases complete.

**Demo System:**
- `POST /api/demo/create`: seed 1 facility + 1 agency with pay tiers + 3 nurses (CNA, LPN, RN) tagged with `demo_session_id`; return `session_token` in cookie
- Demo pages scope all queries to `demo_session_id` data
- Role switcher (facility / agency / nurse view)
- 60-minute inactivity timeout: middleware checks `last_activity_at`; calls `/api/demo/cleanup` on expiry
- `POST /api/demo/cleanup`: delete all rows tagged with session_id
- Track analytics events: `shift_posted`, `shift_claimed`, `credential_viewed`, `shift_confirmed`
- Demo middleware: block mutations to non-demo tables

**Analytics (Super Admin):**
- Demo funnel: sessions → shift posted → claimed → credential viewed → confirmed (drop-off at each step)
- Placeholder email: sent / opened / clicked / post-click signups
- Platform: active agencies + facilities, confirmed shifts by week/month, new signups, cancellation rates

**Onboarding:**
- `OnboardingFlow` shown on first login (`onboarding_completed = false`)
- Agency admin: (1) pay tiers → (2) NURSYS lookup → (3) placeholder facility
- Facility admin: (1) shift config → (2) post first shift
- Nurse: (1) browse shifts → (2) read shift card → (3) claim
- Progress in localStorage; skippable; resumable
- Contextual tooltips: tier explanation, credential visibility, DNR effects, placeholder facilities, shift statuses

**Completion criteria:**
- Full demo workflow runs end-to-end with no persistent data after cleanup
- Session expires after exactly 60 minutes of inactivity
- Onboarding shown to new accounts; skip and resume both work
- Analytics funnel counts accurate

**Tests:**
- `demo/create.test.ts`: seeded data structure, session token format
- `demo/cleanup.test.ts`: all tagged records deleted; real data untouched
- Demo middleware: mutation to non-demo table returns 403
- `OnboardingFlow.test.tsx`: step progression, skip, resume from localStorage
- Analytics: funnel event counts match expected sequence

---

## Part 6 — Testing Strategy

### Global Setup

```typescript
// jest.config.ts
{
  testEnvironment: 'jsdom',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  setupFilesAfterEach: ['./jest.setup.ts']
}

// jest.setup.ts
import '@testing-library/jest-dom'
```

### Mock Strategy

| Service | Approach |
|---------|----------|
| Supabase browser client | `jest.mock('@/lib/supabase/client')` |
| Supabase server client | Mock `createServerClient` factory |
| Twilio | `jest.mock('@/lib/twilio/client')` — `jest.fn()` on `send` |
| Resend | `jest.mock('@/lib/resend/client')` — `jest.fn()` on `send` |
| Google Maps | `jest.mock('@/lib/google-maps/drive-time')` — return `{ minutes: 23 }` |
| NURSYS | Mock `fetch` with `nock` or `jest.spyOn(global, 'fetch')` |
| Next.js router | `jest.mock('next/navigation')` |

### Test Categories
- **Unit:** `address.ts`, `credentials.ts`, `csv.ts`, `calculateEffectivePay` — no mocks needed (pure functions)
- **Component (RTL):** all UI components — render, interaction, error states
- **API routes:** `next-test-api-route-handler` or direct function call with mock Request
- **Hook:** `renderHook` + mock Supabase Realtime channel
- **RLS integration:** `supabase start` local dev → seed fixtures → verify policy behavior with different JWTs

### Critical RLS Tests
For each table, verify with test fixtures:
1. Agency A cannot read Agency B's `agency_nurse_relationships` for the same nurse
2. Facility admin querying `nurse_profiles` never receives `home_address` fields
3. Nurse cannot access `base_pay_rate` of any nurse profile
4. DNR'd facility shifts return empty set (not 403) for the nurse

---

## Part 7 — Third-Party Integration Details

### Supabase
- **Introduced:** Phase 1
- **Env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Key usage:** auth, PostgreSQL, Realtime, Storage (profile photos)
- **Error handling:** Check `{ data, error }` on every call; surface via toast

### Twilio (SMS)
- **Introduced:** Phase 8
- **Env vars:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- **Key calls:** `client.messages.create({ to, from, body })`; `validateRequest()` on webhook
- **Error handling:** Log failures to `notifications` table with `status='failed'`

### Resend (Email)
- **Introduced:** Phase 8
- **Env vars:** `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`
- **Key calls:** `resend.emails.send({ from, to, subject, react: <Template /> })`
- **Error handling:** Retry coordinator confirm emails with exponential backoff (critical path)

### Google Maps Distance Matrix
- **Introduced:** Phase 12
- **Env vars:** `GOOGLE_MAPS_API_KEY` — **server-side only, never `NEXT_PUBLIC_`**
- **Key call:** `distancematrix/json?origins={lat,lng}&destinations={addr1}|{addr2}&mode=driving`
- **Error handling:** Return `null` on failure; UI shows nothing
- **Cost control:** Cache `(nurse_id, facility_id)` results for 24 hours

### NURSYS (NCSBN e-Notify)
- **Introduced:** Phase 2
- **Env vars:** `NURSYS_API_USERNAME`, `NURSYS_API_PASSWORD`, `NURSYS_API_BASE_URL`
- **Auth:** Username + password per request (not API key). Password must be rotated every 90 days — implement a rotation Edge Function with alerting.
- **Credential coverage:** RN and LPN/PN only. **CNA and CMA are not in NURSYS** — those profiles use manual entry exclusively.
- **Integration model:** e-Notify is a monitoring service. Confirm with NCSBN before building whether on-demand lookup for a new license number is supported, or whether the nurse must be enrolled on the institution's Nurse List first.
- **Key calls:** License enrollment/lookup; pull status and expiration; periodic re-check for enrolled nurses.
- **IV cert:** Not a NURSYS data field. Always manual toggle. RN defaults `iv_certified = true` (`iv_cert_source = 'implicit_rn'`); all others default false (`iv_cert_source = 'manual'`).
- **No sandbox:** Build a comprehensive mock fixture library (at minimum: active RN, active LPN, expired license, suspended license, not-found, API timeout). All real testing hits production.
- **Error handling:** Timeout (>10s) or error → show manual entry form; mark `nursys_last_checked = NULL`. Never mark a license expired based on a failed API call.
- **Data lag:** License status reflects last board submission to NURSYS, not a real-time board query. Communicate this to agency admins.

---

## Part 8 — Known Complexity Areas

### 1. Multi-Agency Nurse Profile
One nurse, multiple agencies, fully isolated per-agency data.

**Implementation:** `nurse_profiles` holds shared credential identity. `agency_nurse_relationships` holds isolated per-agency data (`base_pay_rate`, `notes`). RLS on `agency_nurse_relationships` filters by `agency_id`. When any API route JOINs these tables for facility-facing queries, explicitly select only `nurse_profiles` columns — never join `base_pay_rate` into facility-accessible queries.

### 2. Address Matching
"123 Main St", "123 Main Street", "123 MAIN ST." must match.

**Implementation:** `lib/utils/address.ts` normalizes: (1) lowercase, (2) expand abbreviations (St→street, Ave→avenue, Blvd→boulevard, Dr→drive, Rd→road, Ln→lane), (3) strip Apt/Suite/Unit and everything after, (4) remove punctuation, (5) collapse whitespace. Store normalized value alongside raw address. Match on `address_normalized = $1 AND facility_type = $2`. Add Levenshtein distance ≤ 2 check for typo resilience (implement as simple JS utility, no external library).

### 3. Connection Accept Atomicity
Delete placeholder shifts + create connection + update statuses must be all-or-nothing.

**Implementation:** PL/pgSQL function `accept_connection(connection_id UUID, placeholder_id UUID)` wrapped in `BEGIN...COMMIT`. Count shifts before deletion so the warning modal is accurate. Call via `supabase.rpc('accept_connection', ...)` from the API route. On any error, Postgres rolls back the transaction; no partial state is possible.

### 4. Credential Visibility Filtering
Complex multi-tier visibility rules must be fast at scale.

**Implementation:** `get_visible_credentials(nurse_profile_id)` returns a `TEXT[]`. RLS on `shifts` uses `credential_required = ANY(get_visible_credentials(...))`. DNR exclusion uses a subquery on `dnr_records`. Add composite index: `shifts(credential_required, status)` and `dnr_records(nurse_profile_id, facility_id)`. Validate shift query < 100ms at 10,000 shifts in load testing.

### 5. Real-Time Calendar Updates
Tier changes, new claims, cancellations must appear live on all affected dashboards.

**Implementation:** `useRealtimeShifts` subscribes to `postgres_changes` on `shifts` filtered by `facility_id`. On payload: mutate local React state directly (do not refetch the list). For tier changes specifically, update the matching shift object in state. Unsubscribe in `useEffect` cleanup return function to prevent duplicate subscriptions.

### 6. DNR Filtering in Shift Queries
Must exclude DNR'd facilities per-nurse efficiently.

**Implementation:** Handled entirely by RLS (DB-level subquery). Application code makes no special effort — it just queries `shifts` and RLS filters. Index on `dnr_records(nurse_profile_id)` ensures the subquery is fast. Never implement DNR filtering in application code; trust the DB.

### 7. Double-Booking Prevention
A nurse's confirmed shifts span multiple agencies — each claim must check all.

**Implementation:** `POST /api/shifts/claim` uses the service-role Supabase client (bypasses RLS intentionally) to run the OVERLAPS query across all agencies. Returns 409 with clear error message if conflict found. Also implement as a `BEFORE INSERT` trigger on `shift_claims` for defense in depth — trigger uses the same OVERLAPS query and raises an exception if conflict found.

### 8. NURSYS API Dependency & Fallback
NURSYS unavailability must not block nurse onboarding. CNA/CMA never use NURSYS. IV cert is always manual.

**Implementation:**
- **CNA/CMA:** Skip NURSYS entirely. Route directly to manual entry form when these credential types are selected. No NURSYS call is ever attempted.
- **RN/LPN:** 10-second timeout on NURSYS API calls. On timeout or error: show "NURSYS unavailable — enter manually" UI with all the same fields. Mark `nursys_last_checked = NULL`. Show "Re-verify with NURSYS" button on profile page.
- **IV certification:** Always a manual toggle regardless of credential type. RN defaults to `iv_certified = true` with `iv_cert_source = 'implicit_rn'`; all others default to false. No credential type sources IV cert from NURSYS — the field does not exist in their data model.
- **90-day password rotation:** Implement a Supabase Edge Function on a cron schedule that rotates the NURSYS API password before expiry and alerts via email if rotation fails. A lapsed password silently breaks all NURSYS calls.
- **Periodic re-checks:** Run only against enrolled RN/LPN profiles. Skip silently if NURSYS is unreachable; never downgrade a license status based on a failed API call.
- **No sandbox:** All NURSYS testing requires real production credentials and real license numbers. Maintain a mock fixture library in the codebase for automated tests covering: active RN, active LPN, expired license, suspended license, not-found response, API timeout.

### 9. Home Address Privacy
Coordinates needed for drive time; must never reach the client or other parties.

**Implementation:** `home_address_lat/lng` stored in `nurse_profiles`. The `nurse_profiles_facility_view` explicitly excludes these columns (facility admins use this view). The drive-time API route fetches coordinates server-side using the service-role client, calls Google Maps server-side, and returns only `{ minutes }`. The nurse's own profile page can show/edit their address (they own it), but coordinates are never serialized to client state.

### 10. Placeholder Coordinator Email Confirmation (No-Login Flow)
External, unregistered coordinators confirm shifts with one click.

**Implementation:** 32-byte random hex token in `placeholder_confirm_tokens` with 7-day expiry. `/confirm/[token]` is a public page (no auth). It calls the API route which: validates token (exists + not expired + `used_at IS NULL`), marks `used_at = now()` atomically before any other action (prevent replay), confirms the shift, sends notifications. Show "Already confirmed — thanks!" on second visit (token used but shift confirmed). Show ShiftBridge signup CTA and track click in `analytics_events`.

---

## Environment Variables Reference

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# Resend
RESEND_API_KEY=
RESEND_FROM_ADDRESS=

# Google Maps (server-only — NEVER use NEXT_PUBLIC_ prefix)
GOOGLE_MAPS_API_KEY=

# NURSYS (e-Notify — username/password auth, NOT an API key)
NURSYS_API_USERNAME=
NURSYS_API_PASSWORD=        # rotate every 90 days via automated job
NURSYS_API_BASE_URL=

# App
NEXT_PUBLIC_APP_URL=
```

---

## Phase Dependency Graph

```
Phase 1 — Foundation
  ├──► Phase 2 — Nurse Profiles (NURSYS)
  │      ├──► Phase 3 — Pay Tier Configuration    ─┐
  │      └──► Phase 9 — Placeholder Facilities     │  (can build in parallel
  │                └──► Phase 10 — Address Match    │   after Phase 1)
  ├──► Phase 4 — Facility Shift Config Setup      ─┘
  │      └──► Phase 5 — Shift Posting
  │                └──► Phase 6 — Nurse Claiming
  │                          └──► Phase 7 — Claim Review & Confirmation
  │                                    ├──► Phase 8 — Notifications
  │                                    ├──► Phase 11 — DNR System     ─┐
  │                                    ├──► Phase 12 — Drive Time      │  (can build
  │                                    └──► Phase 13 — Full Dashboards  │   in parallel)
  │                                                └──► Phase 14 — Demo & Analytics
```

**Parallel opportunities:**
- Phases 3, 4, and 9 can all start immediately after Phase 1
- Phases 10, 11, and 12 can all start after Phase 7 completes
- Phase 14 requires all prior phases

---

*End of ShiftBridge Technical Build Plan v1.0*
