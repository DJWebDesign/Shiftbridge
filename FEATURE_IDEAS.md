# ShiftBridge — Feature Ideas & Gaps
_Generated after reviewing all agency and facility admin views_

---

## AGENCY ADMIN

### Analytics & Reporting

#### Fill Rate
Currently there's no metric showing what percentage of shifts actually get filled. This is the single most important KPI for a staffing agency.
- Fill rate overall, and broken down by credential type (RN vs CNA etc.) and by facility
- Trend over time: is your fill rate improving or slipping month over month?
- A low fill rate on a specific credential type signals a staffing shortage you need to address

#### Margin / Profitability View
The dashboard shows "Est. Pay Out" (what you pay nurses) but has no view of what you bill facilities. You have both numbers — `base_pay_rate` on the nurse side, `bill_rate` on the connection side. Putting them together gives:
- Gross revenue (bill_rate × hours worked per agency-facility connection)
- Labor cost (base_pay_rate × hours per nurse)
- Estimated margin per facility, per month
- This is the agency's actual business metric and it's invisible right now

#### Time-to-Fill
How long does it take from when a shift is posted to when a nurse claims it? And from claim to facility confirmation?
- Average time-to-fill by credential type and by facility
- Shifts that sat open for >24 hours before being claimed are a signal worth surfacing
- Long confirm times by a specific facility might mean their coordinator isn't responsive

#### Tier Distribution
There's a 3-tier urgency system (Regular / Urgent / Emergency) but no summary of how those tiers are being used.
- What % of shifts this month were each tier?
- A facility posting mostly Tier 3 "Emergency" shifts is either constantly understaffed or misusing the tier system
- Tracking tier escalations over time shows if chronic understaffing is getting worse

#### Per-Nurse Reliability Score
The staff activity table shows shifts worked and shifts canceled, but no rate or score.
- Cancel rate per nurse (canceled / total claimed)
- Late cancel rate specifically (the `is_late_cancel` flag exists in the DB already)
- Nurses with high cancel rates are a liability — this surfaces them before a pattern becomes a problem
- Could be shown as a simple percentage on the staff profile page

#### Per-Nurse Earnings Breakdown
No per-nurse financial summary exists anywhere.
- Monthly earnings per nurse (hours × effective pay by tier)
- Useful for agency payroll processing — right now there's no way to get this from the app
- A simple "pay report" export by nurse and month would save manual spreadsheet work

#### Credential Pipeline (Extended Window)
Credential alerts today only fire at 30 days. That's reactive.
- A 90-day or 6-month pipeline view: "these 8 nurses have credentials expiring in the next 6 months"
- Grouped by credential type (CPR expiring, TB due, license renewal)
- Gives time to proactively work with nurses on renewals instead of scrambling at 30 days

#### Late Cancellation Impact
The `is_late_cancel` flag is tracked but never surfaced in any summary.
- How many late cancels this month? By nurse? By facility?
- Total hours lost to late cancels
- Late cancels have real operational cost — a facility that got stood up last-minute will lose trust

#### Facility Relationship Health
For each connected facility, a snapshot of the agency's performance there:
- Shifts filled vs. total shifts posted (fill rate per facility)
- Average response time (claim to confirm)
- Late cancel count
- This helps the agency know which facility relationships are strong and which are at risk

---

### Settings

#### Agency Profile / Public Info
No way to set an agency name, contact number, or description that appears to facilities. The coordinator emails currently say "ShiftBridge" with no agency branding.
- Agency display name (may differ from legal name)
- Primary contact phone/email
- Logo or profile image
- This info should appear in coordinator emails and connection requests so facilities know who they're working with

#### Claim Approval Workflow (Optional)
Right now, a nurse claims a shift and it goes directly to the facility for review. Some agencies want to vet claims internally first before the facility sees them.
- Optional toggle: "Require agency approval before forwarding to facility coordinator"
- When enabled, a claimed shift goes to agency admin first, then to facility on agency approve
- When disabled (default), current behavior unchanged

