'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useDriveTime } from '@/hooks/useDriveTime'
import { CredentialBadge, TierBadge } from '@/components/ui/Badge'

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-800',
  confirmed: 'bg-green-100 text-green-800',
  rejected:  'bg-red-100 text-red-700',
  withdrawn: 'bg-gray-100 text-gray-500',
}

function fmt12(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

function formatDate(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number)
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatShortDate(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number)
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

export type ScheduleClaim = {
  id: string
  status: string
  claimed_at: string
  confirmed_at: string | null
  agency_id: string | null
  agencies: { name: string } | null
  shift: {
    id: string
    shift_date: string
    start_time: string
    end_time: string
    credential_required: string
    priority_tier: number
    status: string
    facilityId: string | null
    placeholderFacilityId: string | null
    facilityName: string | null
    facilityAddress: string | null
    facilityCity: string | null
    facilityState: string | null
    isPlaceholder: boolean
  }
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function NurseScheduleClient({
  claims,
  today,
  nurseOrigin,
  initialDriveTimes = {},
}: {
  claims: ScheduleClaim[]
  today: string
  nurseOrigin?: string
  initialDriveTimes?: Record<string, number | null>
}) {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState(() => new Date().getMonth()) // 0-based
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const uniqueFacilityIds = useMemo(() => (
    [...new Set(claims.map(c => c.shift.facilityId).filter((id): id is string => !!id))]
  ), [claims])
  const uniquePlaceholderIds = useMemo(() => (
    [...new Set(claims.map(c => c.shift.placeholderFacilityId).filter((id): id is string => !!id))]
  ), [claims])
  const driveMinutes = useDriveTime(uniqueFacilityIds, uniquePlaceholderIds, initialDriveTimes)

  function getDriveMinutes(claim: ScheduleClaim): number | null | undefined {
    const id = claim.shift.facilityId ?? claim.shift.placeholderFacilityId
    return id ? driveMinutes[id] : undefined
  }

  function getMapsUrl(claim: ScheduleClaim): string | null {
    const { facilityAddress, facilityCity, facilityState } = claim.shift
    if (!facilityAddress && !facilityCity) return null
    const dest = encodeURIComponent([facilityAddress, facilityCity, facilityState].filter(Boolean).join(', '))
    return `https://www.google.com/maps/dir/?api=1${nurseOrigin ? `&origin=${encodeURIComponent(nurseOrigin)}` : ''}&destination=${dest}`
  }

  // Next 3 upcoming confirmed shifts
  const upcoming = claims
    .filter(c => c.shift.shift_date >= today && c.status === 'confirmed')
    .slice(0, 3)

  // All active claims (pending + confirmed) for calendar dots
  const activeClaims = claims.filter(c =>
    ['pending', 'confirmed'].includes(c.status)
  )

  // Build a map: date string → claims
  const claimsByDate: Record<string, ScheduleClaim[]> = {}
  for (const c of activeClaims) {
    const d = c.shift.shift_date
    if (!claimsByDate[d]) claimsByDate[d] = []
    claimsByDate[d].push(c)
  }

  // Calendar grid
  const firstDay = new Date(year, month, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
    setSelectedDay(null)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
    setSelectedDay(null)
  }

  function dayKey(d: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  const selectedClaims = selectedDay ? (claimsByDate[selectedDay] ?? []) : []

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="section-title text-3xl">My Schedule</h1>
          <p className="text-sm text-ink-2 mt-0.5">Your confirmed and pending shifts</p>
        </div>
        <Link href="/nurse" className="text-sm text-brand hover:text-brand-hover font-medium">
          ← Available Shifts
        </Link>
      </div>

      {/* Next 3 confirmed shifts */}
      <div className="mb-8">
        <h2 className="text-[11px] font-bold text-ink-3 uppercase tracking-wide mb-3">
          Upcoming Confirmed
        </h2>
        {upcoming.length === 0 ? (
          <div className="text-center py-8 card">
            <p className="text-ink-2 text-sm">No confirmed shifts yet.</p>
            <Link href="/nurse" className="text-sm text-brand hover:underline mt-1 inline-block">
              Browse available shifts
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {upcoming.map(claim => (
              <div key={claim.id} className="card border-green-200 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-semibold text-ink text-sm leading-tight">
                    {claim.shift.facilityName ?? 'Unknown Facility'}
                    {claim.shift.isPlaceholder && (
                      <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">PH</span>
                    )}
                  </p>
                  <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-green-100 text-green-700">
                    Confirmed
                  </span>
                </div>
                {(claim.shift.facilityAddress || claim.shift.facilityCity) && (() => {
                  const mapsUrl = getMapsUrl(claim)
                  const mins = getDriveMinutes(claim)
                  const addressLine = [claim.shift.facilityAddress, claim.shift.facilityCity && `${claim.shift.facilityCity}, ${claim.shift.facilityState}`].filter(Boolean).join(' · ')
                  return (
                    <div className="mb-2">
                      {mapsUrl ? (
                        <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs font-medium hover:underline text-brand"
                          onClick={e => e.stopPropagation()}
                        >
                          {addressLine}
                        </a>
                      ) : (
                        <p className="text-xs text-ink-3">{addressLine}</p>
                      )}
                      {mins != null && (
                        <p className="text-xs text-ink-3 mt-0.5">~{mins} min away</p>
                      )}
                    </div>
                  )
                })()}
                <p className="text-xs font-semibold text-ink-2 tabular-nums">{formatShortDate(claim.shift.shift_date)}</p>
                <p className="text-xs text-ink-2 mt-0.5 tabular-nums">
                  {fmt12(claim.shift.start_time)} – {fmt12(claim.shift.end_time)}
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  <CredentialBadge credential={claim.shift.credential_required} className="text-[10px]" />
                  <TierBadge tier={claim.shift.priority_tier} label={`Tier ${claim.shift.priority_tier}`} className="text-[10px]" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Calendar + Day panel side by side */}
      <div data-tour-id="nurse-schedule-calendar" className="flex gap-4 items-start">
        {/* Calendar */}
        {/* ── Calendar card ── */}
        <div className="flex-1 min-w-0" style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)' }}>

          {/* Navy header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#0D1B2A' }}>
            <button onClick={prevMonth} aria-label="Previous month" style={{ width: 30, height: 30, border: '1px solid rgba(255,255,255,0.10)', borderRadius: 7, background: 'rgba(255,255,255,0.05)', color: '#7B93AB', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
              ‹
            </button>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#F1F5F9' }}>
              {MONTH_NAMES[month]} <span style={{ color: '#4A6080', fontWeight: 400 }}>{year}</span>
            </span>
            <button onClick={nextMonth} aria-label="Next month" style={{ width: 30, height: 30, border: '1px solid rgba(255,255,255,0.10)', borderRadius: 7, background: 'rgba(255,255,255,0.05)', color: '#7B93AB', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
              ›
            </button>
          </div>

          {/* Day-of-week labels in navy band */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#0D1B2A', padding: '2px 14px 12px' }}>
            {DAY_NAMES.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 600, color: '#7B93AB', letterSpacing: '.07em', textTransform: 'uppercase' }}>{d}</div>
            ))}
          </div>

          {/* Tile grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5, padding: 14, background: '#F4F7FA' }}>
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`blank-${i}`} style={{ minHeight: 74, borderRadius: 10 }} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d          = i + 1
              const key        = dayKey(d)
              const dayClaims  = claimsByDate[key] ?? []
              const isToday    = key === today
              const isSelected = key === selectedDay
              const hasTealRing = isToday || isSelected
              const confirmedCount = dayClaims.filter(c => c.status === 'confirmed').length
              const pendingCount   = dayClaims.filter(c => c.status === 'pending').length

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDay(isSelected ? null : key)}
                  style={{
                    minHeight: 74,
                    borderRadius: 10,
                    padding: '8px 8px 7px',
                    background: '#fff',
                    border: 'none',
                    cursor: dayClaims.length > 0 ? 'pointer' : 'default',
                    transition: 'box-shadow .12s, transform .12s, background .12s',
                    boxShadow: hasTealRing ? 'inset 0 0 0 2.5px #0D9488' : undefined,
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                  onMouseEnter={e => {
                    if (dayClaims.length > 0 && !hasTealRing) {
                      const el = e.currentTarget as HTMLElement
                      el.style.background = '#EBF5F4'
                      el.style.transform = 'translateY(-1px)'
                      el.style.boxShadow = '0 3px 8px rgba(13,148,136,.10)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (dayClaims.length > 0 && !hasTealRing) {
                      const el = e.currentTarget as HTMLElement
                      el.style.background = '#fff'
                      el.style.transform = ''
                      el.style.boxShadow = ''
                    }
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', marginBottom: 5, color: isToday ? '#0D9488' : '#0D1B2A' }}>
                    {d}
                  </span>
                  {dayClaims.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {confirmedCount > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, whiteSpace: 'nowrap', width: 'fit-content', lineHeight: 1.5, background: '#DCFCE7', color: '#166534' }}>
                          {confirmedCount} confirmed
                        </span>
                      )}
                      {pendingCount > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, whiteSpace: 'nowrap', width: 'fit-content', lineHeight: 1.5, background: '#FEF3C7', color: '#92400E' }}>
                          {pendingCount} pending
                        </span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '11px 22px', borderTop: '1px solid #E4EAF0', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: '#5B6B80', fontWeight: 500 }}>Confirmed</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: '#5B6B80', fontWeight: 500 }}>Pending</span>
            </div>
          </div>

        </div>

        {/* Day detail panel */}
        <div className="w-64 shrink-0">
          {selectedDay ? (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-line flex items-center justify-between">
                <p className="text-xs font-semibold text-ink-2 tabular-nums">{formatDate(selectedDay)}</p>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="text-ink-3 hover:text-ink-2 transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-3 space-y-2">
                {selectedClaims.length === 0 ? (
                  <p className="text-sm text-ink-3 py-2 text-center">No shifts on this day.</p>
                ) : (
                  selectedClaims.map(claim => (
                    <div key={claim.id} className="rounded-lg border border-line bg-background p-3">
                      <div className="flex items-start justify-between gap-1.5 mb-1.5">
                        <p className="font-semibold text-ink text-xs leading-tight">
                          {claim.shift.facilityName ?? 'Unknown Facility'}
                          {claim.shift.isPlaceholder && (
                            <span className="ml-1 text-[9px] font-bold px-1 py-0.5 rounded bg-amber-100 text-amber-700">PH</span>
                          )}
                        </p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${STATUS_STYLES[claim.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {claim.status}
                        </span>
                      </div>
                      {(claim.shift.facilityAddress || claim.shift.facilityCity) && (() => {
                        const mapsUrl = getMapsUrl(claim)
                        const mins = getDriveMinutes(claim)
                        const addressLine = [claim.shift.facilityAddress, claim.shift.facilityCity && `${claim.shift.facilityCity}, ${claim.shift.facilityState}`].filter(Boolean).join(' · ')
                        return (
                          <div className="mb-1.5">
                            {mapsUrl ? (
                              <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                                className="text-[11px] font-medium hover:underline text-brand"
                                onClick={e => e.stopPropagation()}
                              >
                                {addressLine}
                              </a>
                            ) : (
                              <p className="text-[11px] text-ink-3">{addressLine}</p>
                            )}
                            {mins != null && (
                              <p className="text-[11px] text-ink-3 mt-0.5">~{mins} min away</p>
                            )}
                          </div>
                        )
                      })()}
                      <p className="text-[11px] text-ink-2 font-medium tabular-nums">
                        {fmt12(claim.shift.start_time)} – {fmt12(claim.shift.end_time)}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <CredentialBadge credential={claim.shift.credential_required} className="text-[10px]" />
                        <TierBadge tier={claim.shift.priority_tier} label={`Tier ${claim.shift.priority_tier}`} className="text-[10px]" />
                      </div>
                      {claim.agencies && (
                        <p className="text-[10px] text-ink-3 mt-1">{claim.agencies.name}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="card border-dashed p-4 text-center">
              <p className="text-xs text-ink-3">Select a day to see shifts</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
