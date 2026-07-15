# ShiftBridge — Product Overview

ShiftBridge is a per diem nursing shift staffing platform that connects healthcare facilities with staffing agencies and independent nurses. Facilities post open shifts; agencies assign qualified nurses to claim them. The platform handles the full workflow from posting to confirmation, with built-in notifications, credentialing, and reporting.

---

## Who Uses ShiftBridge

**Facility Admins** manage their open shift calendar, review nurse claims, confirm coverage, and track agency relationships and costs.

**Agency Admins** manage their nursing roster, monitor credentials, post shifts on behalf of nurses, and track fill rates and financial performance.

**Nurses** browse available shifts, claim the ones they want, and view their upcoming schedule — with drive time estimates and facility-specific details shown inline.

**Super Admins** oversee platform accounts, manage user access, and monitor demo sessions.

---

## Core Features

### Shift Posting & Calendar
Facilities configure shift templates by credential type (CNA, CMA, LPN, LPN IV, RN) with named slots and standard hours. From those templates, admins post shifts one at a time or in batches of up to ten. Each shift has a priority tier (Standard, Priority, Urgent) that affects nurse pay and visual urgency.

All shifts display on an interactive monthly calendar. Tiles show color-coded pill badges summarizing open, claimed, and confirmed shifts per day. Clicking any day opens a detail panel with per-shift controls. The calendar updates in real time — claims and confirmations reflect immediately without a page reload.

### Nurse Shift Discovery & Claiming
Nurses browse available shifts on a calendar or list view, filterable by facility. Each shift card shows the facility name, date, time, credential required, pay rate (with tier bonus if applicable), special requirements, and a facility info note if the admin has added one. Drive time from the nurse's home address appears on every card that has a real facility attached.

Before submitting a claim, nurses see a double-booking warning if they already have an overlapping shift. Claims can be withdrawn at any time before confirmation.

### Claim Review & Confirmation
Facility admins review pending claims through a queue that shows each nurse's credentials, license number, expiry dates, IV certification, CPR, TB, and COVID status. Admins confirm one claim per shift, which automatically rejects all other pending applicants. Rejected nurses receive an in-app notification.

Agencies can optionally require internal approval before a nurse's claim is visible to the facility. Agency admins review and approve or reject these internally before they enter the facility's queue.

### Placeholder Facilities
Agencies can post shifts for facilities they work with that aren't yet on the platform, using a placeholder record. When the real facility signs up, ShiftBridge detects the address match and alerts the agency admin. The agency sends a connection request; the facility accepts or declines. On acceptance, the placeholder's posted shifts are removed and replaced by the real connected relationship.

For placeholder shifts, a coordinator confirmation flow sends the facility contact an email with the nurse's credentials and two buttons — Confirm or Decline — requiring no login. Accepting confirms the shift; declining reopens or closes it depending on the coordinator's choice.

### Notifications
Every significant event in the workflow triggers a notification. In-app notifications appear in a live bell icon in the sidebar, with an unread count badge and a dropdown showing recent events with timestamps. Clicking a notification navigates directly to the relevant page.

SMS notifications via Twilio and email notifications via Resend are supported for high-priority events (shift confirmation, cancellation). Each user controls their notification preferences per event type and channel through a settings page.

### DNR System
Facility admins can place a nurse on a Do Not Return list after a confirmed shift. Issuing a DNR automatically cancels any future confirmed shifts that nurse has at that facility, notifies the nurse, and hides that facility's shifts from the nurse's available feed. Agency admins are notified when one of their nurses receives a DNR. DNRs can be undone by the facility admin at any time.

### Shift Cancellation
Shifts can be canceled from the calendar at any point — open, claimed, or confirmed. Facility admins cancel from the facility calendar; agency admins can cancel placeholder shifts from the agency calendar. Canceling a confirmed shift notifies the assigned nurse. Admins choose whether to reopen the shift for reassignment or close it permanently.

### Credential Monitoring
The agency staff roster highlights credential expiration warnings — license, CPR, TB, and IV certification — at 30 days and again at 90 days. A two-tab credential widget on the agency dashboard separates urgent expirations from upcoming ones, so nothing slips through.

### Drive Times
Nurses see an estimated drive time from their home address to each facility directly on every shift card. Times are fetched via the Google Distance Matrix API, cached for the session, and shown as "~X min away" inline. No address data is ever exposed to the client — home coordinates are fetched server-side only.

### Agency Dashboard
The agency dashboard provides a full operational view: shift tabs for confirmed, pending, and canceled shifts this month; a financial snapshot of hours worked and estimated pay out; fill rate by credential type with month-over-month trend; a credential pipeline showing upcoming expirations; open placeholder shift needs sorted by urgency; and a staff activity table with per-nurse cancel rate and late-cancel rate.

### Facility Dashboard
The facility dashboard shows a pending claims badge, an agency overview table with hours, confirmed shifts, and an editable bill rate per connected agency, a fill rate breakdown, and a repeat nurse table highlighting the nurses who have worked the most shifts at that facility.

### Shift Needs Outreach Email
Facility admins can email a branded shift availability summary to off-platform agencies directly from the shift calendar. The email groups open shifts by credential with tier badges and notes, and includes a signup call-to-action. Saved recipient contacts are stored and pre-selected on future sends. Sent contacts are remembered per facility.

### CSV Export
Agency admins export a full monthly shift report as a CSV. Columns include date, facility, credential, times, hours, tier, status, nurse name, license number, pay rate, total pay, and a late-cancel flag.

### Mass Text
Agency admins send a bulk SMS to all nurses of a given credential type (or all nurses) directly from the dashboard. Messages include an in-app notification alongside the SMS so the event is recorded regardless of SMS delivery.

### Staff Enrollment
Agencies enroll nurses directly through the platform. The enrollment form supports NURSYS license lookup for RN and LPN nurses, auto-filling license number, state, and expiry. CNA, CMA, and other fields are entered manually. New nurses receive an email invite with a link to set their password.

Facilities can also enroll their own in-house staff. Each facility has a dedicated house agency created automatically on first enrollment, and enrolled nurses see only that facility's shifts.

### Agency Profile
Agencies configure a public-facing profile with a display name, contact email, bio, and logo. This information appears in coordinator emails and connection request notifications to facilities.

### Self-Signup
Agencies and facilities sign themselves up through a public signup flow — no admin approval required. Nurses are enrolled by their agency or facility admin only.

### Interactive Demo
A one-click demo launches a fully isolated environment pre-seeded with an agency, two facilities, a nursing roster, posted shifts, a placeholder facility, and a pending connection request. The demo expires after four hours and is cleaned up automatically. All four roles are accessible from a single three-section sidebar without switching accounts.

---

## Credential Types

| Code | Name |
|------|------|
| CNA | Certified Nursing Assistant |
| CMA | Certified Medication Aide |
| LPN | Licensed Practical Nurse |
| LPN_IV | Licensed Practical Nurse with IV Certification |
| RN | Registered Nurse |