#### Overtime / Hours Cap Tracking
No visibility into weekly hours per nurse across all facilities.
- Optional per-nurse weekly hour cap setting
- When a nurse's scheduled hours would exceed the cap with a new claim, flag it
- Relevant for agencies that need to manage overtime pay or comply with hour limits

#### Auto-Notify on Unfilled Shifts
If a placeholder shift has no claim after X hours, automatically mass-text eligible nurses.
- Configurable threshold per tier: e.g., Tier 1 = notify after 48h, Tier 3 = notify after 4h
- Currently the agency has to manually send mass texts — this automates the follow-up

#### Notification Preferences
No control over which events send emails vs. in-app notifications to the agency admin.
- Choose: email me on DNR, email me on new claim, email me on credential expiry
- Currently everything is in-app only, which requires logging in to see

---

## FACILITY ADMIN

### Analytics & Reporting

#### Fill Rate
Same core gap as the agency side — no view of what percentage of posted shifts got filled.
- Fill rate by credential type (RN shifts often harder to fill than CNA)
- Fill rate by shift time (night shifts typically harder)
- Fill rate trend month over month — is it improving?
- An unfilled shift is real operational risk; knowing your fill rate helps with planning

#### Agency Scorecard / Comparison
The agency overview table shows bill rates and hours but no performance metrics.
- For each connected agency: fill rate, average time-to-fill, cancellation rate, late cancel count
- Cost per filled shift (total billed / filled shifts) as a normalized comparison
- This answers: "Which agency is actually most reliable, not just cheapest?"

#### Staffing Gap View (Forward-Looking)
The shift calendar shows status but there's no forward-looking "coverage at a glance" view.
- A view of the next 2–4 weeks showing which shifts are open (no claims), claimed (awaiting confirmation), and confirmed
- Color-coded coverage: green = confirmed, amber = claimed pending, red = open/unfilled
- Lets the facility see upcoming staffing gaps before they become emergencies

