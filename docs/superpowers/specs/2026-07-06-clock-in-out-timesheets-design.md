# Clock In/Out & Timesheets — Design Spec

**Date:** 2026-07-06
**Status:** Approved by Derrick (design review 2026-07-06). Implementation blocked until the repo is set up in GitHub and the current version is saved.

---

## Context

ShiftBridge currently tracks only *scheduled* hours. Once a shift is confirmed, there is no record of whether the nurse actually showed up, when they arrived, or when they left. The CSV export and the agency dashboard financial snapshot both compute pay from scheduled `start_time`/`end_time`, which doesn't reflect reality.

This feature adds facility-verified time tracking:

- Nurses (CNA/CMA/LPN/RN) clock in and out **through their confirmed shift card/calendar** on My Schedule.
- Each punch is **signed by a facility contact** (name + title + drawn signature) who sees exactly what they're signing: "CLOCK IN — 6:58 AM".
- Nurses who forget to punch can **manually enter the time later** — still facility-signed, but flagged.
- Agency admins can **add or correct punches** for missed entries, see all timesheets on a new Timesheets page, and get actual hours in the CSV export and dashboard financials.
- Nurses get a dedicated **My Hours** page with weekly/monthly totals.

### Decisions made during design review

| Question | Decision |
|---|---|
| Signature form | **Drawn signature** — finger/mouse canvas, stored as image. Matches paper timesheet norms; strongest evidence in a dispute. |
| Manual (forgot-to-punch) entries | **Same signature flow** — facility contact sees the manually entered time and signs it. Entry flagged `manual`; no separate approval queue. The signature is the verification. |
| How actual hours are used | **Actual when available** — CSV export and dashboard financials use actual hours when a completed timesheet exists, scheduled hours otherwise. |
| Nurse hours view | **Dedicated page** at `/nurse/hours` with a new nav link. |
| Agency admin view | **New Timesheets page** at `/agency/[agencyId]/timesheets` with a new nav link. |
| Clock-in availability | Button appears **30 minutes before scheduled start** (revised down from 2 hours during review). |

---

## 1. Data model

New table `shift_timesheets` in `supabase/migrations/005_timesheets.sql`. Migration is run manually by pasting into **Supabase Dashboard → SQL Editor** (no CLI on this machine).

**One row per confirmed claim.** Timesheet state is derivable from which fields are filled: no row / empty → not started; `clock_in_time` set → clocked in; both set → complete.

```sql
CREATE TABLE shift_timesheets (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id               UUID        NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  claim_id               UUID        NOT NULL REFERENCES shift_claims(id) ON DELETE CASCADE,
  nurse_profile_id       UUID        NOT NULL REFERENCES nurse_profiles(id),
  agency_id              UUID        NOT NULL REFERENCES agencies(id),

  -- clock in
  clock_in_time          TIMESTAMPTZ,
  clock_in_recorded_at   TIMESTAMPTZ,
  clock_in_method        TEXT        CHECK (clock_in_method IN ('live','manual','admin')),
  clock_in_contact_name  TEXT,
  clock_in_contact_title TEXT,
  clock_in_signature     TEXT,        -- base64 PNG data URL

  -- clock out
  clock_out_time          TIMESTAMPTZ,
  clock_out_recorded_at   TIMESTAMPTZ,
  clock_out_method        TEXT        CHECK (clock_out_method IN ('live','manual','admin')),
  clock_out_contact_name  TEXT,
  clock_out_contact_title TEXT,
  clock_out_signature     TEXT,       -- base64 PNG data URL

  -- admin audit
  admin_edited_by        UUID        REFERENCES profiles(id),
  admin_edited_at        TIMESTAMPTZ,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(claim_id)
);
CREATE INDEX idx_ts_shift_id  ON shift_timesheets(shift_id);
CREATE INDEX idx_ts_nurse_id  ON shift_timesheets(nurse_profile_id);
CREATE INDEX idx_ts_agency_id ON shift_timesheets(agency_id);
```

Also add the table to `src/lib/supabase/types.ts` (Row/Insert/Update).

### Design choices

