export interface TourStep {
  id: string
  section: string
  title: string
  body: string
  targetId: string
  pagePattern?: RegExp
  nextPagePattern?: RegExp
  // When set, auto-advances as soon as this element appears in the DOM
  nextTargetId?: string
  placement: 'top' | 'bottom' | 'left' | 'right'
}

// Returns "Thursday, May 1" style string for the next Thursday from today
export function getNextThursdayStr(): string {
  const now = new Date()
  const daysUntilThursday = (4 - now.getDay() + 7) % 7 || 7
  const thursday = new Date(now)
  thursday.setDate(now.getDate() + daysUntilThursday)
  return thursday.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

// 19 tooltip steps. Tour state:
//   0          = email modal
//   1 - 19     = TOUR_STEPS[step - 1]
//   20         = completion modal
export function buildTourSteps(thursdayStr: string): TourStep[] {
  return [
  // ── Posting a Shift ──────────────────────────────────────────────────────
  {
    id: 'nav-facilities',
    section: 'Posting a Shift',
    title: 'Your placeholder facilities',
    body: "Flint Hills isn't on ShiftBridge yet — you staff them directly. Let's find them and post Sarah's shift.",
    targetId: 'nav-facilities',
    pagePattern: /\/demo\/agency\/.*/,
    nextPagePattern: /\/demo\/agency\/.*\/facilities/,
    placement: 'right',
  },
  {
    id: 'placeholder-row',
    section: 'Posting a Shift',
    title: 'Flint Hills Rehabilitation Center',
    body: 'A placeholder facility — you manage their shifts while they decide whether to join ShiftBridge. Click to open.',
    targetId: 'placeholder-row',
    pagePattern: /\/facilities($|\?)/,
    nextPagePattern: /\/facilities\/placeholder\/.*/,
    placement: 'bottom',
  },
  {
    id: 'placeholder-calendar',
    section: 'Posting a Shift',
    title: 'Their shift calendar',
    body: `Sarah needs coverage on ${thursdayStr}. Click that day on the calendar.`,
    targetId: 'placeholder-calendar',
    pagePattern: /\/facilities\/placeholder\/.*/,
    nextTargetId: 'post-placeholder-shift-btn',
    placement: 'top',
  },
  {
    id: 'post-placeholder-shift-btn',
    section: 'Posting a Shift',
    title: 'Post a shift',
    body: 'Click here to add a shift for this day.',
    targetId: 'post-placeholder-shift-btn',
    pagePattern: /\/facilities\/placeholder\/.*/,
    nextTargetId: 'placeholder-shift-form',
    placement: 'top',
  },
  {
    id: 'placeholder-shift-form',
    section: 'Posting a Shift',
    title: 'Fill in the details',
    body: "Set credential to LPN, change the time to 7:00 AM – 3:00 PM to match Sarah's request, then click Post Shift.",
    targetId: 'placeholder-shift-form',
    pagePattern: /\/facilities\/placeholder\/.*/,
    placement: 'top',
  },
  {
    id: 'placeholder-calendar-posted',
    section: 'Posting a Shift',
    title: 'Shift posted',
    body: "When a nurse claims this, ShiftBridge emails Sarah directly — a confirm/decline link, no login required. You can also confirm from right here without waiting.",
    targetId: 'placeholder-calendar',
    pagePattern: /\/facilities\/placeholder\/.*/,
    placement: 'top',
  },

  // ── Nurse View ───────────────────────────────────────────────────────────
  {
    id: 'nav-nurse-shifts',
    section: 'Nurse View',
    title: 'Switch to nurse view',
    body: "Let's see what a nurse sees. In the demo, all three roles share the same sidebar.",
    targetId: 'nav-nurse-shifts',
    nextPagePattern: /\/demo\/nurse$/,
    placement: 'right',
  },
  {
    id: 'nurse-calendar',
    section: 'Nurse View',
    title: 'Available shifts',
    body: 'The LPN shift you just posted is here. Flint Hills also has a pre-scheduled CNA shift — find it and click that day.',
    targetId: 'nurse-calendar',
    pagePattern: /\/demo\/nurse$/,
    placement: 'top',
  },
  {
    id: 'nurse-day-panel',
    section: 'Nurse View',
    title: 'Claim the Flint Hills shift',
    body: 'This is a placeholder facility shift. Claiming it emails Sarah immediately with your credentials and a one-click confirm link.',
    targetId: 'nurse-day-panel',
    pagePattern: /\/demo\/nurse$/,
    placement: 'left',
  },

  // ── Agency Confirms ──────────────────────────────────────────────────────
  {
    id: 'nav-agency-shifts',
    section: 'Agency Confirms',
    title: 'The agency can confirm too',
    body: "No need to wait for Sarah. Switch to the agency shifts calendar to confirm the claim directly.",
    targetId: 'nav-agency-shifts',
    nextPagePattern: /\/demo\/agency\/.*\/shifts/,
    placement: 'right',
  },
  {
    id: 'agency-shift-calendar',
    section: 'Agency Confirms',
    title: 'Claimed shift in your calendar',
    body: "The nurse's claim appears here. Click the day it's on — you'll see ✓ and ✕ buttons to confirm or decline directly.",
    targetId: 'agency-shift-calendar',
    pagePattern: /\/demo\/agency\/.*\/shifts/,
    placement: 'top',
  },
  {
    id: 'confirm-placeholder-btn',
    section: 'Agency Confirms',
    title: 'Confirm the nurse',
    body: 'Confirmed without waiting for the coordinator. Now let\'s demo the connected facility flow.',
    targetId: 'confirm-placeholder-btn',
    pagePattern: /\/demo\/agency\/.*\/shifts/,
    placement: 'left',
  },

  // ── Connected Facility ───────────────────────────────────────────────────
  {
    id: 'nav-nurse-shifts-2',
    section: 'Connected Facility',
    title: 'Back to nurse view',
    body: 'Now let\'s claim a shift from a fully connected facility and walk through the facility admin confirmation.',
    targetId: 'nav-nurse-shifts',
    nextPagePattern: /\/demo\/nurse$/,
    placement: 'right',
  },
  {
    id: 'nurse-calendar-connected',
    section: 'Connected Facility',
    title: 'Find a Cottonwood Creek shift',
    body: 'Cottonwood Creek is a fully connected facility. Claims go straight to their admin for review — no coordinator email needed.',
    targetId: 'nurse-calendar',
    pagePattern: /\/demo\/nurse$/,
    placement: 'top',
  },
  {
    id: 'claim-shift-btn',
    section: 'Connected Facility',
    title: 'Claim this shift',
    body: 'The facility admin will see this immediately in their claims queue.',
    targetId: 'claim-shift-btn',
    pagePattern: /\/demo\/nurse$/,
    placement: 'top',
  },

  // ── Facility Confirms ────────────────────────────────────────────────────
  {
    id: 'nav-facility-claims',
    section: 'Facility Confirms',
    title: 'Switch to facility admin',
    body: "The facility just got an in-app notification. Let's confirm the nurse.",
    targetId: 'nav-facility-claims',
    nextPagePattern: /\/demo\/facility\/.*\/claims/,
    placement: 'right',
  },
  {
    id: 'confirm-claim-btn',
    section: 'Facility Confirms',
    title: 'Confirm the nurse',
    body: "The nurse's credentials are right here. One click confirms them and sends a notification.",
    targetId: 'confirm-claim-btn',
    pagePattern: /\/demo\/facility\/.*\/claims/,
    placement: 'top',
  },

  // ── Nurse Schedule ───────────────────────────────────────────────────────
  {
    id: 'nav-nurse-schedule',
    section: "Nurse's Schedule",
    title: "Check the nurse's schedule",
    body: 'Confirmed shifts land on the calendar immediately.',
    targetId: 'nav-nurse-schedule',
    nextPagePattern: /\/demo\/nurse\/schedule/,
    placement: 'right',
  },
  {
    id: 'nurse-schedule-calendar',
    section: "Nurse's Schedule",
    title: 'Shift confirmed',
    body: "That's the full ShiftBridge workflow — from an email request to a confirmed shift on the nurse's calendar.",
    targetId: 'nurse-schedule-calendar',
    pagePattern: /\/demo\/nurse\/schedule/,
    placement: 'top',
  },
  ]
}

export const TOUR_STEPS = buildTourSteps(getNextThursdayStr())
export const TOTAL_STEPS = TOUR_STEPS.length // 19
export const COMPLETION_STEP = TOTAL_STEPS + 1 // 20