#### Cost Breakdown by Credential Type
The bill rate is one flat number per agency, but RNs cost more than CNAs in practice.
- Estimated monthly cost broken down by credential type (what you're spending on RN hours vs CNA hours)
- Useful for budget tracking and workforce planning
- "We spent $12,000 on RN shifts and $4,000 on CNA shifts this month"

#### Repeat Nurse Tracking
No visibility into which nurses have worked at the facility before.
- List of nurses who have completed shifts here, with shift count and most recent date
- A "known quantity" section distinct from the DNR list — nurses the facility likes and wants back
- Currently the only nurse memory the facility has is DNR (negative). No positive equivalent.

#### Historical Trends (Month over Month)
No way to compare this month to last month.
- Shifts posted vs. filled comparison across months
- Cost trend: is the monthly staffing bill going up?
- Agency usage trend: which agency filled more this month vs. last?
- Even a simple 3-month sparkline on the dashboard cards would show trajectory

#### Late Cancellation Summary
Facilities bear the operational pain of late cancels but can't see a summary.
- How many late cancels this month? By agency? By credential type?
- Total hours lost to late cancels
- Contextual: if Agency A has 3× more late cancels than Agency B, that's important for the agency scorecard

---

### Settings

#### Multiple Coordinator Contacts
Currently there's one coordinator email per placeholder facility. A real facility often has different coordinators for different shifts or credential types.
- Add multiple coordinator contacts per facility
- Route coordinator emails by credential type: RN shifts go to the charge nurse coordinator, CNA shifts go to the staffing office
- Or route by shift time: day shift coordinator vs. night shift coordinator

#### Confirmation Deadline / Auto-Decline
No timeout on coordinator confirmation. A claimed shift can sit waiting indefinitely.
- Set a deadline: if the coordinator hasn't confirmed or declined within X hours, auto-decline and reopen the shift
- Or auto-confirm after X hours (for trusted agencies)
- Prevents shifts from falling through the cracks when coordinators are slow

#### Preferred Nurse List
A positive counterpart to DNR — nurses the facility has approved and wants to see again.
- Flag certain nurses as "preferred" after they've worked a shift
- Could be used to route future shift notifications to preferred nurses first
- Currently the only relationship state is neutral or DNR

#### Default Shift Lead Time Reminder
No setting for how far in advance shifts should be posted.
- Set a target: "shifts should be posted at least 5 days in advance"
- Alert the facility admin when a shift date is approaching and the shift hasn't been posted yet
- Helps facilities stay proactive instead of posting emergency Tier 3 shifts last-minute

#### Bill Rate per Credential Type
The current bill rate is one flat number per agency connection. In reality RNs cost more per hour than CNAs.
- Set different bill rates per credential type per agency: Agency A charges $45/hr for RN, $28/hr for CNA
- The cost estimate on the dashboard would then be more accurate
- Relevant for budgeting and agency contract negotiations

#### Blackout Dates
No way to block shift posting on specific dates (facility closure, holidays, renovations, inspections).
- Define date ranges where shifts cannot be posted or existing shifts should be flagged
- Prevents accidentally posting or confirming shifts during facility closures

#### Facility Profile / Public Description
Facilities are visible to agencies only as a name + address. No other information.
- Add a short description, parking info, dress code, unit specialties, etc.
- Shown to nurses before they claim a shift — helps nurses decide if the facility is a good fit
- Reduces "I didn't know what I was getting into" cancellations

---

## CROSS-CUTTING IDEAS

#### Invoice / Billing Export (Facility Side)
The facility has estimated monthly costs but no exportable billing summary.
- Month-end report: hours × bill rate per agency, broken down by credential type and shift date
- Downloadable as PDF or CSV for accounts payable
- Equivalent to a monthly invoice from each agency

#### Nurse Availability Calendar (Agency Side)
No way for nurses to mark themselves unavailable.
- Nurses can block dates (vacation, personal, another commitment)
- Agency admin sees availability when deciding who to notify about open shifts
- Reduces wasted notifications to unavailable nurses

#### Shift Notes / Special Requirements (Both Sides)
Shifts have no free-text notes field.
- Allow facility to add notes to a shift: "Must be comfortable with memory care unit" or "Bring your own scrubs"
- Nurses see this before claiming
- Reduces post-claim surprises and cancellations

#### Facility-to-Agency Feedback (Both Sides)
No structured feedback mechanism after a shift is completed.
- Facility can rate a nurse (1–5 stars, optional comment) after a confirmed shift
- Agency sees aggregate ratings per nurse
- Nurses with low ratings can be reviewed; nurses with high ratings can be preferentially dispatched
- This data is extremely valuable for agency quality control

---

## PRIORITY ROUGH-RANKING

**High value, relatively self-contained:**
1. Fill rate metrics (agency + facility) — pure analytics, no new DB columns needed
2. Margin / profitability view (agency) — data already exists, just needs a new calculation
3. Agency scorecard for facility — data already exists, new view
4. Per-nurse reliability score — data already exists, surface it on staff profile
5. Credential pipeline (extended 90-day window) — trivial query change

**Medium value, some new infrastructure:**
6. Preferred nurse list (facility) — new DB column, simple UI
7. Multiple coordinator contacts — schema change, routing logic
8. Bill rate per credential type — schema change, dashboard update
9. Late cancellation impact summary — data exists, new aggregation view
10. Invoice/billing export (facility CSV) — new API route, similar to agency CSV export

**Higher effort / later:**
11. Nurse availability calendar — new table, UI component
12. Confirmation deadline / auto-decline — background job or cron
13. Auto-notify on unfilled shifts — cron + notification logic
14. Facility-to-agency feedback / ratings — new table, review workflow
15. Agency claim approval workflow — new status, routing change