- **`TIMESTAMPTZ` for punches** — actual hours compute correctly across midnight (`clock_out_time - clock_in_time`), which the scheduled `TIME` columns cannot do. Overnight-shift *actual* hours work even though scheduled-hours math keeps its known limitation.
- **`method` encodes trust level:** `live` = server current time at punch; `manual` = nurse typed the time (still facility-signed); `admin` = agency admin entered it (no signature; audit-stamped via `admin_edited_by/at` instead).
- **`recorded_at` vs `time`:** `time` is the punch being attested; `recorded_at` is when the row was actually written. For `live` they're equal; for `manual`/`admin` the gap shows how late the entry was made.
- **Signature as data-URL TEXT** — a small canvas PNG is ~10–20KB base64. No storage bucket, no upload flow. List queries must **never select the signature columns**; only the signature-view modal fetches them.
- **No RLS; service-role only** — same pattern as the migration-004 tables (`facility_outreach_contacts`, `cta_events`). All access goes through API routes / server pages using the admin client, with auth validated at the route/layout level (established pattern — see "Nurse page RLS" in CLAUDE.md).

### Rejected alternatives

- **Punch event log** (one row per in/out event): free audit history, but every read needs punch-pairing logic and there is only ever one in + one out per shift. Complexity with no current payoff.
- **Columns on `shift_claims`:** no new table, but signature blobs would bloat a hot table that every dashboard queries.
- **Supabase Storage bucket for signatures:** cleaner at large scale, but adds bucket policies and an upload flow. YAGNI.

---

## 2. Nurse punch flow

Entry is **only** through the confirmed shift card / calendar day panel on My Schedule (`NurseScheduleClient.tsx`) — punches are always tied to a specific confirmed shift.

### Step 1 — details + contact

A **"Clock In"** button appears on a confirmed shift starting **30 minutes before scheduled start** (and remains available through the punch window below). Tapping opens a mobile-first modal (`ClockPunchModal`):

- Shift summary: facility, date, scheduled time, credential.
- **The time that will be registered** — live current time (ticking) by default, with an "I forgot to clock in — enter time manually" toggle that swaps in a time picker. Using the picker flags the punch `manual`.
- Inputs: **facility contact name** and **title** (both required).
- Button: **"Hand to facility contact"**.

### Step 2 — signature handoff

The screen flips to a view designed to be handed to the facility contact:

- Large header: **"CLOCK IN — 6:58 AM"** (or **"CLOCK OUT — 7:32 PM"**) — the event and the exact time being registered, per the requirement that the signer sees what they're signing.
- Nurse name + credential badge; contact name + title as entered.
- For clock-out: computed hours for the shift.
- `SignaturePad` canvas with a Clear button. Confirm is disabled until the pad has strokes.

### Step 3 — done

Confirmation state; card now shows **"Clocked in at 6:58 AM ✓"** plus a **"Clock Out"** button. Clock-out repeats steps 1–2.

### Rules

- Clock-in button visibility: `now >= shift start − 30 min`. The server enforces the same earliest bound: a clock-in whose **registered time** is more than 30 minutes before scheduled start is rejected (applies to live and manual punches alike).
- Clock-out requires an existing clock-in and must be strictly after it.
- No future times (5-minute grace for clock skew).
- Punches (live or manual) accepted until **48 hours after scheduled shift end** — covers "remembered the next morning" after a night shift. Beyond that, only the agency admin can add entries.
- Punches blocked on canceled shifts.
- Manual clock-out time earlier than clock-in time infers next-day date (overnight).
- Placeholder-facility shifts work identically — the timesheet hangs off the claim; facility display fields come from `placeholder_facilities`.
- Double-punch: `UNIQUE(claim_id)` + server checks → 409 if the punch already exists.

---

## 3. Nurse "My Hours" page — `/nurse/hours`

- New nav link **"My Hours"** in the nurse layout (`SidebarNav` links array), between My Schedule and Settings.
- Server page fetches the nurse's timesheets (last ~6 months) joined to shift/facility info via the admin client (nurse-page pattern) — **excluding signature columns**.
- `NurseHoursClient`: weekly + monthly totals at top; week-by-week list of rows — date, facility, clock in/out, hours, `Manual`/`Admin` badges.
- Past confirmed shifts with a missing punch render a warning row linking back to My Schedule to complete the punch flow.

