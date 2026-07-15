/**
 * Address normalization for facility matching.
 * Both real facilities (created by super admin) and placeholder facilities
 * normalize addresses with this function so they can be compared for match detection.
 */

const ABBREVIATION_MAP: Array<[RegExp, string]> = [
  [/\bst\.?\b/gi, 'street'],
  [/\bave\.?\b/gi, 'avenue'],
  [/\bblvd\.?\b/gi, 'boulevard'],
  [/\bdr\.?\b/gi, 'drive'],
  [/\brd\.?\b/gi, 'road'],
  [/\bln\.?\b/gi, 'lane'],
  [/\bct\.?\b/gi, 'court'],
  [/\bpl\.?\b/gi, 'place'],
  [/\bhwy\.?\b/gi, 'highway'],
  [/\bpkwy\.?\b/gi, 'parkway'],
  [/\bexpy\.?\b/gi, 'expressway'],
  [/\bfwy\.?\b/gi, 'freeway'],
  [/\bcir\.?\b/gi, 'circle'],
  [/\bter\.?\b/gi, 'terrace'],
  [/\btrce\.?\b/gi, 'trace'],
  [/\bway\.?\b/gi, 'way'],
  [/\bn\.?\b/gi, 'north'],
  [/\bs\.?\b/gi, 'south'],
  [/\be\.?\b/gi, 'east'],
  [/\bw\.?\b/gi, 'west'],
  [/\bne\.?\b/gi, 'northeast'],
  [/\bnw\.?\b/gi, 'northwest'],
  [/\bse\.?\b/gi, 'southeast'],
  [/\bsw\.?\b/gi, 'southwest'],
]

const STRIP_PATTERNS: RegExp[] = [
  /\bapt\.?\s*#?\s*\d*\w*\b/gi,
  /\bsuite\.?\s*#?\s*\w+\b/gi,
  /\bste\.?\s*#?\s*\w+\b/gi,
  /\bunit\.?\s*#?\s*\w+\b/gi,
  /\bfloor\.?\s*\d*\b/gi,
  /\bfl\.?\s*\d*\b/gi,
  /\b#\s*\w+\b/gi,
]

export function normalizeAddress(parts: {
  address_line1: string
  city: string
  state: string
  zip: string
}): string {
  let raw = `${parts.address_line1} ${parts.city} ${parts.state} ${parts.zip}`.toLowerCase()

  // Strip unit/apt/suite designators first (before expanding abbreviations)
  for (const pattern of STRIP_PATTERNS) {
    raw = raw.replace(pattern, '')
  }

  // Expand common abbreviations
  for (const [pattern, replacement] of ABBREVIATION_MAP) {
    raw = raw.replace(pattern, replacement)
  }

  // Remove punctuation (keep alphanumeric and spaces)
  raw = raw.replace(/[^\w\s]/g, '')

  // Collapse whitespace
  return raw.replace(/\s+/g, ' ').trim()
}
