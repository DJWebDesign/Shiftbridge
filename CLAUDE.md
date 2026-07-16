# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build (type-checks + compiles)
npm run lint     # ESLint
npm run start    # Serve production build
npx tsc --noEmit # Type-check without building
```

No test suite exists. Verify changes by running the dev server and exercising the affected flow manually.

DB migrations run manually: paste SQL into **Supabase Dashboard → SQL Editor** (no Supabase CLI — Docker unavailable on this machine).

---

# ShiftBridge — Claude Session Context

## Project Overview
Per diem nursing shift staffing platform. Facilities post shifts; staffing agencies assign nurses to claim them. Four roles: `super_admin`, `agency_admin`, `facility_admin`, `nurse`.

**Full build plan:** `c:\ShiftBridge\ShiftBridge_Build_Plan.md`

---

## Environment

| Item | Value |
|------|-------|
| Stack | Next.js 16 (App Router), TypeScript, Tailwind CSS, Supabase |
| Working directory | `c:\ShiftBridge` |
| Dev server | `npm run dev` → `http://localhost:3000` |
| Supabase project | `leajxmwugnaixmoyfmcx` (hosted, no Docker needed) |
| Platform | Windows 10, bash shell |

**Credentials are in `.env.local` — do not commit.**

---

## Environment Variables / API Keys

All keys go in `c:\ShiftBridge\.env.local`. Keys marked **required** will break core functionality if missing. Everything else degrades gracefully.

### Required (already configured)
| Variable | What it's for | Where to get it |
|----------|--------------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (bypasses RLS, API routes only) | Supabase Dashboard → Settings → API |