---

## 4. Agency "Timesheets" page — `/agency/[agencyId]/timesheets`

- New nav link **"Timesheets"** in the agency layout, between Shifts and Facilities.
- Month picker (same pattern as the calendars). Initial month server-rendered; navigation via `GET /api/timesheets`.
- Table over every **confirmed** shift for the month (confirmed claims for this agency's nurses), one row each:
  - Nurse, facility, date, scheduled times.
  - Actual clock in/out, actual hours, variance (= actual hours − scheduled hours, shown signed, e.g. `+0.5h` / `−0.25h`).
  - Method badges (`Manual` / `Admin`).
  - **"✓ signed"** indicator → modal showing the drawn signature(s) + contact name/title (signature fetched lazily by timesheet id — this is the only place signatures are read).
  - Past shifts with missing punches show a warning + inline **Add/Edit** (opens a small form for date+time; saves as `admin` method).
- Dashboard staff-activity hours (`AgencyDashboardClient`) switch to actual-when-available.

---

## 5. API routes

All follow the existing patterns: auth via `createClient()`, role check with the `isDemoUser(user)` allowance, data access via `createAdminClient()`.

### `POST /api/timesheets/punch` — nurse (or demo)

Body: `{ claim_id, action: 'in' | 'out', time?: string, contact_name: string, contact_title: string, signature: string }`

- `time` omitted → server uses `now()`, method `live`. `time` present (ISO) → method `manual`.
- Validates: claim belongs to the caller's nurse profile; claim status `confirmed`; shift not canceled; contact name/title and signature present; window/order rules from §2; signature data-URL size cap (~100KB) to prevent abuse.
- Upserts the `shift_timesheets` row (insert on first punch, update for clock-out). 409 if that punch already exists.

### `POST /api/timesheets/admin-entry` — agency_admin (or demo)

Body: `{ claim_id, clock_in_time?: string, clock_out_time?: string }` (at least one)

- Verifies the claim's `agency_id` belongs to the caller (via `agency_admins`; demo users use `app_metadata.agency_id` per the demo pattern).
- Sets the given punch(es): method `admin`, `recorded_at = now()`, no signature/contact fields; stamps `admin_edited_by/at`.
- May overwrite an existing punch (correction) — original method is replaced by `admin`; `admin_edited_by/at` records who/when.
- Same ordering/no-future-time validation; **no 48-hour limit** for admins.

### `GET /api/timesheets?agencyId=X&month=YYYY-MM` — agency_admin (or demo)

- Ownership check like `GET /api/shifts/export`.
- Source set = **confirmed `shift_claims` where `agency_id = agencyId`** whose shift falls in the month (two-query pattern: claims first, then shifts by ID — covers real-facility and placeholder shifts alike). Each row carries shift + facility + nurse info and its timesheet if one exists (**excluding signature columns**) — rows without a timesheet are how the page knows a punch is missing.

### `GET /api/timesheets/[id]/signature` — agency_admin (or demo)

- Ownership check; returns the signature data-URLs + contact fields for one timesheet. Keeps blobs out of every list payload.

---

## 6. Reporting changes

### CSV export (`GET /api/shifts/export`)

- Fetch timesheets for the month's shifts (separate query by shift IDs — per the "no join-filter" rule in CLAUDE.md).
- New columns after `Hours`: **Clock In, Clock Out, Actual Hours, Hours Variance, Time Source, Facility Contact**.
  - Time Source: worst-of the two punch methods (`admin` > `manual` > `live`); blank if no timesheet.
  - Facility Contact: clock-in contact name (title in parens).
- **Total Pay uses Actual Hours when the timesheet is complete, scheduled hours otherwise.**

### Agency dashboard (`(agency)/agency/[agencyId]/page.tsx` + `AgencyDashboardClient`)

- Financial snapshot: same actual-when-available rule, so dashboard and export always agree.
- Staff activity table: hours column uses actual-when-available.

---

## 7. Components & files

| File | What |
|---|---|
| `supabase/migrations/005_timesheets.sql` | New table (run manually in SQL Editor) |
| `src/lib/supabase/types.ts` | Add `shift_timesheets` types |
| `src/components/timesheets/SignaturePad.tsx` | Vanilla canvas, pointer events, Clear, exports PNG data-URL (~100 lines, no library) |
| `src/components/timesheets/ClockPunchModal.tsx` | 3-step flow (details+contact → signature handoff → done); shared by in and out |
| `src/app/(nurse)/nurse/schedule/NurseScheduleClient.tsx` | Clock In/Out buttons on upcoming cards + day panel; punch state per claim |
| `src/app/(nurse)/nurse/schedule/page.tsx` | Fetch timesheets for the nurse's claims; pass down |
| `src/app/(nurse)/nurse/hours/page.tsx` + `NurseHoursClient.tsx` | My Hours page |
| `src/app/(agency)/agency/[agencyId]/timesheets/page.tsx` + `TimesheetsClient.tsx` | Agency Timesheets page |
| `src/app/api/timesheets/punch/route.ts` | Nurse punch |
| `src/app/api/timesheets/admin-entry/route.ts` | Admin add/correct |
| `src/app/api/timesheets/route.ts` | Month list for agency page |
| `src/app/api/timesheets/[id]/signature/route.ts` | Lazy signature fetch |
| `src/app/api/shifts/export/route.ts` | New CSV columns + actual-pay rule |
| `(agency)/.../page.tsx` + `AgencyDashboardClient.tsx` | Actual-when-available hours |
| Nurse + agency layouts | New nav links |
| `src/app/(demo)/demo/nurse/hours/page.tsx`, `src/app/(demo)/demo/agency/[agencyId]/timesheets/page.tsx` | Demo re-export wrappers |
| `src/components/layout/DemoSidebarNav.tsx` | Add the two links |

Demo cleanup route needs **no change** — `shift_timesheets` cascade-deletes with `shift_claims`/`shifts`.

---

## 8. Error handling summary

| Case | Behavior |
|---|---|
| Clock-out with no clock-in | 400 — UI never offers it, server enforces anyway |
| Clock-out ≤ clock-in | 400 |
| Future time (> 5 min ahead) | 400 |
| Punch on canceled shift | 400 |
| Punch > 48h after shift end | 403 with message directing nurse to contact their agency |
| Duplicate punch | 409 |
| Empty signature / missing contact fields | 400 (client also blocks) |
| Oversized signature payload | 413 |
| Claim not caller's / wrong agency | 403 |

Notification dispatches: none added (decision below).

---

## 9. Deliberately out of scope (YAGNI)

- GPS/geofence verification of punch location.
- Per-edit history log — the `method` flag + `admin_edited_by/at` stamp suffices.
- Notifications on manual/admin entries — the Timesheets page badges cover visibility without noise.
- Facility-admin timesheet views — agency-side only for now.
- Break tracking / multiple punch pairs per shift.
- Payroll export formats beyond the existing CSV.

---

## 10. Verification plan (manual, per project convention — no test suite)

1. Run migration 005 in Supabase SQL Editor; confirm table exists.
2. `npm run dev`; as a nurse with a confirmed shift today: verify Clock In appears only within 30 min of start; punch live → sign → confirm; card shows clocked-in state; clock out → hours computed.
3. Manual path: on a confirmed shift already started, use "enter time manually", verify `manual` badge appears on Timesheets/My Hours.
4. As agency admin: Timesheets page shows the rows, variance, badges; signature modal renders the drawing; add a missing punch on a past shift → `Admin` badge.
5. My Hours: totals correct, missing-punch warning on an unpunched past shift.
6. CSV export: new columns populated; Total Pay reflects actual hours on completed timesheets.
7. Overnight check: shift 19:00–07:00, clock in 18:55, clock out 07:10 next day → actual hours ≈ 12.25, not negative.
8. Demo mode: launch demo, punch as demo nurse, view Timesheets as demo agency admin.
9. `npx tsc --noEmit` and `npm run lint` pass.