### Optional — Notifications (SMS + Email)
| Variable | What it's for | Where to get it | Behavior if absent |
|----------|--------------|-----------------|-------------------|
| `TWILIO_ACCOUNT_SID` | Twilio SMS — account identifier | [twilio.com/console](https://twilio.com/console) | SMS silently skipped |
| `TWILIO_AUTH_TOKEN` | Twilio SMS — auth token | [twilio.com/console](https://twilio.com/console) | SMS silently skipped |
| `TWILIO_FROM_NUMBER` | Twilio SMS — your purchased phone number (E.164 format, e.g. `+15551234567`) | Twilio Console → Phone Numbers | SMS silently skipped |
| `RESEND_API_KEY` | Resend email — API key | [resend.com/api-keys](https://resend.com/api-keys) | Emails silently skipped |
| `RESEND_FROM_ADDRESS` | Resend email — verified sender (e.g. `ShiftBridge <no-reply@yourdomain.com>`) | Must match a verified domain in Resend | Emails silently skipped |

### Optional — Drive Time + Address Autocomplete
| Variable | What it's for | Where to get it | Behavior if absent |
|----------|--------------|-----------------|-------------------|
| `GOOGLE_MAPS_API_KEY` | Distance Matrix API (drive times) + Places API proxy (address autocomplete) | Google Cloud Console → APIs & Services → Credentials — enable **Distance Matrix API**, **Places API (New)**, **Maps JavaScript API** | Drive times null; address autocomplete falls back to plain text input |

**Note:** Uses **Places API (New)** only — legacy Places API is NOT enabled. Autocomplete is proxied server-side through `/api/places/autocomplete` and `/api/places/details` — key never exposed to browser.

### Optional — Site URL
| Variable | What it's for | Behavior if absent |
|----------|--------------|-------------------|
| `NEXT_PUBLIC_SITE_URL` | Base URL used in coordinator confirm email links (e.g. `https://yourdomain.com`) | Falls back to `http://localhost:3000` — fine for dev, broken in production emails |

### Dev/Testing Only — remove before production
| Variable | What it's for | Production behavior |
|----------|--------------|-------------------|
| `RESEND_DEV_OVERRIDE_EMAIL` | Redirects ALL outgoing emails to this address regardless of recipient | Remove entirely — emails go to real recipients |

### Not yet needed (Phases 13–14)
| Variable | What it's for |
|----------|--------------|
| `NURSYS_USERNAME` | NURSYS e-Notify — license monitoring (RN/LPN only) |
| `NURSYS_PASSWORD` | NURSYS e-Notify — rotates every 90 days, needs alerting job |

---

## Current Status

### Phase 1 — COMPLETE
- [x] Next.js scaffolded with TypeScript + Tailwind
- [x] Supabase project connected (`client.ts`, `server.ts`, `admin.ts`)
- [x] Full DB schema migrated (`supabase/migrations/001_initial_schema.sql`)
- [x] TypeScript types generated (`src/lib/supabase/types.ts`)
- [x] `middleware.ts` — role-based routing, reads role from JWT `app_metadata` (no DB query)
- [x] Auth pages: login, forgot-password, reset-password
- [x] Route group layouts with auth guards: `(admin)`, `(agency)`, `(facility)`, `(nurse)`
- [x] Stub dashboard pages for all four roles
- [x] Login flow working end-to-end (hard redirect via `window.location.href = '/'`)

### Phase 2 — COMPLETE
- [x] Agency layout updated with nav links (Dashboard, Staff, Facilities, Settings)
- [x] `/agency/page.tsx` redirects to `/agency/[agencyId]`
- [x] Agency dashboard with staff count + credential alert count
- [x] Staff roster page with credential badges, expiry warnings
- [x] Enroll Staff flow: NURSYS lookup → auto-fill OR manual entry fallback
- [x] `POST /api/nursys/lookup` — proxies NURSYS, returns 503 if unconfigured (manual fallback)
- [x] `POST /api/staff/create` — creates auth user + profiles + nurse_profiles + agency_nurse_relationships; handles existing nurse (second agency) gracefully
- [x] Individual nurse profile page
- [x] `StaffRosterTable` component with expiry warning highlighting

### Phase 3 — COMPLETE
- [x] `src/lib/utils/pay.ts` — `calculateEffectivePay`, `calculateTotalShiftPay`, `tierLabel`, `DEFAULT_TIER_CONFIGS`
- [x] `POST /api/settings/pay-tiers` — upserts all 3 tiers atomically
- [x] `PayTierForm` component — live bonus preview, per_hour / flat toggle
- [x] `/agency/[agencyId]/settings` page

### Phase 4 — COMPLETE
- [x] Facility layout updated with nav links (Dashboard, Shifts, Claims, Settings) + `facilityId` lookup
- [x] `/facility/page.tsx` redirects to `/facility/[facilityId]`
- [x] Facility dashboard with amber "setup needed" reminder if no shift configs
- [x] `ShiftConfigForm` component — per-credential-type shift slots (name, start/end time), add/remove rows
- [x] `/facility/[facilityId]/settings` page
- [x] `POST /api/settings/shift-configs` — delete + insert (replace all) pattern for facility shift configs

### Phase 5 — COMPLETE
- [x] `POST /api/shifts` — creates N shift records (quantity 1–10), validates credential/tier/ownership
- [x] `PATCH /api/shifts/[id]` — updates `priority_tier` only, only on `open` shifts
- [x] `useRealtimeShifts` hook — Supabase postgres_changes on `facility_id=eq.X`; uses `cbRef` to avoid re-subscriptions on re-renders
- [x] `ShiftCalendar` — month grid, colored status dots, today highlight, overflow count, legend
- [x] `ShiftDayPanel` — right-side panel: shifts grouped by credential, inline tier editing (TierSelect), blocked on past dates
- [x] `ShiftPostForm` — credential → slot dropdown → quantity + tier → POST /api/shifts
- [x] `ShiftCalendarView` — client wrapper: month nav, Supabase client fetch on month change, realtime state updates, optimistic post with dedup
- [x] `/facility/[facilityId]/shifts` page — server-rendered auth + config + initial month data

### Phase 6 — COMPLETE
- [x] Nurse layout updated with nav links (Available Shifts, My Schedule)
- [x] `POST /api/shifts/claim` — agency membership check, two-query double-booking check, insert claim, `open`→`claimed` transition, handles re-activating withdrawn claims
- [x] `useDoubleBookingCheck` hook — client-side pre-check; same two-query pattern as server; stable `check()` via `useCallback`
- [x] `ShiftCard` — facility/date/time/credential/tier/pay display, warning→confirm→submit state machine
- [x] `NurseShiftList` — agency selector (multi-agency), pending claims section, available grid, per-shift `ClaimState` (`idle|warning|submitting|claimed|error`)
- [x] `/nurse` page — fetches nurse profile, agency rels + tier configs, open shifts (today+, RLS-filtered), existing claims
- [x] `/nurse/schedule` page — upcoming (pending+confirmed) and past/rejected claims with facility/agency info

### Phase 7 — COMPLETE
- [x] `POST /api/shifts/confirm` — confirm winning claim, reject all other pending claims atomically, shift → 'confirmed'; idempotent on double-confirm
- [x] `POST /api/shifts/cancel` — reopen shift (status → 'open'), withdraw all active claims, set canceled_by/at/reason; `is_late_cancel = true` if <12h before start
- [x] `POST /api/dnr` — insert dnr_records; requires nurse to have a confirmed shift at this facility; 409 on duplicate (unique constraint)
- [x] `CredentialCard` — shows name, avatar, credential, license/status/expiry, IV cert, CPR, TB, COVID; never renders home_address or pay rate; expiry warnings on approaching dates
- [x] `ShiftClaimQueue` — per-shift claim list sorted by claimed_at; expand/collapse CredentialCard per claim; Confirm button; Cancel Shift button; DNR button on past confirmed shifts (with confirmation modal + undo); local state for all transitions; `dnrNurseIds` prop initializes DNR state from server
- [x] `/facility/[facilityId]/claims` — three-query data assembly (shifts → claims → nurse_profiles + profiles); fetches `dnr_records` for facility to pass as `dnrNurseIds`; splits into "Pending Review" and "Recently Confirmed" sections

### Phase 8 — COMPLETE
- [x] `lib/twilio/client.ts` — fetch-based SMS via Twilio REST API; skips gracefully with console.warn if env vars absent (no npm package needed)
- [x] `lib/resend/client.ts` — fetch-based email via Resend REST API; same skip pattern
- [x] `lib/notifications/dispatch.ts` — core dispatcher: always inserts to `notifications` table first, then sends SMS/email conditionally; uses `Promise.allSettled` so one channel failure doesn't block others
- [x] `POST /api/notifications/send` — super_admin-only HTTP wrapper for external/cron triggers
- [x] `POST /api/webhooks/twilio` — delivery receipt handler with HMAC-SHA1 signature verification; updates `notifications.status` via Twilio SID stored in `payload`
- [x] `useNotifications` hook — realtime INSERT subscription on `notifications` for current profile; `markRead` / `markAllRead` optimistically update state then write to Supabase
- [x] `NotificationBell` — bell icon with unread badge (capped at 9+), dropdown with event icons and timeAgo, mark-all-read; closes on outside click
- [x] Agency / Facility / Nurse layouts updated — fetch last 30 in-app notifications server-side; pass as initial state to NotificationBell
- [x] Claim route → notifies facility admin in-app: "X has claimed your Y shift on date"
- [x] Confirm route → notifies winning nurse (SMS + in-app) + all rejected nurses (in-app "shift filled")
- [x] Cancel route → captures confirmed nurse before withdraw; notifies them via SMS + in-app
- [x] DNR route → notifies agency admin in-app: "Nurse X placed on DNR at facility Y"

### Phase 9 — COMPLETE
- [x] `POST /api/placeholders` — create placeholder facility (agency admin); address normalization for future matching
- [x] `GET /api/placeholders` — list agency's placeholder facilities
- [x] `PlaceholderFacilityForm` — name, type, full address, optional coordinator email
- [x] `/agency/[agencyId]/facilities` — lists connected real facilities + placeholder facilities with connection status badges
- [x] `POST /api/shifts/placeholder` — agency admin creates placeholder shifts; validates facility ownership
- [x] `PlaceholderShiftForm` — credential, date, start/end time, tier, qty; "Save + Add Another" resets form while keeping context
- [x] `AgencyShiftCalendarView` + `AgencyShiftDayPanel` — unified agency calendar showing real + placeholder shifts; PH badge on placeholder; inline shift posting from day panel
- [x] `/agency/[agencyId]/shifts` — agency shifts page with calendar + empty state linking to Facilities
- [x] Agency layout: added "Shifts" nav link between Staff and Facilities
- [x] Claim route updated — placeholder shift claimed → creates `placeholder_confirm_tokens` row + sends coordinator email (Resend) with one-click confirm link; also notifies agency admin in-app
- [x] `POST /api/confirm-token` — validates token, marks used, confirms shift + rejects other pending claims, notifies nurse + agency admin in-app; idempotent on double-confirm
- [x] `/confirm/[token]` — public coordinator page (no login required); shows shift details + nurse info (name, license, phone, CPR/TB) + Confirm and Decline buttons; handles already-confirmed, expired, invalid, canceled states; ShiftBridge signup CTA on success

### Phase 10 — COMPLETE
- [x] `lib/utils/address.ts` — shared `normalizeAddress()` utility; expanded abbreviation map (St/Ave/Blvd/Dr/Rd/Ln/Ct/Pl/Hwy/Pkwy + cardinal directions); strips Apt/Suite/Ste/Unit/Floor/#; `/api/placeholders` now uses it instead of inline logic
- [x] `supabase/migrations/002_phase10_address_matching.sql` — `accept_connection(p_request_id, p_responded_by)` PL/pgSQL RPC (atomic: accept request + connect placeholder + insert agency_facility_connection + delete placeholder shifts); `detect_placeholder_match()` trigger fires on `facilities INSERT` → scans matching `address_normalized + facility_type` in `placeholder_facilities` → sets `match_detected` + inserts in-app notification for agency admin
- [x] `POST /api/placeholders/connect` — agency admin sends connection request; validates matched_facility_id exists; creates `connection_requests` row; marks placeholder `request_pending`; notifies facility admin in-app + email
- [x] `POST /api/placeholders/accept` — facility admin accepts; calls `accept_connection` RPC; notifies agency admin in-app with deleted shift count
- [x] `POST /api/placeholders/decline` — facility admin declines; marks `declined`; notifies agency admin in-app; placeholder stays usable (agency can resend)
- [x] `AddressMatchAlert` — shown on each placeholder row when `connection_status = match_detected`; "Send Connection Request" expands inline message box; shows pending/declined states with resend option
- [x] `FacilitiesClient` updated — fetches matched facility names server-side; renders `AddressMatchAlert` per row; optimistically updates `connection_status` on request sent
- [x] `ConnectionRequestModal` — facility-side modal: agency name, placeholder name, shift count warning with required checkbox (if count > 0), Accept & Connect / Decline buttons
- [x] `PendingConnectionRequests` — facility dashboard client component; lists all pending requests with Review button; opens `ConnectionRequestModal`; removes resolved requests from list
- [x] Facility dashboard updated — fetches pending `connection_requests` + shift counts via admin client; passes to `PendingConnectionRequests`
- [x] Agency dashboard updated — Connected Facilities stat card now shows real count from `agency_facility_connections`

### Phase 11 — COMPLETE
- [x] `POST /api/dnr` — insert dnr_records, verify confirmed shift at facility, 409 on duplicate (done Phase 7)
- [x] DNR button in `ShiftClaimQueue` on past confirmed shifts (done Phase 7)
- [x] DNR route notifies agency admin in-app (done Phase 8)
- [x] `DNRSummaryTable` — nurse name, credential, facility, date issued; shown on agency staff page when records exist
- [x] Agency staff page updated — fetches `dnr_records` for agency's roster (by `agency_id` + `nurse_profile_id IN (...)`) via admin client; renders count badge + DNRSummaryTable below roster

### Phase 12 — COMPLETE
- [x] `lib/google-maps/drive-time.ts` — `getDriveTimes(origin, destinations[])` — Distance Matrix API wrapper; skips gracefully if `GOOGLE_MAPS_API_KEY` absent; returns `{ minutes: number | null }[]` in destination order
- [x] `POST /api/drive-time` — nurse-only; fetches nurse `home_address_lat/lng` via service-role (never returned to client); fetches facility lat/lng; calls `getDriveTimes`; returns `{ minutes: Record<facilityId, number|null> }`; max 25 facilities per call
- [x] `useDriveTime(facilityIds[])` hook — collects unique real `facility_id` values from shift list; batches into single API call; caches results in `sessionStorage` so navigation doesn't re-trigger; skips already-cached IDs; handles cancelled effects
- [x] `ShiftCard` updated — accepts `driveMinutes?: number | null`; renders "~X min away" inline below city/state when non-null
- [x] `NurseShiftList` updated — derives `uniqueFacilityIds` via `useMemo`; calls `useDriveTime`; passes `driveMinutes[shift.facility_id]` to each `ShiftCard` (null for placeholder shifts with no facility_id)

Add `GOOGLE_MAPS_API_KEY=AIza...` to `.env.local` to activate drive times. If absent, all drive times are silently null and cards show nothing.

### Phase 13 — COMPLETE
- [x] `POST /api/notifications/mass-text` — agency admin bulk SMS + in-app to nurses by credential type; credential filter (null = all); uses `dispatchNotifications`
- [x] `GET /api/shifts/export` — CSV download for agency shifts by month; columns: date, facility, credential, times, hours, tier, status, nurse name, license #, pay rate, total pay, late-cancel flag; agency_admin or super_admin only
- [x] `MassTextModal` (`src/components/agency/MassTextModal.tsx`) — compose → review confirm → send state machine; credential type selector; 320-char limit; shows targeted count on success
- [x] `AgencyDashboardClient` (`src/app/(agency)/agency/[agencyId]/AgencyDashboardClient.tsx`) — shift tabs (Confirmed/Pending/Canceled) with counts + inline shift rows; financial snapshot (hours + est. pay out); credential alerts widget (expiring in 30 days: license/CPR/TB); open placeholder shifts needing attention (sorted by tier + date); staff activity table (shifts/hours/canceled/DNR) — collapsible; Export CSV + Mass Text buttons
- [x] Agency dashboard page — full server-side data: connected facility shifts for current month, pay rate map for financial calc, placeholder open needs, DNR flags, staff claim summaries; top stat row (staff/facilities/open needs)
- [x] `FacilityDashboardClient` (`src/app/(facility)/facility/[facilityId]/FacilityDashboardClient.tsx`) — agency overview table: confirmed shifts per agency, hours, editable bill rate input, estimated monthly cost
- [x] `POST /api/settings/bill-rate` — facility admin saves `bill_rate` on `agency_facility_connections` row
- [x] Facility dashboard page — pending claims count badge on Claims card; agency overview section
- [x] `AdminDashboardClient` (`src/app/(admin)/admin/AdminDashboardClient.tsx`) — Accounts tab: search/filter by role, suspend/activate (auth ban API), reset password (recovery link email); Connections tab: searchable agency–facility matrix
- [x] `PATCH /api/admin/accounts` — super_admin only; suspend (is_active=false + 100yr auth ban), activate (lifts ban), reset_password (Supabase `generateLink` recovery)
- [x] Super Admin dashboard page — 6 platform stat cards; passes accounts + connections to `AdminDashboardClient`

### Frontend Redesign — COMPLETE
- [x] Design system: DM Serif Display (headings) + DM Sans (body) via `next/font/google`
- [x] CSS design tokens in `globals.css`: `--navy` (#0D1B2A), `--teal` (#0D9488), `--page` (#F4F7FA), `--border`, `--text-1/2/3`
- [x] Credential badge utility classes: `.cred-CNA` (teal), `.cred-CMA` (purple), `.cred-LPN` (blue), `.cred-LPN_IV` (indigo), `.cred-RN` (red)
- [x] Tier border classes: `.tier-standard` (slate), `.tier-priority` (amber), `.tier-urgent` (red)
- [x] `SidebarNav` component — dark navy sidebar (252px), SVG icon library, active link highlighting (teal left-border), user footer with avatar initials, sign-out, `NotificationBell` slot
- [x] All four role layouts rewritten to use `<SidebarNav>` + flex main content area
- [x] `NotificationBell` updated with `variant?: 'light' | 'dark'` prop — dark variant anchors dropdown above button, teal unread dot
- [x] Auth layout: split-screen (dark navy left panel with serif tagline, white right panel with form)
- [x] Auth pages (login, forgot-password, reset-password) redesigned with serif headings + teal focus rings
- [x] Sample HTML files in `samples/` (agency-dashboard, facility-dashboard, nurse-shifts, admin-dashboard)

### Post-Redesign Additions — COMPLETE
- [x] Nurse profile editing: `NurseProfileClient.tsx` — 4 editable sections (License, Contact, Health, Agency Settings); per-section save/cancel; calls `PATCH /api/staff/[nurseId]`
- [x] `PATCH /api/staff/[nurseId]` — agency admin updates nurse info; verifies ownership; updates `nurse_profiles` or `agency_nurse_relationships` depending on `section` field
- [x] Staff roster rows clickable — `StaffRosterTable` uses `router.push()` to navigate to nurse profile on row click
- [x] Connected facility detail page: `/agency/[agencyId]/facilities/[facilityId]/page.tsx` — facility info card + `AgencyShiftCalendarView` filtered to that facility
- [x] Placeholder facility detail page: `/agency/[agencyId]/facilities/placeholder/[placeholderId]/page.tsx` + `PlaceholderFacilityDetailClient.tsx` — editable info card + calendar filtered to that placeholder
- [x] `PATCH /api/placeholders/[placeholderId]` — update placeholder facility info; re-normalizes address
- [x] `AgencyShiftCalendarView` now accepts `filterFacilityId?` and `filterPlaceholderId?` optional props
- [x] Nurse available shifts page (`/nurse`) — all queries switched to admin client; `NurseShiftList` rebuilt with calendar-first UI (month grid with tier dot badges), day-click side panel, dropdown facility filter, list/calendar toggle
- [x] Agency Shifts page (`/agency/[agencyId]/shifts`) — rewritten with admin client; new read-only `AgencyShiftsClient` component (no claim button); dropdown filter with `<optgroup>` separating Connected/Placeholder facilities
- [x] Invite email on nurse creation — `POST /api/staff/create` calls `generateLink({ type: 'invite' })` + `sendEmail()` so new nurses get a "Set my password" link via Resend
- [x] Seed route: `POST /api/seed` (super_admin only) — creates 3 facilities, shift configs, agency-facility connections, 5 test nurses (one per credential), ~30 open shifts, 2 placeholder facilities, ~10 placeholder shifts; idempotent
- [x] Seed UI: `/admin/seed` page — simple "Run Seed" button + JSON result display
- [x] Nurse schedule page redesigned — top section shows next 3 upcoming confirmed shifts as cards; below is an interactive month calendar with green/amber dot indicators per day; clicking a day opens a detail panel to the **right** of the calendar (not below) showing all shifts for that day with status, time, credential, tier, and agency
- [x] Notification bell dropdown fixed — dark variant (sidebar) uses `position: fixed` + `getBoundingClientRect()` to escape sidebar's `overflow: hidden`; anchors bottom edge above button, opens to the right; light variant unchanged (absolute, right-aligned)
- [x] `AddressAutocompleteInput` dropdown switched to `position: fixed` — uses `getBoundingClientRect()` + `useLayoutEffect` to reposition on scroll/resize; escapes any `overflow` ancestor clipping
- [x] Auth layout right panel made scrollable — `overflow-y-auto` with `my-auto` inner wrapper; short forms (login) stay centered, long forms (facility signup) scroll correctly

### Self-Signup Flow — COMPLETE
- [x] `POST /api/auth/signup` — public endpoint; creates auth user with role in `app_metadata` via admin client; inserts `profiles` + entity record (`agencies` or `facilities`) + admin join record (`agency_admins` or `facility_admins`); cleans up auth user on any failure
- [x] `/signup` page — step 1: choose Agency or Facility (two cards); step 2: full form; facility form includes type dropdown, agency form does not; auto-signs in after account creation and redirects to dashboard
- [x] Login page — "Sign up" link added at bottom
- [x] `/signup`, `/api/auth`, `/api/places`, `/api/confirm-token` added to `PUBLIC_ROUTES` in middleware — unauthenticated users on signup must be able to hit these routes; forgetting this blocks autocomplete and hangs form submission
- [x] `/decline`, `/api/decline-token` also in `PUBLIC_ROUTES` — coordinator decline flow requires no login
- [x] Nurses are NOT self-signup — agency admins add them only

### Address Autocomplete — COMPLETE
- [x] `GET /api/places/autocomplete` — proxies input to Google Places API (New) server-side; returns `{ suggestions: [{ placeId, mainText, secondaryText, fullText }] }`
- [x] `GET /api/places/details` — fetches address components for a placeId; returns `{ addressLine1, city, state, zip, lat, lng }`
- [x] `AddressAutocompleteInput` component (`src/components/ui/AddressAutocompleteInput.tsx`) — custom dropdown, 300ms debounce, keyboard navigation (arrows/enter/escape), outside-click close, auto-fills city/state/zip on selection, `position: fixed` dropdown avoids overflow clipping, plain text fallback if key absent
- [x] Wired up on: signup form, `PlaceholderFacilityForm`, Enroll Staff form (`NursysLookupForm`), nurse profile contact section (`NurseProfileClient`)
- [x] API key server-side only — no `NEXT_PUBLIC_` exposure

### Calendar UI Redesign — COMPLETE
- [x] `ShiftCalendar.tsx` — facility calendar restyled: navy header matching sidebar, day-of-week labels in navy band at `#7B93AB`, tile grid (white cards floating on `#F4F7FA` with 5px gaps for visible day separation), today/selected shown with 2.5px teal inset outline only (no fill), past days at 0.52 opacity, status dots replaced with pill badges (`3 open`, `1 confirmed`, etc.) per day
- [x] `NurseShiftList.tsx` — nurse available shifts calendar restyled to match; keeps tier-colored count circle (standard/priority/urgent) since all shifts are open status
- [x] `NurseScheduleClient.tsx` — nurse schedule calendar restyled to match; dots replaced with confirmed/pending pill badges per day
- [x] `AgencyShiftsClient.tsx` — agency shifts calendar restyled to match; keeps tier-colored count circle
- [x] Sample files in `samples/` — `calendar-option-a.html` through `calendar-option-d.html` document the design exploration; Option D is what was implemented

**Design decisions:**
- Today and selected day both use the same 2.5px teal inset `box-shadow` — no filled background on either state
- Day separation comes from the tile gap (page background showing through) rather than cell borders
- Navy header (`#0D1B2A`) matches `SidebarNav` — day labels sit inside the navy band at `#7B93AB` (same color as sidebar nav items)
- Hover: `#EBF5F4` tint + 1px lift + soft teal shadow
- Facility/agency calendars use tier-dot count circles; schedule/availability calendars that show status use text pills

### Landing Page — COMPLETE (not yet connected)
- [x] `public/landing.html` — standalone HTML marketing page; self-contained CSS + vanilla JS; no framework dependencies
- [x] `public/screenshots/` — logo copied here so it's served by Next.js at `/screenshots/logo (2).png`
- [ ] **NOT CONNECTED** — no route, no nav link, no redirect from `/` points to it yet
- [ ] When ready to connect: add a route at `src/app/page.tsx` (or `src/app/(marketing)/page.tsx`) that renders this content, OR set up a redirect/rewrite in `next.config.ts` to serve `landing.html` at `/`
- [ ] Screenshot placeholders remain in the page — replace each `ph-full` div's inner content with a real `<img>` tag when screenshots are available
- [ ] Logo path: `/screenshots/logo (2).png` — if the public/screenshots folder is ever reorganized, update the `src` in the nav, hero mockup float card, and footer

### Phase 14 — NOT STARTED

---

### Feature Additions (post-launch, this session) — COMPLETE

**DB migration required:** `supabase/migrations/003_feature_additions.sql` — must be run in Supabase Dashboard → SQL Editor before these features work. Adds `shifts.notes`, agency profile columns (`display_name`, `contact_email`, `bio`, `logo_url`, `require_claim_approval`), `shift_claims.agency_approved_at/by`, and the `notification_preferences` table.

#### Shift Notes (Feature 1)
- [x] `shifts.notes TEXT` column added to DB migration
- [x] `POST /api/shifts` and `POST /api/shifts/placeholder` — accept `notes` in body; trim + 500-char max; null if blank
- [x] `ShiftPostForm` and `PlaceholderShiftForm` — optional "Special Requirements" textarea; counter shown above 400 chars; reset on submit
- [x] `ShiftDayPanel` — renders notes as italic gray text below the time/status row, hidden when cancel confirm bar is open
- [x] `AgencyShiftDayPanel` — same; hidden during nurse info, confirm, decline, and cancel prompts
- [x] `ShiftCard` — `notes?: string | null` added to `ShiftCardData`; rendered as a "Special Requirements" callout box above the claim button (not shown once claimed)
- [x] Nurse page shift queries — added `notes` to both real-facility and placeholder shift `.select()` strings

#### Repeat Nurse Tracking (Feature 2)
- [x] `src/components/facility/RepeatNurseTable.tsx` — new component; columns: nurse name, credential badge, shifts completed, most recent date; returns null when empty
- [x] Facility dashboard server page — fetches confirmed claims with `shifts!inner(facility_id)` filter; groups by nurse in JS; top 20 sorted by count desc then most recent date; passes as `repeatNurses` prop
- [x] Facility dashboard page JSX — renders `<RepeatNurseTable>` below agency overview and fill rate sections

#### Fill Rate (Feature 3)
- [x] Agency dashboard server page — `computeFillRate()` helper; fetches prior month shifts in parallel; computes `{ confirmed, total }` per credential; passes `fillRateData: FillRateRow[]` to client
- [x] Agency dashboard client — fill rate table widget: credential, this month %, last month %, trend arrow (↑/↓/→); shown below shift tabs
- [x] Facility dashboard server page — same pattern; computes `facilityFillRateData`; passes to `FacilityDashboardClient`
- [x] Facility dashboard client — `FacilityFillRateRow` interface and fill rate widget added; wrapped return in `space-y-6` div

#### Notification Preferences (Feature 4)
- [x] `notification_preferences` table in DB migration — `profile_id` FK, `preferences JSONB`, unique on `profile_id`
- [x] `GET /api/notifications/preferences` — returns preferences JSONB for current user; `{}` if none
- [x] `PUT /api/notifications/preferences` — upserts on `profile_id`; validates `preferences` is an object
- [x] `src/components/notifications/NotificationPreferencesForm.tsx` — checkbox grid (event types × channels); loads from GET on mount; merges with defaults; saves via PUT; channels prop controls which columns appear
- [x] `dispatchNotifications()` in `dispatch.ts` — batches a `checkPreferences()` call before insert; groups items by event_type; filters out opted-out channels per profile; if all items filtered, returns early without touching DB
- [x] Agency settings page — `NotificationPreferencesForm channels={['in_app', 'email']}` added below pay tier section
- [x] Facility settings page — same
- [x] `src/app/(nurse)/nurse/settings/page.tsx` — new page with `NotificationPreferencesForm channels={['in_app', 'email', 'sms']}`
- [x] Nurse layout — added "Settings" nav link (uses existing `settings` icon from `ICONS` map)

#### Agency Profile / Public Info (Feature 6)
- [x] `agencies` table — added `display_name`, `contact_email`, `bio`, `logo_url`, `require_claim_approval` in DB migration
- [x] `src/lib/supabase/types.ts` — all five columns added to `agencies` Row/Insert/Update
- [x] `src/components/agency/AgencyProfileForm.tsx` — form with display name, contact email, bio (600-char max), logo URL with `<img>` preview; calls `PATCH /api/settings/agency-profile`
- [x] `PATCH /api/settings/agency-profile` — verifies agency ownership; updates four profile columns via admin client
- [x] Agency settings page — fetches `display_name, contact_email, bio, logo_url, require_claim_approval` from agencies table; renders `AgencyProfileForm` at top, above pay tier section
- [x] Claim route coordinator email — fetches agency `display_name` and `contact_email` alongside placeholder; email footer shows "Sent by {display_name}" with mailto link if contact_email set
- [x] `POST /api/placeholders/connect` — uses `display_name ?? name` in in-app notification and email subject/body to facility admin

#### Claim Approval Workflow (Feature 5)
- [x] `agencies.require_claim_approval BOOLEAN NOT NULL DEFAULT FALSE` in DB migration
- [x] `shift_claims.agency_approved_at TIMESTAMPTZ` and `agency_approved_by UUID` in DB migration
- [x] `src/components/agency/ClaimApprovalToggle.tsx` — toggle switch; calls `PATCH /api/agency/[agencyId]/settings`; shows current state description
- [x] `PATCH /api/agency/[agencyId]/settings` — agency_admin only; updates `require_claim_approval`; verifies ownership
- [x] Agency settings page — `ClaimApprovalToggle` section added between agency profile and pay tier sections
- [x] `POST /api/shifts/claim` — after agency membership check, fetches `agency.require_claim_approval`; if true: inserts claim as `agency_review` status, skips shift status transition (stays `open`), notifies only agency admin (not facility); if false: existing behavior unchanged
- [x] `POST /api/shifts/agency-approve` — agency_admin only; verifies claim is `agency_review` and belongs to their agency; re-runs double-booking check; updates claim to `pending` + sets `agency_approved_at/by`; transitions shift to `claimed` if still `open`; notifies facility admin in-app
- [x] `POST /api/shifts/agency-reject` — agency_admin only; updates claim to `rejected`; notifies nurse in-app
- [x] Agency dashboard server page — fetches `agency_review` claims for this agency's nurses; maps to `PendingApprovalClaim[]`; passes as `pendingApprovalClaims` prop
- [x] Agency dashboard client — `PendingApprovalClaim` type exported; `pendingApproval` local state initialized from prop; "Needs Your Approval" amber card appears at top when non-empty; each row shows nurse name, credential badge, facility, date/time, Approve and Reject buttons; optimistically removes from list on action

#### Credential Pipeline — 90-day Extended Window (Feature 7)
- [x] Agency dashboard server page — widened credential alert query to 90 days; `tbPipelineStr = today - 275 days`; added `daysUntilDate()` helper and `alertIsUrgent()` to split into `credentialAlerts30` (≤30d) and `credentialAlerts90` (31–90d)
- [x] Agency dashboard client — two-tab credential widget: "Expiring Soon" (amber) and "Upcoming 31–90d" (blue/slate); `credTab` state controls which tab is visible

#### Per-Nurse Reliability Score (Feature 8)
- [x] Agency dashboard server page — expanded staff claims query to all statuses; computes `cancel_rate` (withdrawn / total actionable) and `late_cancel_rate` (late-cancel withdrawals / total withdrawals) per nurse
- [x] Agency dashboard client — staff activity table: replaced "Canceled" count column with "Cancel %" (amber ≥20%) and "Late %" (red ≥10%) columns; `StaffSummary` type updated with `cancel_rate` and `late_cancel_rate`

---

### Post-Launch Fixes & Enhancements — COMPLETE

#### DNR System Overhaul
- [x] Fixed `agency_id` bug in DNR submission — `ShiftClaimQueue` was passing `nurse_profile_id` as `agency_id`; fixed by adding `agency_id` to `ClaimInQueue` type and threading it through the claims page assembly
- [x] DNR now cancels future confirmed shifts — `POST /api/dnr` uses two-query pattern to find all active claims for the nurse, filters to future shifts at that facility, withdraws affected claims, reopens confirmed shifts to `open`, notifies nurse in-app per canceled shift, includes canceled count in agency admin notification; returns `{ dnr, canceled_shifts }`
- [x] DNR confirmation modal — clicking "Issue DNR" opens a modal with nurse name, amber warning about shift cancellations and notifications; requires explicit confirm; dismissable without action
- [x] `DELETE /api/dnr` — facility admin can remove a DNR record (undo); scoped to their own facility
- [x] Undo button on DNR — after issuing, button changes to "DNR Issued · Undo"; undo calls `DELETE /api/dnr`; undo state persists across page reloads (claims page fetches `dnr_records` server-side and passes as `dnrNurseIds` prop to `ShiftClaimQueue`)
- [x] DNR'd facility shifts hidden from nurse — nurse page fetches `dnr_records` for the nurse, removes DNR'd facility IDs from `allowedFacilityIds` before the shift query so those shifts are never fetched

#### Shift Cancellation from Calendars
- [x] `POST /api/shifts/cancel` updated — now accepts `agency_admin` role in addition to `facility_admin`; agency admins can only cancel placeholder shifts belonging to their agency; added `final` boolean: `final: true` sets status to `canceled` permanently, `final: false` (or omitted, existing behavior) reopens shift to `open` for refilling
- [x] Facility calendar cancel (`ShiftDayPanel`) — every active shift (open/claimed/confirmed) has a `✕` button; clicking expands an inline red confirmation bar with "Keep" / "Cancel shift"; confirmed shifts show nurse notification warning; on confirm, parent state updated to `canceled` via `onShiftCanceled` callback
- [x] Agency calendar cancel (`AgencyShiftDayPanel`) — same UX, but cancel button only shown on placeholder shifts (`is_placeholder = true`); agency admins cannot cancel real facility shifts
- [x] `onShiftCanceled(shiftId)` callback added to `ShiftDayPanel`, `AgencyShiftDayPanel`, `ShiftCalendarView`, `AgencyShiftCalendarView` — updates local shift status to `canceled` without a page reload

#### Coordinator Decline Flow
- [x] Coordinator email updated — two buttons side by side: teal "Confirm This Shift" + outlined red "Decline"; both use the same token (`declineUrl = /decline/${token}`)
- [x] `/confirm/[token]` — now fetches nurse info from pending claim (name, license, phone, CPR exp, TB valid until) and displays it above the action buttons; added outlined red "Decline" button that routes to `/decline/${token}`
- [x] `/decline/[token]` — new public page; same token used for both confirm and decline; shows shift details + nurse info; checkbox "Reopen shift for reassignment" (checked by default — uncheck if facility has coverage); two buttons: "Confirm Instead" and "Yes, Decline"; on decline: pending claims rejected, shift reopened or permanently canceled depending on checkbox, nurse notified in-app, agency admin notified in-app
- [x] `POST /api/decline-token` — accepts `{ token, reopen: boolean }` (reopen defaults true); validates token, rejects pending claims, sets shift to `open` if reopen or `canceled` if not; dispatches in-app notifications to nurse(s) + agency admin with message reflecting reopen vs. closed
- [x] Both confirm and decline pages share the same `placeholder_confirm_tokens` row and token — token is marked `used_at` by whichever action completes first; second action returns 409 `already_used`
- [x] Nurse shift list hides shifts where the nurse already has a `rejected` claim — fetches rejected claims on the nurse page and filters them from the shift array; ensures declined nurses don't see a reopened shift

#### Agency-Side Claim Review (Confirm / Decline from Calendars)
- [x] `POST /api/shifts/placeholder-confirm` — agency_admin only; accepts `{ shift_id, action: 'confirm' | 'decline', reopen?: boolean }`; verifies `is_placeholder` + agency ownership; confirm: confirms first pending claim, rejects others, updates shift to `confirmed`, notifies nurse SMS + in-app; decline: rejects all pending claims, sets shift to `open` or `canceled` per reopen flag, notifies nurse in-app
- [x] `AgencyShiftDayPanel` — `claimed` placeholder shift rows now show ✓ / ✕ icon buttons; clicking opens an inline prompt (green for confirm, red for decline); decline prompt includes "Reopen shift for reassignment" checkbox; all actions update shift status in-place without page reload
- [x] `AgencyShiftCalendarView` — added `handleShiftConfirmed` (status → `confirmed`) and `handleShiftReopened` (status → `open`) alongside existing `handleShiftCanceled`; threaded as `onShiftConfirmed` and `onShiftReopened` props to `AgencyShiftDayPanel`
- [x] `AgencyShiftsClient` (main agency shifts page) — same confirm/decline UI built inline in the day panel; agency admins no longer need to navigate to the placeholder facility detail page to action claims
- [x] `GET /api/shifts/[id]/nurse` — extended to return nurse info for `pending` claims in addition to `confirmed`; used by both calendar views to show who claimed a shift before it's confirmed
- [x] Nurse info displayed inline on claimed placeholder shifts in both calendars — fetched lazily when a day is selected; cached in component state; shows name, license, phone, CPR exp, TB valid until above the Confirm/Decline buttons

#### Facility Staff Enrollment — COMPLETE
- [x] SQL migration: `ALTER TABLE agencies ADD COLUMN IF NOT EXISTS house_for_facility_id UUID REFERENCES facilities(id) UNIQUE;` — each facility gets at most one "house agency" (auto-created on first enrollment)
- [x] `POST /api/facility-staff/create` — facility_admin only; finds/creates a house agency named `{Facility Name} Staff`; creates an `agency_facility_connections` row on first creation so enrolled nurses see that facility's shifts; enrolls nurse the same way as `/api/staff/create`; returns `{ nurseProfileId, existing }`
- [x] `NursysLookupForm` — accepts `facilityId?: string` as alternative to `agencyId`; uses `/api/facility-staff/create` when set; redirects to `/facility/${facilityId}/staff/${nurseProfileId}` on success; renames "Agency Settings" section to "Enrollment Settings"
- [x] `/facility/[facilityId]/staff/page.tsx` — queries house agency nurses via `agency_nurse_relationships`; renders `StaffRosterTable` with `facilityId` prop so row clicks navigate to `/facility/[facilityId]/staff/[nurseId]`
- [x] `/facility/[facilityId]/staff/new/page.tsx` — enrollment form using `NursysLookupForm` with `facilityId`
- [x] `/facility/[facilityId]/staff/[nurseId]/page.tsx` — reuses `NurseProfileClient` with house agency ID and `backHref=/facility/[facilityId]/staff`
- [x] `NurseProfileClient` — added `backHref?` prop; "Staff Roster" back link and post-remove redirect now use it; defaults to `/agency/${agencyId}/staff`
- [x] `StaffRosterTable` — added `facilityId?` prop; row click navigates to facility staff profile when set, agency profile otherwise
- [x] `PATCH /api/staff/[nurseId]` and `DELETE /api/staff/[nurseId]` — both now accept `facility_admin` role; facility admin may only edit/deactivate nurses whose house agency `house_for_facility_id` matches their own facility
- [x] Facility layout — added "Staff" nav link between Dashboard and Shifts
- [x] Enrolled nurses see only that facility's shifts — house agency's `agency_facility_connections` row connects it to the one real facility; the nurse page's existing `agency_facility_connections` lookup handles filtering automatically; no nurse page changes needed

#### Nurse Schedule Page — Drive Times & Clickable Addresses
- [x] Nurse schedule server page (`/nurse/schedule/page.tsx`) — now fetches `home_address_lat/lng/home_address` from `nurse_profiles` and cached drive times from `nurse_drive_times`; passes `nurseOrigin` and `initialDriveTimes` to client
- [x] `ScheduleClaim.shift` type extended with `facilityId` and `placeholderFacilityId` — required for drive time hook to resolve times by ID
- [x] `NurseScheduleClient` — imports `useDriveTime` hook; derives `uniqueFacilityIds` and `uniquePlaceholderIds` from claims; drive times fetched/cached same as available shifts page
- [x] Upcoming confirmed cards and day panel shift cards — facility address is now a teal clickable link opening Google Maps directions from nurse's home; `~X min away` shown below when drive time is available; falls back to plain gray text if no `nurseOrigin` on file

#### Shift Needs Outreach Email — COMPLETE
- [x] `POST /api/shifts/outreach-email` — facility_admin only; verifies ownership; fetches facility info + all open shifts for the requested month; builds branded HTML email grouped by credential (CNA→CMA→LPN→LPN_IV→RN), sorted by date; sends to each recipient via `sendEmail()` directly (not `dispatchNotifications` — this is outbound marketing, not a platform event); returns `{ sent, failed, total }`; CTA routes through `/api/track/cta` for click tracking
- [x] `ShiftOutreachModal` (`src/components/facility/ShiftOutreachModal.tsx`) — 3-step modal: Compose (saved contacts checklist pre-checked + new email chip input) → Preview (live preview + recipient list) → Done (sent/failed result); after send, upserts all recipients to `facility_outreach_contacts` via fire-and-forget; backdrop click closes
- [x] `ShiftCalendarView` — added `facilityName` prop; "Send Shift Needs Email" outlined-teal button above calendar; `openShifts` derived via `useMemo` from shifts state; `currentMonth` computed from year/month state; wires `ShiftOutreachModal`
- [x] Facility shifts page — added parallel `facilities.select('name')` query; passes `facilityName` to `ShiftCalendarView`
- [x] Email design: teal ShiftBridge header → facility name/type/full address → "Open Shift Needs — [Month Year]" → shifts grouped by credential with tier badges (★ Priority amber / ★★ Urgent red) and notes indented below each row → "Claim These Shifts on ShiftBridge →" CTA → branded footer with passive marketing copy; gracefully handles zero open shifts

#### Saved Outreach Contacts + CTA Tracking — COMPLETE
- [x] `supabase/migrations/004_outreach_tracking.sql` — `facility_outreach_contacts` table (`facility_id, email, label, last_used_at, platform_outreach_sent_at`; UNIQUE on facility+email) + `cta_events` table (`event_type, facility_id, token_id`); no RLS — all access via service-role
- [x] `GET /api/outreach-contacts` — facility_admin; returns contacts ordered by `last_used_at DESC`
- [x] `POST /api/outreach-contacts` — facility_admin; upserts on `(facility_id, email)`; updates `last_used_at`
- [x] `DELETE /api/outreach-contacts/[id]` — facility_admin; verifies facility ownership before delete
- [x] `GET /api/track/cta` — **public** (in PUBLIC_ROUTES); logs to `cta_events` then 302-redirects to `redirect` param; `tid` resolves to `placeholder_confirm_tokens.id`; `fid` resolves to `facility_id`; tracking failure is silent — redirect always fires
- [x] `ShiftOutreachModal` — loads saved contacts on mount; renders "Previously contacted" checklist (pre-checked, removable); new-email chip input stays below; recipients = union of checked contacts + new chips; after send upserts all recipients to contacts table
- [x] `ConfirmTokenClient` — "Learn About ShiftBridge" CTA now routes through `/api/track/cta?event=coordinator_confirm&tid={token}`
- [x] `DeclineTokenClient` — added "Learn About ShiftBridge" CTA (previously absent on decline success page); routes through `/api/track/cta?event=coordinator_decline&tid={token}`
- [x] `middleware.ts` — `/api/track` added to `PUBLIC_ROUTES`

#### Clickable Notification Bell — COMPLETE
- [x] `NotificationBell.tsx` — added `role?: string` and `entityId?: string` props; `getNotificationHref()` helper maps event_type + role + entityId to a destination URL; clicking a navigable notification marks it read AND navigates via `router.push()`; a `›` chevron appears on rows that have a destination, no chevron on non-navigable rows (e.g. `credential_expiring`); dropdown closes on navigation
- [x] Agency layout — passes `role="agency_admin"` and `entityId={agencyId}` to `NotificationBell`
- [x] Facility layout — passes `role="facility_admin"` and `entityId={facilityId}` to `NotificationBell`
- [x] Nurse layout — passes `role="nurse"` to `NotificationBell` (no entityId needed)

### Demo Mode — COMPLETE

**DB migration required:** Run `006_schema_catchup.sql` in Supabase Dashboard → SQL Editor before demo mode is usable. As of 2026-07-06 the live dev DB had an OLD demo_sessions shape (`session_token`, `ip_address`, ...) that does not match what `/api/demo/launch` writes — 006 drops and recreates it with the correct shape:
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

- [x] `src/lib/demo/context.ts` — `isDemoUser(user)` helper; checks `user?.app_metadata?.role === 'demo'`; imported by all modified API routes and pages
- [x] `POST /api/demo/launch` — public endpoint; rate-limits at 20 active sessions; creates Supabase auth user with `role: 'demo'` in app_metadata; calls `createDemoSession()` which seeds: agency (Heartland Per Diem Staffing), 2 Kansas facilities (Cottonwood Creek Memory Care + Prairie View SNF), shift configs, `agency_admins` row for the demo user, `facility_admins` row for primary facility, 4 roster nurse auth users + profiles + nurse_profiles, demo user's own nurse_profile, ~15 open shifts, 1 pre-seeded claimed shift, 3 historical confirmed shifts, placeholder facility (Flint Hills, match_detected), 3 placeholder shifts, 1 connection request; returns `{ email, password }` so login page can auto-sign in; on failure: deletes auth user and returns `{ error, detail }` with actual Supabase error message
- [x] `POST /api/demo/cleanup` — super_admin only; accepts `?force=true` to clean all sessions (not just expired); deletes in dependency order: notifications → shift_claims → shifts → placeholder_facilities → connection_requests → agency_nurse_relationships → facility_shift_configs → agency_facility_connections → facility_admins + agency_admins → roster nurse auth users (via `admin.auth.admin.deleteUser`) → nurse_profiles → facilities → agency → demo user profile → demo user auth → demo_sessions row
- [x] `src/components/layout/DemoSidebarNav.tsx` — three-section sidebar (Agency Admin / Facility Admin / Nurse) with nav links per section; `useCountdown(expiresAt)` hook with 30-second interval; DEMO badge + session expiry countdown in footer; props: `agencyId`, `facilityId`, `userName`, `expiresAt`
- [x] `src/app/(demo)/layout.tsx` — auth guard (`role !== 'demo'` → redirect `/login`); reads `agencyId`/`facilityId` from `user.app_metadata`; fetches `expires_at` from `demo_sessions` via admin client; renders `DemoSidebarNav`
- [x] `src/app/(demo)/demo/page.tsx` — redirects to `/demo/agency/${agencyId}`
- [x] 12 demo page wrappers — `export { default }` re-exports from real pages; works because real page components only check `if (!user)`, not role (layout handles that); routes: agency dashboard/staff/shifts/facilities/settings, facility dashboard/shifts/claims/staff/settings, nurse available/schedule
- [x] 28 API routes modified — `isDemoUser` import added; role checks updated to `role !== 'X' && !isDemoUser(user)`; pattern: demo users are trusted for any role action since the demo layout already verified `role === 'demo'`
- [x] Login page — "Launch Interactive Demo →" teal outline button; `handleLaunchDemo`: POST `/api/demo/launch` → get `{email, password}` → `supabase.auth.signInWithPassword` → `window.location.href = '/demo'`; shows loading state and error message if launch fails
- [x] Admin dashboard — "Demo Sessions" tab added to `AdminDashboardClient`; shows session list (created_at, expires_at, active/expired badge); "Clean Up Expired" and "Clean All" buttons call `/api/demo/cleanup`; `demoSessions` + `activeDemoCount` fetched server-side in `admin/page.tsx`
- [x] Middleware — added `demo: '/demo'` to `ROLE_REDIRECTS`; `/api/demo/launch` added to `PUBLIC_ROUTES` (no auth needed to start a demo)

#### Facility Notes for Nurses — COMPLETE
- [x] **DB migration required** — `ALTER TABLE facilities ADD COLUMN IF NOT EXISTS facility_notes TEXT; ALTER TABLE placeholder_facilities ADD COLUMN IF NOT EXISTS facility_notes TEXT;`
- [x] `src/lib/supabase/types.ts` — `facility_notes: string | null` added to `facilities` and `placeholder_facilities` Row/Insert/Update
- [x] `PATCH /api/settings/facility-profile` — new route; facility_admin only; verifies ownership via `facility_admins`; trims and nulls blank input; updates `facilities.facility_notes`
- [x] `src/components/facility/FacilityNotesForm.tsx` — new client component; textarea with teal focus ring; Save button disabled when clean; "Saved" confirmation text; calls `/api/settings/facility-profile`
- [x] Facility settings page — fetches `facility_notes` via admin client in parallel with shift configs; renders `FacilityNotesForm` at top of page above shift config section
- [x] `PlaceholderFacilityDetailClient` — `facility_notes` added to `PlaceholderFacility` interface, form state, read-only display (full-width row, hidden when empty), and edit form (full-width textarea below coordinator email)
- [x] `PATCH /api/placeholders/[placeholderId]` — destructures and saves `facility_notes`; trims, nulls if blank
- [x] `ShiftCardData` type — `facility_notes?: string | null` added
- [x] `ShiftCard` — renders teal "Facility Info" callout (`bg-teal-50` / `#F0FDF9` tint) above the gray "Special Requirements" callout; only shown when set and shift isn't claimed
- [x] Nurse page shift queries — `facility_notes` added to `facilities(...)` and `placeholder_facilities(...)` select strings; mapped into `ShiftCardData` in both real and placeholder result arrays

---

## Future Features (post-launch ideas)

### Nurse Mobile App

### Nurse Mobile App
Nurse-facing mobile app using React Native / Expo. Agency and facility admin sides stay as desktop web — the nurse workflow (checking available shifts, claiming, viewing schedule) is the only role that makes strong sense on mobile.

**Approach:**
- All backend stays identical — same Supabase DB, same API routes, same auth
- Rebuild only the nurse UI layer in React Native
- Reuse the same Supabase JS client for data fetching
- Push notifications for new matching shifts would be the killer feature (requires native notification infrastructure)

**What needs mobile-specific work:**
- Shift calendar and list views rebuilt for touch
- Claim flow optimized for small screen
- Push notifications via Expo Notifications or similar
- App Store / Google Play submission (Apple can be slow for healthcare-adjacent apps)

**PWA as a stepping stone:** The existing Next.js app could be made installable as a Progressive Web App with minimal effort — no App Store needed, works from phone home screen. Good for early testing before committing to a full native build.

---

## Architecture Decisions

### Auth / Roles
- Role is stored in `auth.users.raw_app_meta_data` as `{ "role": "super_admin" }` etc.
- Middleware reads `user.app_metadata.role` from the JWT — **no DB query in middleware**
- Layouts verify role via `user.app_metadata?.role` — only query DB for `full_name`
- To set a user's role in Supabase SQL editor:
  ```sql
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || '{"role": "super_admin"}'::jsonb
  WHERE email = 'user@example.com';
  ```

### Login Flow
- After `supabase.auth.signInWithPassword`, use `window.location.href = '/'` (hard redirect)
- Do NOT use `router.push()` + `router.refresh()` — causes SSR cookie conflicts

### Database
- All tables have RLS enabled
- Helper functions: `get_my_role()`, `get_my_agency_id()`, `get_my_facility_id()`, `get_my_nurse_profile_id()`, `get_visible_credentials()`
- View `nurse_profiles_facility_view` strips `home_address`, `home_address_lat`, `home_address_lng`
- `shifts` table has XOR constraint: either `facility_id` OR `placeholder_facility_id`, never both

### Shift Config (Phase 4)
- `POST /api/settings/shift-configs` uses delete-then-insert (not upsert) because renaming a slot would leave orphan rows if we upserted on `UNIQUE(facility_id, credential_type, shift_name)`
- Facility dashboard and shifts page both show amber banner if no shift configs exist

### Realtime (Phase 5)
- `useRealtimeShifts` uses `cbRef = useRef(callbacks); cbRef.current = callbacks` pattern — callbacks are always fresh without triggering re-subscription
- `ShiftCalendarView` checks `shift_date.startsWith(currentMonthPrefix)` before applying realtime inserts/updates — ignores events for other months
- Optimistic post in `ShiftCalendarView.handleShiftPosted` deduplicates against realtime by ID (realtime will also fire for self-inserts)
- Month fetch uses `shift_date >= first_day AND shift_date <= last_day` string comparison (works because YYYY-MM-DD is lexicographically sortable)

### Drive Time (Phase 12)
- `POST /api/drive-time` never returns coordinates — only `{ facilityId: minutes }`. Home lat/lng fetched via service-role client server-side.
- `useDriveTime` dependency array uses `facilityIds.join(',')` to avoid referential instability from array identity changes across renders
- Drive time only shown for real facilities (`facility_id !== null`). Placeholder shifts silently get `null`.
- sessionStorage cache key: `shiftbridge_drive_times` — survives page navigation, cleared on tab close

### Dashboards & Export (Phase 13)
- Agency dashboard fetches current-month shifts for **connected facility IDs** (real facilities) AND the agency's own placeholder shifts (`agency_id = agencyId AND is_placeholder = true`, separate query since placeholder shifts have `facility_id = NULL`) for the Confirmed/Pending/Canceled tabs; the two result sets are merged into `allShifts` before categorization — **bug fixed 2026-07-15**: confirmed/pending/canceled placeholder shifts previously never appeared anywhere on the dashboard because the original query only matched `facility_id IN (connected facilities)`, and the "Open Needs" widget only shows `status = 'open'`, so a claimed/confirmed placeholder shift fell into a blind spot; placeholder shift rows show a small "PH" badge (`ShiftSummary.is_placeholder`) next to the facility name so they're distinguishable from a same-named real facility
- Fill rate and financial snapshot now include placeholder shifts too (merged into `allShifts` and `prevMonthShifts`/`prevMonthPlaceholderShifts`) — a placeholder shift that never gets confirmed correctly lowers fill rate, same as an unfilled real-facility shift
- Financial snapshot sums `hoursWorked(start, end) × payRateMap[nurseProfileId]` — only counts confirmed claims where nurse has a rate on file
- Financial snapshot uses `base_pay_rate` from `agency_nurse_relationships` (what the agency pays the nurse), not the facility bill rate — the facility bill rate lives on `agency_facility_connections.bill_rate` and is used for the facility-side cost estimate
- `GET /api/shifts/export` fetches all connected facility IDs for the agency first, then queries shifts `IN (facilityIds)` — avoids join-filter unreliability; same `hoursWorked` helper used for totals
- `POST /api/notifications/mass-text` sends one `in_app` notification per nurse always, plus one `sms` if a phone number is on their profile — both dispatched via `dispatchNotifications` so they're recorded in the notifications table
- Super admin account suspend uses Supabase auth `ban_duration: '876600h'` (~100 years) — this prevents login at the auth layer, not just the profile layer. Activate uses `ban_duration: 'none'` to lift.
- `PATCH /api/admin/accounts` reset_password uses `admin.auth.admin.generateLink({ type: 'recovery', email })` — this generates a magic recovery link and sends it via Supabase's configured email provider; no Resend needed
- Facility bill rate is stored on `agency_facility_connections.bill_rate` (already in schema Phase 1); the `FacilityDashboardClient` computes estimated cost client-side as the user edits the rate input, then saves via `POST /api/settings/bill-rate`

### Address Matching & Connections (Phase 10)
- Match is on `address_normalized` **alone** (as of migration `007_address_only_match.sql`) — both the DB trigger and the JS-side reverse check originally also required exact `facility_type` equality, but two independently-entered records for the same building routinely disagree on category (e.g. agency logs a placeholder as "Long-Term Care", the facility signs up as "Memory Care" for the same address) — this silently prevented real matches from ever firing. Dropping the type check is safe because a match only ever produces an in-app *suggestion*; the agency still has to send a connection request and the facility still has to explicitly accept it before anything actually links.
- `detect_placeholder_match` trigger fires on `facilities INSERT` only — it does NOT fire on address updates, and does NOT fire on `placeholder_facilities INSERT`. Two directions to handle:
  - Facility joins after placeholder exists → DB trigger handles it
  - Placeholder created after facility already exists → `POST /api/placeholders` checks for a match in application code after insert and sets `match_detected` + dispatches in-app notification; also returns `matched_facility_name` in the response so the alert renders immediately without a page reload
- `accept_connection` RPC uses `FOR UPDATE` to lock the request row — prevents double-accept race condition
- On accept, RPC deletes ALL non-canceled shifts for the placeholder (regardless of status) — agency admin notified with `deleted_shifts` count in the in-app notification
- Decline sets `connection_status = 'declined'` on the placeholder — agency admin can resend a new request (creates a new `connection_requests` row); there's no limit on resend attempts
- `AddressMatchAlert` updates `connection_status` optimistically in client state on request sent — no page reload needed
- `matchedFacilityNames` on the Facilities page MUST use the admin client — agency admins have no RLS access to read facilities they aren't yet connected to, so the user client silently returns empty for newly matched facilities
- `matchedFacilityNames` is kept in React state (not just a prop) in `FacilitiesClient` — updated when a newly created placeholder comes back with `matched_facility_name` in the API response, so the match alert appears on the new row immediately
- Connected placeholders (`connection_status = 'connected'`) are hidden from the Facilities list UI — the real connection lives in `agency_facility_connections`; the placeholder record is kept in DB but not shown
- `DELETE /api/placeholders/[placeholderId]` — agency_admin only; blocks deletion when `connection_status = 'connected'`; cascades by deleting associated shifts and connection_requests rows before removing the placeholder; detail page has an inline confirm bar ("Delete / Keep / Yes, Delete")

### Placeholder Facilities (Phase 9)
- `POST /api/placeholders` normalizes address (lowercase, expand St/Ave/Blvd etc., strip Apt/Suite/Unit) — same logic will be used by Phase 10 address matching trigger
- Coordinator confirm/decline links generated in claim route: inserts `placeholder_confirm_tokens` row (7-day expiry, token is DB-generated hex), sends email via Resend with both `${NEXT_PUBLIC_SITE_URL}/confirm/${token}` and `${NEXT_PUBLIC_SITE_URL}/decline/${token}`
- Add `NEXT_PUBLIC_SITE_URL=https://yourdomain.com` to `.env.local` for production links; falls back to `http://localhost:3000`
- `/confirm/[token]` and `/decline/[token]` are public routes (listed in `PUBLIC_ROUTES` in middleware) — no login required for coordinators
- `POST /api/confirm-token` and `POST /api/decline-token` use service role only (no auth header) — token is the authenticator
- Both confirm and decline mark the same token row `used_at` — whichever fires first wins; the other returns 409 `already_used`; confirm sets shift to `confirmed`; decline sets shift to `open` (reopen=true) or `canceled` (reopen=false)
- Declined nurses are hidden from the shift even if it's reopened — `rejected` claim stays in DB; nurse page fetches rejected claims and filters those shift IDs out of the available list
- Agency calendar (`AgencyShiftCalendarView`) fetches all RLS-visible shifts for the month; RLS policy `agency_sees_connected` handles filtering

### Notifications (Phase 8)
- Twilio and Resend clients use raw `fetch` — no npm packages needed. Add env vars to activate: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`
- All notification dispatches are wrapped in `try/catch` in the routes — notification failures never fail the main mutation
- In-app notifications work immediately (pure Supabase) — bell/unread count is live without any external accounts
- Twilio webhook stores the message SID in `notifications.payload.twilio_sid` for status matching — update dispatch to store SID when Twilio is live
- The `NotificationBell` realtime subscription only surfaces `channel='in_app'` rows — SMS/email rows are written to DB but not shown in the bell

### DNR (Post-Launch)
- `ClaimInQueue` type includes `agency_id` — the claims page assembly must pass it from the `shift_claims` row; do not derive it from the nurse object
- DNR cancellation of future shifts uses the two-query pattern: fetch all active claims for the nurse first, then fetch future shifts at the facility from that ID set — avoids unreliable join-filter behavior
- `dnr_records` has no RLS policy allowing nurses to read their own records — the nurse page uses the admin client to fetch them, which is safe since auth is validated at the layout level
- Nurse page filters DNR'd facilities out of `allowedFacilityIds` before the shift query — do NOT rely on a post-filter on the results array, because if the `facilities` join returns null (RLS policy `nurse_reads_active_facilities` not applied), the facility_id is still on the row and would slip through
- `ShiftClaimQueue` initializes `dnrIssuedFor` state from `dnrNurseIds` prop (fetched server-side on the claims page) — this is required for the undo button to appear after page reload; without it the component always starts with an empty set
- `DELETE /api/dnr` only removes the record — it does NOT restore previously canceled shifts; those must be re-posted manually

### Agency Claim Review (Post-Launch)
- `POST /api/shifts/placeholder-confirm` accepts `action: 'confirm' | 'decline'` — confirm mirrors the confirm-token logic (confirm first pending claim, reject rest, shift → confirmed); decline mirrors decline-token logic (reject all pending claims, shift → open or canceled per `reopen` flag)
- `GET /api/shifts/[id]/nurse` now returns info for `pending` claims as well as `confirmed` — prefers confirmed if both exist; used by both agency calendar views to show who claimed a placeholder shift before the agency has actioned it
- Nurse info fetched lazily in `AgencyShiftsClient` via `useEffect` on `selectedDate` change, and in `AgencyShiftDayPanel` via `useEffect` on `shifts` prop change — both cache results in a `nurseInfoMap` state object keyed by shift ID so re-selecting a day doesn't re-fetch
- `onShiftReopened(shiftId)` callback sets local shift status to `open` (distinct from `onShiftCanceled` which sets to `canceled`) — needed because declining with `reopen=true` should show the shift as open again in the calendar, not hidden

### Shift Cancellation (Post-Launch)
- `POST /api/shifts/cancel` accepts a `final` boolean: `true` = set status to `canceled` (calendar cancel, permanent); omitted/false = set status to `open` (claims queue cancel, reopens for refilling)
- Agency admins can only cancel `is_placeholder = true` shifts via the cancel API — real facility shifts are facility-admin only; the API enforces this server-side
- Cancel button only shown on placeholder shifts in `AgencyShiftDayPanel` (`shift.is_placeholder` guard) — real facility shifts in the agency calendar are read-only
- `onShiftCanceled(shiftId)` callback pattern used in both calendar views — updates local state to `canceled` status immediately without a page reload; the shift moves from `activeShifts` to `canceledShifts` in the day panel on next render

### Claim Confirmation (Phase 7)
- Confirm API rejects other pending claims in a separate update (not a transaction) — Supabase JS has no multi-statement transactions; the confirm + reject are two separate admin calls. If the reject fails, the winning claim is still confirmed; it just leaves orphan pending claims that can be cleaned up.
- Cancel uses `shift_date + start_time` combined into a JS `Date` for the 12h threshold — no timezone handling yet; assumes server and shift are in the same timezone. Flag this if facilities span time zones.
- DNR verifies the nurse has a confirmed claim at this facility using a join filter (`.eq('shifts.facility_id', ...)`) — this is the one place we use a join filter since it's a simple existence check, not a data-returning join.

### Shift Claiming (Phase 6)
- Double-booking check uses two separate queries (not a join with filter) to avoid Supabase JS join-filter limitations (same pattern as the `.in()` warning in Known Issues)
- Time overlap logic: `s1 < e2 && s2 < e1` — works for same-day HH:MM:SS strings; overnight shifts (end < start) need additional handling in a future pass
- Claim API re-activates `withdrawn` claims rather than inserting duplicates (UNIQUE constraint on `shift_id, nurse_profile_id`)
- `open` → `claimed` status transition happens in the API on first claim; subsequent claims on an already-`claimed` shift do not change status
- `NurseShiftList` uses per-shift `ClaimState` record so multiple cards can be in different states simultaneously

### Facility Staff Enrollment (house agency pattern)
- Each facility gets at most one "house agency" (`agencies.house_for_facility_id` FK, unique). Created lazily on first enrollment.
- House agency name: `{Facility Name} Staff` — auto-created by `POST /api/facility-staff/create`.
- On creation, an `agency_facility_connections` row is inserted (`agency_id: houseAgencyId, facility_id: facilityId, status: active`). This means the nurse page's existing facility lookup already works — no nurse page changes needed.
- `PATCH /api/staff/[nurseId]` and `DELETE /api/staff/[nurseId]` verify `facility_admin` ownership by checking that the `agencyId` in the request body belongs to a house agency with `house_for_facility_id = facilityAdmin.facility_id`.
- `NursysLookupForm` accepts either `agencyId` or `facilityId`. When `facilityId` is set, it uses `/api/facility-staff/create` and redirects to `/facility/[facilityId]/staff/[nurseId]`.
- `StaffRosterTable` accepts optional `facilityId` — row clicks go to `/facility/[facilityId]/staff/[nurseId]` when set.
- `NurseProfileClient` accepts optional `backHref` — back link and post-remove redirect use it; defaults to `/agency/${agencyId}/staff`.
- **No nurse-page changes needed**: enrolled nurses see only the connected facility's shifts because the house agency has exactly one `agency_facility_connections` row.

### NURSYS Integration (Phase 2)
- NURSYS e-Notify is a **monitoring service**, not a stateless lookup API
- CNA and CMA are **not in NURSYS** — manual entry only
- IV certification is **not a NURSYS field** — always manual or inferred (RN = always IV certified)
- No sandbox environment exists — test with real credentials carefully
- Auth is username/password with 90-day mandatory rotation

### Supabase Service Role / Admin Client
- `src/lib/supabase/admin.ts` — service-role client, bypasses RLS
- **Use in API routes AND server components** when RLS would block the query. The rule: if auth is already validated at the layout level (role check passed), using admin client in server components is safe for read operations.
- **When to use admin client in server components:** Any query involving nested joins across multiple tables (e.g. `agency_nurse_relationships → nurse_profiles → profiles`). The user client silently returns null through complex RLS chains even when the user is authenticated.
- **User client is reliable for:** Simple single-table selects on tables with basic RLS (e.g. `supabase.from('agency_admins').select('agency_id').eq('profile_id', user.id)`)
- **Pattern:** Server page verifies auth + ownership with user client, then uses admin client for all data fetching

### Credential Alerts / TB Date
- `tb_test_date` is the real column on `nurse_profiles` (not `tb_expiration`)
- TB expiry is derived: `tb_test_date + 1 year` — compute this in application code, not via DB column
- The credential alert query (agency dashboard) uses `tbAlertCutoff = today - 335 days` to find nurses whose TB test is due within 30 days; `tbPipelineStr = today - 275 days` for the 31–90 day pipeline bucket
- Credential alerts are split client-side with `alertIsUrgent()` (any date ≤30 days out) — one DB query, two display buckets
- **Gotcha:** Using a non-existent column name in `.or()` causes PostgREST to reject the entire query silently — data returns null with no JS error. Always verify column names against the schema.

### Notification Preferences
- `notification_preferences` table uses `preferences JSONB` — schema is `{ eventType: { channel: boolean } }` (e.g. `{ shift_confirmed: { email: false } }`)
- Default is **opt-out model**: if no row exists for a profile, all channels are allowed. A missing key in the JSONB also means allowed — only explicit `false` skips the channel.
- `checkPreferences()` in `dispatch.ts` is called before the DB insert — items opted out are removed from the array entirely, so no notification row is written for skipped channels
- `NotificationPreferencesForm` loads defaults from `buildDefaultPrefs()` then merges loaded prefs on top — safe against new event types being added after a user saved preferences
- Agency and facility admins have `['in_app', 'email']` channels; nurses have `['in_app', 'email', 'sms']`

### Claim Approval Workflow
- `agency_review` is a new `shift_claims.status` value — the column is TEXT but has a CHECK constraint (`shift_claims_status_check` from 001) listing allowed values; migration `005_claim_status_agency_review.sql` widens it to include `agency_review` and **must be run** or claims fail with Postgres error 23514 whenever `require_claim_approval` is on. Existing filters that use `.in('status', ['pending', 'confirmed'])` already exclude it without changes. Any future new status value needs the same constraint widening.
- When `require_claim_approval = true`: claim inserts as `agency_review`, shift stays `open` (not transitioning to `claimed`), only agency admin is notified. The facility claims page query already excludes `agency_review` claims — no change needed there.
- The coordinator confirm/decline email for placeholder shifts lives in `lib/notifications/coordinator-email.ts` (`sendCoordinatorConfirmEmail`). With approval off, the claim route sends it at claim time; with approval on, the claim route skips it and `agency-approve` sends it after the agency admin approves. Real-facility shifts never get this email — the facility admin gets an in-app notification instead (at claim time or approve time respectively).
- `agency-approve` re-runs the double-booking check because the nurse may have confirmed another shift between claiming and agency review
- `agency-approve` writes `agency_approved_at` and `agency_approved_by` to the claim row for audit trail
- The "Needs Your Approval" section in the agency dashboard is optimistic — approved/rejected claims are removed from local state immediately without re-fetching
- Re-activated `withdrawn` claims (nurse re-claims) also respect `require_claim_approval` — the `claimStatus` variable is computed before the existing-claim check and used for both paths

### Agency Profile
- `agencies.display_name` is the public-facing name; `agencies.name` is the internal account name set at signup. All outbound communications use `display_name ?? name` so the fallback is always safe.
- The profile form is on the agency settings page (not a separate page) — no new route needed
- Logo URL is a plain text input — no upload handling; agencies must host images externally

### Fill Rate
- Formula: `confirmed / (total - canceled)` — canceled shifts are excluded from both numerator and denominator
- Computed entirely in JS on the server page using `computeFillRate()` helper — no DB-side aggregation
- Prior month query runs in parallel with current month via `Promise.all`; credential breakdown covers all 5 credential types, filtered to those with any activity

### Shift Needs Outreach Email
- Target audience is **off-platform agencies only** — connected agencies already see shifts in their calendar; this feature is for acquisition/outreach
- `POST /api/shifts/outreach-email` calls `sendEmail()` directly, NOT `dispatchNotifications()` — outbound marketing emails don't belong in the `notifications` table (no in-app event, no opt-out preference, no Twilio webhook tracking needed)
- The modal preview is built **client-side** from the shifts already loaded in `ShiftCalendarView` state — no extra fetch needed for preview. The API re-fetches server-side on send to ensure the email reflects the actual DB state (not stale client state)
- `ShiftCalendarView` now requires `facilityName` prop — the shifts page fetches it via a parallel `facilities.select('name')` query alongside the existing shift configs and shifts queries
- Tier badge display in email: tier 1 = no badge (standard), tier 2 = ★ Priority (amber #D97706), tier 3 = ★★ Urgent (red #DC2626) — row background also tinted (amber/red) to reinforce urgency
- Email credentials grouped in fixed order: CNA → CMA → LPN → LPN_IV → RN; credential groups with zero open shifts are omitted
- `NEXT_PUBLIC_SITE_URL` used for the "Claim These Shifts on ShiftBridge →" CTA — falls back to `http://localhost:3000/signup` in dev
- **TODO:** Once the landing page (`public/landing.html`) is finalized and connected at a route, update the CTA in `buildEmailHtml()` (`src/app/api/shifts/outreach-email/route.ts`) to point to the landing page (`${siteUrl}/`) instead of `/signup` — the landing page is a better first impression for off-platform agencies who have never heard of ShiftBridge

### Saved Outreach Contacts + CTA Tracking
- `facility_outreach_contacts` uses UNIQUE(`facility_id, email`) — `POST /api/outreach-contacts` upserts on conflict to update `last_used_at`; safe to call multiple times for the same address
- `platform_outreach_sent_at` column exists but is never written by current code — reserved for future super admin one-time invite feature; do not use until that feature is built and disclosure/consent approach is decided
- `GET /api/track/cta` is fully public (`/api/track` in `PUBLIC_ROUTES`) — no auth, coordinators are not logged in; tracking failure is always silent; redirect fires regardless
- `cta_events` does not track IP addresses — deliberately kept minimal; extend schema if deeper analytics are needed later
- `ShiftOutreachModal` loads saved contacts on mount with a `useEffect`; contacts failure is silent (contactsLoading flips false, empty list shown, compose step works normally)
- If a new email typed in the chip input matches an existing saved contact, it gets checked rather than creating a duplicate chip — dedup happens in `addEmail()`
- Recipients = `new Set([...checkedContacts, ...newEmails])` — deduped automatically; this is what gets sent to the API and upserted to contacts after send
- Removing a contact from the modal calls `DELETE /api/outreach-contacts/[id]` immediately (fire-and-forget) and removes from local state — no confirmation prompt
- `GET /api/track/cta` accepts `fid` (facility UUID) and `tid` (token string, not UUID) — route resolves the token string to `placeholder_confirm_tokens.id` via a lookup; `fid` is validated to be a real facility before inserting

### Clickable Notification Bell
- `NotificationBell` receives `role` and `entityId` from its layout — the component itself is role-agnostic; the routing logic is entirely in `getNotificationHref()` inside the component file
- `entityId` is the agencyId or facilityId already fetched by the layout for nav link construction — no new DB query needed in any layout
- Nurse routes have no entity segment in the URL, so nurse layout passes `role="nurse"` only (no entityId); all nurse destinations are static paths (`/nurse`, `/nurse/schedule`)
- Non-navigable event types (e.g. `credential_expiring`, `shift_filled` for agency admin) return `null` from `getNotificationHref` — click still marks read but does not navigate or close the dropdown

### Demo Mode
- Demo users have `role: 'demo'` in `auth.users.raw_app_meta_data` but `role: 'agency_admin'` in `profiles` — the `profiles.role` column has a CHECK constraint that only allows real roles (`agency_admin`, `facility_admin`, `nurse`, `super_admin`). The actual demo role lives only in app_metadata (JWT), read by middleware and layouts.
- `agency_admins` row IS created for the demo user — this is required for `get_my_agency_id()` SQL function (used in RLS policies) to return the correct agency for client-side shift queries when the demo user navigates months in `AgencyShiftsClient`.
- Roster nurse auth users are real Supabase auth accounts (`admin.auth.admin.createUser()`) — fake UUIDs can't be used because `profiles.id` has a FK → `auth.users(id)`. These accounts have random passwords nobody knows; they exist only for FK integrity.
- Per-session random suffix on license numbers (`Math.floor(10000 + Math.random() * 90000)`) — the `(license_number, license_state)` pair has a UNIQUE constraint; concurrent demo sessions would collide without it.
- `export { default }` re-export pattern for demo page wrappers — works cleanly because real page components only check `if (!user) redirect('/login')`, not the role. The `(demo)/layout.tsx` enforces `role === 'demo'`. **Exception:** some agency pages (`shifts/page.tsx`, `facilities/page.tsx`) had explicit `role !== 'agency_admin'` checks — these needed patching to also allow `isDemoUser(user)`.
- Demo page ownership check — pages with an `agency_admins` DB ownership check use `user.app_metadata?.agency_id` instead when `isDemoUser(user)` is true. Same pattern applies to any future page that adds an ownership check via a DB join.
- `isDemoUser()` is the single gate — import from `@/lib/demo/context` in any API route or page that needs to allow demo access. The check is `user?.app_metadata?.role === 'demo'`.
- RLS works for demo users because: `get_my_role()` reads `profiles.role` (= `'agency_admin'`), `get_my_agency_id()` reads `agency_admins` (row created during session setup). Client-side queries (month navigation in `AgencyShiftsClient`) go through RLS and work correctly for demo users.
- Demo sessions expire in 4 hours — cleanup route removes all data in the correct FK dependency order. The `demo_sessions` table stores `nurse_profile_ids` array so the cleanup route knows which roster nurse auth users to delete (cascade from `auth.users` to `profiles` happens automatically on auth user delete, but roster nurses need explicit `admin.auth.admin.deleteUser()` calls since they're separate auth accounts).
- `(admin as any)` cast used for all `demo_sessions` queries — table not in generated TypeScript types until migration runs; add eslint-disable comment inline.

### Facility Notes for Nurses
- `facility_notes` lives on the `facilities` and `placeholder_facilities` tables — it is facility-level context (parking, entry, patient load) that applies to every shift posted there, distinct from `shifts.notes` which is per-posting
- Facility admins edit notes on their settings page via `PATCH /api/settings/facility-profile`; agency admins edit placeholder facility notes inline on the placeholder detail page via the existing `PATCH /api/placeholders/[placeholderId]`
- Nurse page fetches `facility_notes` as part of the joined `facilities(...)` and `placeholder_facilities(...)` select — no extra query needed
- `ShiftCard` renders a teal-tinted "Facility Info" box above the gray "Special Requirements" box; both are hidden once a shift is claimed (claimStatus === 'claimed')
- The placeholder detail server page uses `.select('*')` so `facility_notes` is returned automatically once the column exists — no server page change needed

---

## Pending RLS Migrations (must run in Supabase SQL Editor)

These two policies are needed for the nurse shift discovery page to show full data. Without them, facility names and tier configs will be missing (graceful fallback exists, but data will be incomplete).

```sql
-- Allow nurses to read active facility names (for ShiftCard display)
CREATE POLICY "nurse_reads_active_facilities" ON facilities
FOR SELECT USING (status = 'active');

-- Allow nurses to read pay tier configs for agencies they belong to
CREATE POLICY "nurse_reads_own_agency_tiers" ON pay_tier_configs
FOR SELECT USING (
  agency_id IN (
    SELECT agency_id FROM agency_nurse_relationships
    WHERE nurse_profile_id = get_my_nurse_profile_id()
      AND status = 'active'
  )
);
```

---

## File Structure (key files)

```
src/
  app/
    (auth)/login/page.tsx                             — login form + "Launch Interactive Demo" button
    (admin)/layout.tsx
    (admin)/admin/page.tsx
    (agency)/layout.tsx
    (agency)/agency/page.tsx                          — redirects to /agency/[agencyId]
    (agency)/agency/[agencyId]/page.tsx               — agency dashboard
    (agency)/agency/[agencyId]/staff/page.tsx
    (agency)/agency/[agencyId]/staff/new/page.tsx
    (agency)/agency/[agencyId]/staff/[nurseId]/page.tsx
    (agency)/agency/[agencyId]/staff/[nurseId]/NurseProfileClient.tsx — 4-section editable nurse profile
    (agency)/agency/[agencyId]/shifts/page.tsx          — agency unified shift calendar (admin client, read-only)
    (agency)/agency/[agencyId]/shifts/AgencyShiftsClient.tsx — read-only calendar; dropdown filter (Connected/Placeholder optgroups)
    (agency)/agency/[agencyId]/facilities/page.tsx       — placeholder + connected facilities (rows clickable)
    (agency)/agency/[agencyId]/facilities/FacilitiesClient.tsx — client add/list placeholders
    (agency)/agency/[agencyId]/facilities/[facilityId]/page.tsx — connected facility info + shift calendar
    (agency)/agency/[agencyId]/facilities/placeholder/[placeholderId]/page.tsx — placeholder detail
    (agency)/agency/[agencyId]/facilities/placeholder/[placeholderId]/PlaceholderFacilityDetailClient.tsx — editable placeholder info + calendar
    (agency)/agency/[agencyId]/settings/page.tsx         — agency profile + claim approval toggle + pay tier config + notification preferences
    confirm/[token]/page.tsx                             — coordinator one-click confirm (public); fetches nurse info from pending claim
    confirm/[token]/ConfirmTokenClient.tsx               — confirm UI: shift details + nurse info + Confirm / Decline buttons
    decline/[token]/page.tsx                             — coordinator one-click decline (public); fetches nurse info from pending claim
    decline/[token]/DeclineTokenClient.tsx               — decline UI: shift details + nurse info + "Yes, Decline" / "Confirm Instead" buttons
    (facility)/layout.tsx
    (facility)/facility/page.tsx                      — redirects to /facility/[facilityId]
    (facility)/facility/[facilityId]/page.tsx         — facility dashboard
    (facility)/facility/[facilityId]/shifts/page.tsx  — shift calendar
    (facility)/facility/[facilityId]/claims/page.tsx  — claim review queue
    (facility)/facility/[facilityId]/staff/page.tsx     — facility staff roster (queries house agency nurses)
    (facility)/facility/[facilityId]/staff/new/page.tsx — enroll staff form
    (facility)/facility/[facilityId]/staff/[nurseId]/page.tsx — nurse profile (reuses NurseProfileClient with house agency ID)
    (facility)/facility/[facilityId]/settings/page.tsx — shift config setup + notification preferences
    (nurse)/layout.tsx
    (nurse)/nurse/page.tsx                            — available shifts
    (nurse)/nurse/schedule/page.tsx                   — server: fetches claims, passes to NurseScheduleClient
    (nurse)/nurse/schedule/NurseScheduleClient.tsx    — client: next 3 confirmed cards + interactive month calendar; day panel renders to the right
    (nurse)/nurse/settings/page.tsx                   — nurse notification preferences
    api/nursys/lookup/route.ts
    api/staff/create/route.ts
    api/settings/pay-tiers/route.ts
    api/settings/shift-configs/route.ts               — delete+insert shift configs
    api/shifts/route.ts                               — POST create shifts
    api/shifts/[id]/route.ts                          — PATCH tier on open shifts
    api/shifts/claim/route.ts                         — POST claim with double-booking check
    api/shifts/confirm/route.ts                       — POST confirm claim + reject others
    api/shifts/cancel/route.ts                        — POST cancel shift; `final: true` → status 'canceled'; omitted → status 'open' (reopen); facility_admin or agency_admin (placeholder only)
    api/dnr/route.ts                                  — POST issue DNR (cancels future shifts); DELETE remove DNR record (undo)
    api/notifications/send/route.ts                   — POST dispatch (super_admin / cron use)
    api/webhooks/twilio/route.ts                      — delivery receipt handler
    api/placeholders/route.ts                         — GET list + POST create placeholder facility
    api/placeholders/connect/route.ts                 — POST send connection request (agency admin)
    api/placeholders/accept/route.ts                  — POST accept connection request (facility admin)
    api/placeholders/decline/route.ts                 — POST decline connection request (facility admin)
    api/shifts/placeholder/route.ts                   — POST create placeholder shifts (agency admin); accepts notes
    api/shifts/outreach-email/route.ts                — POST send shift needs email to off-platform agencies (facility_admin); builds HTML email + sends via Resend directly; CTA routes through /api/track/cta
    api/outreach-contacts/route.ts                    — GET list saved contacts (facility_admin); POST upsert contact with last_used_at
    api/outreach-contacts/[id]/route.ts               — DELETE remove saved contact (facility_admin; verifies ownership)
    api/track/cta/route.ts                            — GET public CTA click tracker; logs to cta_events then 302-redirects; tid=token string, fid=facilityId
    api/shifts/agency-approve/route.ts                — POST agency_admin approves agency_review claim → pending; re-runs double-booking check; notifies facility
    api/shifts/agency-reject/route.ts                 — POST agency_admin rejects agency_review claim → rejected; notifies nurse in-app
    api/agency/[agencyId]/settings/route.ts           — PATCH update require_claim_approval (agency_admin only)
    api/settings/agency-profile/route.ts              — PATCH update display_name, contact_email, bio, logo_url (agency_admin only)
    api/notifications/preferences/route.ts            — GET fetch preferences; PUT upsert preferences (any authenticated user)
    api/confirm-token/route.ts                        — POST validate + consume coordinator token (confirms shift)
    api/decline-token/route.ts                        — POST validate + consume coordinator token (declines claim, reopens shift)
    api/shifts/placeholder-confirm/route.ts           — POST agency_admin confirm or decline a claimed placeholder shift directly (no token)
    api/notifications/mass-text/route.ts              — POST bulk SMS + in-app to nurses by credential (agency admin)
    api/shifts/export/route.ts                        — GET CSV download for agency shifts by month
    api/settings/bill-rate/route.ts                   — POST save bill_rate on agency_facility_connections (facility admin)
    api/admin/accounts/route.ts                       — PATCH suspend/activate/reset_password (super_admin)
    api/staff/[nurseId]/route.ts                      — PATCH update nurse info by section; DELETE deactivate (agency_admin or facility_admin for house agency nurses)
    api/facility-staff/create/route.ts                — POST enroll nurse into facility house agency; creates house agency + connection on first enrollment
    api/placeholders/[placeholderId]/route.ts         — PATCH update placeholder facility info (agency admin); DELETE remove placeholder + cascade shifts/requests (blocked when connected)
    api/seed/route.ts                                 — POST seed 3 facilities + 5 test nurses + shifts (super_admin only, idempotent)
    api/auth/callback/route.ts
    (admin)/admin/seed/page.tsx                       — UI for running seed route
    (demo)/layout.tsx                                 — demo auth guard (role=demo) + DemoSidebarNav with agencyId/facilityId/expiresAt from app_metadata/demo_sessions
    (demo)/demo/page.tsx                              — redirects to /demo/agency/[agencyId]
    (demo)/demo/agency/[agencyId]/page.tsx            — re-exports agency dashboard
    (demo)/demo/agency/[agencyId]/staff/page.tsx      — re-exports agency staff
    (demo)/demo/agency/[agencyId]/shifts/page.tsx     — re-exports agency shifts
    (demo)/demo/agency/[agencyId]/facilities/page.tsx — re-exports agency facilities
    (demo)/demo/agency/[agencyId]/settings/page.tsx   — re-exports agency settings
    (demo)/demo/facility/[facilityId]/page.tsx        — re-exports facility dashboard
    (demo)/demo/facility/[facilityId]/shifts/page.tsx — re-exports facility shifts
    (demo)/demo/facility/[facilityId]/claims/page.tsx — re-exports facility claims
    (demo)/demo/facility/[facilityId]/staff/page.tsx  — re-exports facility staff
    (demo)/demo/facility/[facilityId]/settings/page.tsx — re-exports facility settings
    (demo)/demo/nurse/page.tsx                        — re-exports nurse available shifts
    (demo)/demo/nurse/schedule/page.tsx               — re-exports nurse schedule
    api/demo/launch/route.ts                          — POST public; rate-limits at 20; seeds full demo environment; returns {email, password}
    api/demo/cleanup/route.ts                         — POST super_admin; cleans expired (or all with ?force=true) demo sessions in FK dependency order
  lib/demo/
    context.ts                                        — isDemoUser(user) helper
  components/layout/
    DemoSidebarNav.tsx                                — three-section nav (Agency Admin/Facility Admin/Nurse) with countdown timer
  app/(agency)/agency/[agencyId]/
    AgencyDashboardClient.tsx                         — shift tabs, financial snapshot, credential alerts (two-tab 30/90d), open needs, staff activity (with cancel/late-cancel %), fill rate widget, "Needs Your Approval" queue, CSV/mass-text buttons
    shifts/AgencyShiftsClient.tsx                     — read-only agency calendar, fetches via admin client on month nav, dropdown filter
  app/(facility)/facility/[facilityId]/
    FacilityDashboardClient.tsx                       — agency overview table with editable bill rates + fill rate widget
  app/(admin)/admin/
    AdminDashboardClient.tsx                          — accounts CRUD + agency-facility connection matrix
  components/
    calendar/
      ShiftCalendar.tsx                               — month grid
      ShiftDayPanel.tsx                               — day detail + tier editing + post form + notes display + inline cancel (✕ → confirm bar) for all shift statuses
      ShiftCalendarView.tsx                           — client wrapper (state + realtime); handles onShiftCanceled → status 'canceled'; "Send Shift Needs Email" button wires ShiftOutreachModal; accepts facilityName prop
      AgencyShiftCalendarView.tsx                     — agency calendar (real + placeholder shifts); handles onShiftCanceled / onShiftConfirmed / onShiftReopened callbacks
      AgencyShiftDayPanel.tsx                         — agency day panel + placeholder shift posting + notes display + inline cancel + confirm/decline for claimed placeholder shifts; fetches nurse info lazily on mount
    notifications/
      NotificationBell.tsx                            — bell + unread badge + dropdown
      NotificationPreferencesForm.tsx                 — checkbox grid (event types × channels); loads/saves via preferences API
    layout/
      SidebarNav.tsx                                  — dark navy sidebar, SVG icons, active link, user footer, NotificationBell slot
    shifts/
      ShiftPostForm.tsx                               — credential/slot/quantity/tier/notes form
      ShiftCard.tsx                                   — nurse-facing shift display; notes callout above claim button
      NurseShiftList.tsx                              — calendar-first UI: month grid, day panel, dropdown filter, list/calendar toggle, claim flow
      CredentialCard.tsx                              — facility-facing nurse credentials (no address/pay)
      ShiftClaimQueue.tsx                             — claim review queue per shift; DNR confirmation modal + undo; accepts dnrNurseIds prop for server-initialized state
    agency/
      AgencyProfileForm.tsx                           — display name, contact email, bio, logo URL form; saves via agency-profile API
      ClaimApprovalToggle.tsx                         — toggle switch for require_claim_approval; saves via agency/[agencyId]/settings API
    facility/
      RepeatNurseTable.tsx                            — nurse name, credential, shifts completed, most recent date; null when empty
      ShiftOutreachModal.tsx                          — 3-step modal (Compose→Preview→Done) for sending shift needs email to off-platform agencies; email chip input, live preview from calendar state, sends via /api/shifts/outreach-email
    placeholders/
      PlaceholderFacilityForm.tsx                     — add placeholder facility form
      PlaceholderShiftForm.tsx                        — post placeholder shift; Save + Add Another; includes notes field
      AddressMatchAlert.tsx                           — shown when match_detected; send connection request inline
      ConnectionRequestModal.tsx                      — facility-side accept/decline modal with shift count warning
    staff/
      StaffRosterTable.tsx
      NursysLookupForm.tsx
    settings/
      PayTierForm.tsx
      ShiftConfigForm.tsx
  hooks/
    useRealtimeShifts.ts                              — Supabase postgres_changes, cbRef pattern
    useDoubleBookingCheck.ts                          — client pre-check, stable via useCallback
    useNotifications.ts                               — realtime INSERT subscription + markRead
    useDriveTime.ts                                   — batch facility drive times, sessionStorage cache
  lib/
    twilio/client.ts                                  — sendSms() — skips if env vars absent
    resend/client.ts                                  — sendEmail() — skips if env vars absent
    notifications/dispatch.ts                         — dispatchNotifications() — checks notification preferences first, filters opted-out channels, then writes to DB
    notifications/coordinator-email.ts                — sendCoordinatorConfirmEmail() — shared coordinator confirm/decline email for placeholder shifts; creates token + sends email; called by claim route (approval off) and agency-approve route (approval on); never throws
  lib/supabase/
    client.ts / server.ts / admin.ts / types.ts
  lib/google-maps/
    drive-time.ts                                     — getDriveTimes() — Distance Matrix wrapper; skips if no API key
  lib/utils/
    address.ts                                        — normalizeAddress() — shared by placeholders API + Phase 10 trigger
    pay.ts                                            — calculateEffectivePay, calculateTotalShiftPay, tierLabel
  types/roles.ts
  middleware.ts
supabase/migrations/
  001_initial_schema.sql
  002_phase10_address_matching.sql
  003_feature_additions.sql                           — notes on shifts; agency profile columns; require_claim_approval; agency_approved_at/by on shift_claims; notification_preferences table
  003_connection_improvements.sql                     — connection_requests.initiated_by_role; facility-initiated RLS policies; accept_connection RPC v2 (migrates confirmed placeholder shifts)
  004_outreach_tracking.sql                           — facility_outreach_contacts table; cta_events table
  004_nurse_drive_times.sql                           — nurse_drive_times cache table + RLS
  005_claim_status_agency_review.sql                  — widens shift_claims_status_check to allow 'agency_review' (required for claim approval workflow)
  006_schema_catchup.sql                              — records dashboard-only changes (placeholder lat/lng, house_for_facility_id, facility_notes) + REBUILDS demo_sessions to the shape demo launch expects (must run; live table had an old incompatible shape)
  007_address_only_match.sql                          — redefines detect_placeholder_match() to match on address_normalized alone (drops the facility_type equality requirement); must run for connection matching to work — see Address Matching & Connections notes
```

---

## Phase Dependency Reference

```
Phase 1 (Foundation) ✅
  ├─► Phase 2 (NURSYS / Nurse Profiles) ✅
  │     └─► Phase 3 (Pay Tiers) ✅
  │     └─► Phase 9 (Placeholder Facilities) ✅
  │           └─► Phase 10 (Address Matching) ✅
  ├─► Phase 4 (Shift Config Setup) ✅
  │     └─► Phase 5 (Shift Posting) ✅
  │           └─► Phase 6 (Nurse Claiming) ✅
  │                 └─► Phase 7 (Claim Review) ✅
  │                       ├─► Phase 8 (Notifications) ✅
  │                       ├─► Phase 11 (DNR) ✅
  │                       ├─► Phase 12 (Drive Time) ✅
  │                       └─► Phase 13 (Dashboards + CSV + Mass Text) ✅
  │                             ├─► Frontend Redesign ✅
  │                             └─► Phase 14 (Demo + Analytics + Onboarding)
```

---

## Test Accounts (already in DB)

| Email | Password | Role |
|-------|----------|------|
| derrickjagneaux@gmail.com | (existing) | super_admin |
| agency@test.com | TestPass123! | agency_admin → Sunrise Staffing |
| facility@test.com | TestPass123! | facility_admin → Oakwood Care Center |


**Important:** After running SQL to set `raw_app_meta_data`, users must log out and back in to get a fresh JWT with the role.

---

## Pre-Production Checklist
Things that must be done before real businesses can use ShiftBridge. Not needed for testing.

### Email
- [ ] Verify a custom domain in Resend (e.g. `shiftbridge.io`) and update `RESEND_FROM_ADDRESS` to a real sender address
- [ ] Remove `RESEND_DEV_OVERRIDE_EMAIL` from `.env` — emails must go to real recipients
- [ ] Build proper HTML email templates (currently bare `<p>` tag emails)
- [ ] Add email for facility admin when a shift is confirmed (currently in-app only)
- [ ] Add email for agency admin when connection request is accepted/declined

### Auth & Accounts
- [ ] Email verification on signup — currently `email_confirm: true` auto-confirms; real users should verify their email
- [ ] Add terms of service + privacy policy checkbox to signup form
- [ ] Consider super admin approval flow for new agency/facility signups (or at least a review queue)
- [ ] Password reset flow tested end-to-end with real email delivery
- [ ] Session timeout / inactivity handling

### Security
- [ ] Restrict Google Maps API key to production domain in Google Cloud Console (currently unrestricted)
- [ ] Rate limiting on `/api/auth/signup` and other public endpoints to prevent spam accounts
- [ ] Review all API routes for authorization gaps
- [ ] Set `NEXT_PUBLIC_SITE_URL` to production domain (currently falls back to `localhost:3000` — breaks confirm email links)

### Infrastructure
- [ ] Set up production Supabase project (currently using dev project with test data)
- [ ] Configure Twilio for SMS notifications (currently unconfigured — SMS silently skipped)
- [ ] Set up error monitoring (e.g. Sentry) — currently errors only log to console
- [ ] Set up production environment variables (separate from dev `.env.local`)

### Features / UX
- [ ] Overnight shift support — current double-booking check breaks for shifts where `end_time < start_time`
- [ ] Timezone handling — cancel 12h threshold assumes server and facility are in same timezone
- [ ] Address autocomplete on remaining address fields (Enroll Staff home address, Placeholder facility edit form)
- [ ] Proper email templates (styled, branded)
- [ ] Onboarding flow / walkthrough for new agencies and facilities after signup
- [ ] Super admin UI to manage/approve new signups

### Before go-live
- [ ] Run full end-to-end test with real email addresses across all four roles
- [ ] Confirm `detect_placeholder_match` trigger fires correctly on real facility inserts
- [ ] Verify NURSYS integration with real credentials (RN/LPN only; CNA/CMA always manual)
- [ ] Load test shift claiming with concurrent claims on same shift

---

## Known Issues / Watch Out For
- Supabase CLI not installed locally (Docker issues on this machine) — use hosted Supabase dashboard for SQL migrations
- Run migrations by pasting SQL into Supabase Dashboard → SQL Editor
- The `middleware` file convention deprecation warning is cosmetic — not blocking anything
- Supabase JS `.in()` does NOT accept subquery builders — always resolve to an array first with a separate query
- Supabase JS joined-table filters (e.g. `.eq('shifts.shift_date', x)`) are unreliable — do a separate query instead and filter in JS (same reason as `.in()` above)
- `staffCount` with `{ count: 'exact', head: true }` returns count on the response object, not on `data` — use the relationships array length instead
- Overnight shifts (end_time < start_time) are not handled by the current `timesOverlap` check — the simple string comparison `s1 < e2 && s2 < e1` only works for same-day shifts
- **Non-existent column in `.or()` silently kills the whole query** — PostgREST returns null data with no JS error. Example: `.or('tb_expiration.lte.X')` with a non-existent column → entire query returns null. Always verify column names.
- `tb_test_date` is the real column (not `tb_expiration`) — derive expiry as `tb_test_date + 1 year` in code
- **Demo page role checks**: Most real page components only do `if (!user)` and rely on the layout for role enforcement — demo re-exports work transparently. The exceptions are pages with explicit `role !== 'agency_admin'` guards in the page component itself (not just the layout): `(agency)/agency/[agencyId]/shifts/page.tsx` and `(agency)/agency/[agencyId]/facilities/page.tsx`. Both are fixed to also allow `isDemoUser(user)`. If you add a new page that a demo wrapper re-exports and it has an explicit role check, apply the same pattern: `if (!user || (role !== 'X' && !isDemoUser(user)))`.
- **`demo_sessions` TypeScript**: The `demo_sessions` table IS now in `src/lib/supabase/types.ts` (correct shape: auth_user_id, agency_id, facility_id, nurse_profile_ids, expires_at). Existing `(admin as any)` casts in the demo routes are harmless but no longer necessary for new code.
- **types.ts is hand-maintained** (no Supabase CLI on this machine) — any column/table added via the Dashboard SQL Editor MUST also be added to `src/lib/supabase/types.ts` AND recorded in a migration file, or `npm run build` breaks later with dozens of cascade type errors (this happened with initiated_by_role, house_for_facility_id, nurse_drive_times, facility_outreach_contacts, cta_events, placeholder lat/lng — all fixed 2026-07-06).
- **`npm run build` / `npx tsc` may crash intermittently on this machine** with exit code -1073741819 (0xC0000005 access violation) at random phases — it's a local Node/Windows instability under heavy parallel load, not a code error. Retry the command; it typically succeeds within a couple of attempts.
- **Seed nurses**: Run `POST /api/seed` as super_admin once to populate 3 facilities + 5 test nurses + shifts. The seed page is at `/admin/seed`. It is idempotent and safe to re-run.
- **Nurse page RLS**: All queries on `/nurse/page.tsx` must use admin client — `agency_nurse_relationships`, `nurse_profiles`, `shift_claims`, `agency_facility_connections` all fail silently with user client due to RLS chain complexity. Auth is validated at layout level, so admin client is safe here.
- **NotificationBell dark variant positioning**: The bell sits near the left edge of the 252px sidebar. The dropdown is 320px wide. Using `right: 0` (align dropdown's right edge to button's right edge) pushes the panel ~68px off the left of the screen. Fix: dark variant uses `position: fixed` with `getBoundingClientRect()` so it escapes `overflow: hidden` on the sidebar entirely; anchors bottom edge above the button and opens to the right.
- **AddressAutocompleteInput dropdown**: Uses `position: fixed` with coordinates from `getBoundingClientRect()` + a `useLayoutEffect` that repositions on scroll/resize. This ensures the dropdown is never clipped by any `overflow: hidden` or `overflow: auto` ancestor (e.g. scrollable auth layout, sidebar). Always use fixed positioning for floating UI elements that live inside overflow-constrained containers.
- **Auth layout right panel**: Changed from `flex items-center justify-center` (no scroll) to `overflow-y-auto flex flex-col` with `my-auto` on the inner wrapper. Short forms (login) stay centered; long forms (facility signup) scroll correctly.
- **Middleware PUBLIC_ROUTES gotcha**: The `pathname.startsWith('/api')` bypass on line 72 of `middleware.ts` only runs AFTER the `if (!user) redirect('/login')` check — meaning unauthenticated users can NEVER reach any API route unless it's explicitly in `PUBLIC_ROUTES`. Current public API routes: `/api/auth` (signup + callback), `/api/places` (autocomplete, used on public signup form), `/api/confirm-token` (coordinator confirm, no login required). If you add any API route that must be callable without auth, add it to `PUBLIC_ROUTES` at the top of middleware.ts.
