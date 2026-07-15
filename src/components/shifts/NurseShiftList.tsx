'use client'

import { useState, useMemo } from 'react'
import ShiftCard, { type ShiftCardData } from '@/components/shifts/ShiftCard'
import { useDoubleBookingCheck } from '@/hooks/useDoubleBookingCheck'
import { useDriveTime } from '@/hooks/useDriveTime'
import { calculateTotalShiftPay, type PayTierConfig } from '@/lib/utils/pay'

export type AgencyOption = {
  agency_id: string
  agency_name: string
  base_pay_rate: number | null
  tier_configs: PayTierConfig[]
}

type ClaimState = 'idle' | 'warning' | 'submitting' | 'claimed' | 'error'
type ViewMode = 'calendar' | 'list'

// ── Tier dot colours ──────────────────────────────────────────────────────────
const TIER_DOT: Record<number, string> = {
  1: '#94A3B8',
  2: '#F59E0B',
  3: '#EF4444',
}

const CRED_STYLE: Record<string, { bg: string; color: string }> = {
  CNA:    { bg: '#CCFBF1', color: '#0F766E' },
  CMA:    { bg: '#F3E8FF', color: '#7C3AED' },
  LPN:    { bg: '#DBEAFE', color: '#1D4ED8' },
  LPN_IV: { bg: '#E0E7FF', color: '#4338CA' },
  RN:     { bg: '#FEE2E2', color: '#B91C1C' },
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function fmt12(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

interface Props {
  shifts: ShiftCardData[]
  agencies: AgencyOption[]
  nurseProfileId: string
  alreadyClaimedIds: Set<string>
  initialDriveTimes?: Record<string, number | null>
  nurseOrigin?: string
}

export default function NurseShiftList({ shifts, agencies, nurseProfileId, alreadyClaimedIds, initialDriveTimes = {}, nurseOrigin }: Props) {
  const today = new Date()
  const [viewMode, setViewMode] = useState<ViewMode>('calendar')
  const [calYear, setCalYear]   = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [filterFacility, setFilterFacility] = useState<string | null>(null)

  const [selectedAgencyId, setSelectedAgencyId] = useState(agencies[0]?.agency_id ?? '')
  const [claimStates, setClaimStates]           = useState<Record<string, ClaimState>>({})
  const [conflictModal, setConflictModal]       = useState<{ shift: ShiftCardData; message: string } | null>(null)

  const { check: checkDoubleBooking } = useDoubleBookingCheck(nurseProfileId)

  const uniqueFacilityIds = useMemo(() => (
    [...new Set(shifts.map(s => s.facility_id).filter((id): id is string => !!id))]
  ), [shifts])
  const uniquePlaceholderFacilityIds = useMemo(() => (
    [...new Set(shifts.map(s => s.placeholder_facility_id).filter((id): id is string => !!id))]
  ), [shifts])
  const driveMinutes = useDriveTime(uniqueFacilityIds, uniquePlaceholderFacilityIds, initialDriveTimes)

  const selectedAgency = agencies.find(a => a.agency_id === selectedAgencyId)

  // ── Facility list for filter pills ───────────────────────────────────────────
  const facilities = useMemo(() => {
    const seen = new Map<string, string>()
    for (const s of shifts) {
      if (s.facility_id && s.facility_name && !seen.has(s.facility_id)) {
        seen.set(s.facility_id, s.facility_name)
      }
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }))
  }, [shifts])

  // ── Active (unclaimed) shifts, optionally filtered by facility ───────────────
  const activeShifts = useMemo(() =>
    shifts.filter(s => !alreadyClaimedIds.has(s.id) && claimStates[s.id] !== 'claimed')
  , [shifts, alreadyClaimedIds, claimStates])

  const filteredShifts = useMemo(() =>
    filterFacility ? activeShifts.filter(s => s.facility_id === filterFacility) : activeShifts
  , [activeShifts, filterFacility])

  // ── Group by date ─────────────────────────────────────────────────────────────
  const shiftsByDate = useMemo(() => {
    const map: Record<string, ShiftCardData[]> = {}
    for (const s of filteredShifts) {
      if (!map[s.shift_date]) map[s.shift_date] = []
      map[s.shift_date].push(s)
    }
    return map
  }, [filteredShifts])

  // ── Calendar grid math ────────────────────────────────────────────────────────
  const firstDow    = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const todayStr    = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
    setSelectedDate(null)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
    setSelectedDate(null)
  }

  // ── Claim handlers (unchanged from before) ────────────────────────────────────
  function setClaimState(shiftId: string, state: ClaimState) {
    setClaimStates(prev => ({ ...prev, [shiftId]: state }))
  }

  async function handleClaim(shift: ShiftCardData) {
    if (!selectedAgency) return
    setClaimState(shift.id, 'submitting')
    const conflict = await checkDoubleBooking(shift.shift_date, shift.start_time, shift.end_time)
    if (conflict) {
      setClaimState(shift.id, 'idle')
      const msg = `You already have a confirmed shift from ${fmt12(conflict.start_time)} to ${fmt12(conflict.end_time)} on this date.`
      setConflictModal({ shift, message: msg })
      return
    }
    await submitClaim(shift.id, selectedAgency.agency_id)
  }

  async function submitClaim(shiftId: string, agencyId: string) {
    setClaimState(shiftId, 'submitting')
    try {
      const res = await fetch('/api/shifts/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift_id: shiftId, agency_id: agencyId }),
      })
      if (res.ok) {
        setClaimState(shiftId, 'claimed')
      } else {
        const d = await res.json()
        if (res.status === 409 && d.error?.toLowerCase().includes('double booking')) {
          // Server caught a double-booking the client check missed — show the modal
          setClaimState(shiftId, 'idle')
          const shift = shifts.find(s => s.id === shiftId)
          if (shift) setConflictModal({ shift, message: 'You already have a confirmed shift that overlaps this time.' })
        } else {
          console.error('[claim]', d.error)
          setClaimState(shiftId, 'error')
        }
      }
    } catch { setClaimState(shiftId, 'error') }
  }

  function handleModalCancel() {
    setConflictModal(null)
  }

  const dayPanelShifts = selectedDate ? (shiftsByDate[selectedDate] ?? []) : []
  const justClaimed    = shifts.filter(s => claimStates[s.id] === 'claimed')
  const alreadyClaimed = shifts.filter(s => alreadyClaimedIds.has(s.id))

  // ── Shared shift card renderer ────────────────────────────────────────────────
  function renderCard(shift: ShiftCardData) {
    return (
      <ShiftCard
        key={shift.id}
        shift={shift}
        basePay={selectedAgency?.base_pay_rate ?? null}
        tierConfigs={selectedAgency?.tier_configs ?? []}
        claimStatus={claimStates[shift.id] ?? 'idle'}
        conflictWarning={null}
        driveMinutes={(shift.facility_id ?? shift.placeholder_facility_id) ? (driveMinutes[shift.facility_id ?? shift.placeholder_facility_id!] ?? null) : null}
        nurseOrigin={nurseOrigin}
        onClaim={() => handleClaim(shift)}
        onConfirmClaim={() => {}}
        onDismissWarning={() => {}}
      />
    )
  }

  return (
    <div>
      {/* ── Top controls ── */}
      <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
        {/* Agency selector */}
        {agencies.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-[13px]" style={{ color: '#5B6B80' }}>Claiming as:</span>
            <div className="flex gap-1">
              {agencies.map(a => (
                <button key={a.agency_id} onClick={() => setSelectedAgencyId(a.agency_id)}
                  className="px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all"
                  style={{
                    background: selectedAgencyId === a.agency_id ? '#0D9488' : '#fff',
                    color:      selectedAgencyId === a.agency_id ? '#fff'    : '#5B6B80',
                    border:     `1px solid ${selectedAgencyId === a.agency_id ? '#0D9488' : '#E4EAF0'}`,
                  }}>
                  {a.agency_name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* View toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg ml-auto" style={{ background: '#F4F7FA' }}>
          {(['calendar', 'list'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setViewMode(v)}
              className="px-3 py-1.5 text-[13px] font-medium rounded-md capitalize transition-all"
              style={{
                background: viewMode === v ? '#fff' : 'transparent',
                color:      viewMode === v ? '#0D1B2A' : '#94A3B8',
                boxShadow:  viewMode === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
              {v === 'calendar' ? '📅 Calendar' : '☰ List'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Facility filter dropdown ── */}
      {facilities.length > 1 && (
        <div className="flex items-center gap-2 mb-5">
          <label className="text-[12px] font-semibold uppercase tracking-[0.07em] flex-shrink-0" style={{ color: '#94A3B8' }}>
            Facility:
          </label>
          <select
            value={filterFacility ?? ''}
            onChange={e => setFilterFacility(e.target.value || null)}
            className="px-3 py-2 rounded-lg text-[13px] outline-none transition-all"
            style={{ border: '1px solid #E4EAF0', background: '#fff', color: '#0D1B2A', minWidth: 220 }}
            onFocus={e => { (e.target as HTMLElement).style.borderColor = '#0D9488' }}
            onBlur={e => { (e.target as HTMLElement).style.borderColor = '#E4EAF0' }}
          >
            <option value="">All Facilities</option>
            {facilities.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Pending claims ── */}
      {(justClaimed.length > 0 || alreadyClaimed.length > 0) && (
        <div className="mb-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] mb-3" style={{ color: '#94A3B8' }}>
            Pending Claims ({justClaimed.length + alreadyClaimed.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...justClaimed, ...alreadyClaimed].map(shift => (
              <ShiftCard key={shift.id} shift={shift}
                basePay={selectedAgency?.base_pay_rate ?? null}
                tierConfigs={selectedAgency?.tier_configs ?? []}
                claimStatus="claimed" conflictWarning={null}
                onClaim={() => {}} onConfirmClaim={() => {}} onDismissWarning={() => {}} />
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CALENDAR VIEW
      ══════════════════════════════════════════════════════════════════════ */}
      {viewMode === 'calendar' && (
        <div data-tour-id="nurse-calendar" className="flex gap-5 items-start">
          {/* Calendar */}
          {/* ── Calendar card ── */}
          <div className="flex-1 min-w-0" style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)' }}>

            {/* Navy header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#0D1B2A' }}>
              <button onClick={prevMonth} aria-label="Previous month" style={{ width: 30, height: 30, border: '1px solid rgba(255,255,255,0.10)', borderRadius: 7, background: 'rgba(255,255,255,0.05)', color: '#7B93AB', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                ‹
              </button>
              <span className="font-serif" style={{ fontSize: 17, color: '#F1F5F9' }}>
                {MONTH_NAMES[calMonth]} <span style={{ color: '#4A6080', fontWeight: 400 }}>{calYear}</span>
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
              {Array.from({ length: firstDow }).map((_, i) => (
                <div key={`e-${i}`} style={{ minHeight: 74, borderRadius: 10 }} />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day     = i + 1
                const dateStr = toDateStr(calYear, calMonth, day)
                const dayShifts = shiftsByDate[dateStr] ?? []
                const isToday    = dateStr === todayStr
                const isSelected = dateStr === selectedDate
                const isPast     = dateStr < todayStr
                const hasShifts  = dayShifts.length > 0
                const maxTier    = dayShifts.reduce((max, s) => Math.max(max, s.priority_tier), 0)
                const hasTealRing = isToday || isSelected

                return (
                  <button
                    key={day}
                    onClick={() => !isPast && setSelectedDate(prev => prev === dateStr ? null : dateStr)}
                    disabled={isPast}
                    style={{
                      minHeight: 74,
                      borderRadius: 10,
                      padding: '8px 8px 7px',
                      background: '#fff',
                      border: 'none',
                      cursor: isPast ? 'default' : 'pointer',
                      transition: 'box-shadow .12s, transform .12s, background .12s',
                      opacity: isPast ? 0.52 : 1,
                      boxShadow: hasTealRing ? 'inset 0 0 0 2.5px #0D9488' : undefined,
                      textAlign: 'left',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                    onMouseEnter={e => {
                      if (!isPast && !hasTealRing) {
                        const el = e.currentTarget as HTMLElement
                        el.style.background = '#EBF5F4'
                        el.style.transform = 'translateY(-1px)'
                        el.style.boxShadow = '0 3px 8px rgba(13,148,136,.10)'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isPast && !hasTealRing) {
                        const el = e.currentTarget as HTMLElement
                        el.style.background = '#fff'
                        el.style.transform = ''
                        el.style.boxShadow = ''
                      }
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', marginBottom: 5, color: isToday ? '#0D9488' : '#0D1B2A' }}>
                      {day}
                    </span>
                    {hasShifts && (
                      <span style={{ fontSize: 10, fontWeight: 700, width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: TIER_DOT[maxTier] ?? '#94A3B8', color: '#fff' }}>
                        {dayShifts.length}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '11px 20px', borderTop: '1px solid #E4EAF0', background: '#fff' }}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: '#94A3B8' }}>Tier:</span>
              {[{ tier: 1, label: 'Standard', color: '#94A3B8' }, { tier: 2, label: 'Priority', color: '#F59E0B' }, { tier: 3, label: 'Urgent', color: '#EF4444' }].map(t => (
                <div key={t.tier} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, display: 'inline-block' }} />
                  <span style={{ fontSize: 11, color: '#5B6B80' }}>{t.label}</span>
                </div>
              ))}
            </div>

          </div>

          {/* Day panel */}
          {selectedDate ? (
            <div data-tour-id="nurse-day-panel" className="w-80 flex-shrink-0">
              <div className="bg-white rounded-xl overflow-hidden sticky top-4" style={{ border: '1px solid #E4EAF0' }}>
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <div>
                    <p className="font-semibold text-[14px]" style={{ color: '#0D1B2A' }}>
                      {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-[12px] mt-0.5" style={{ color: '#94A3B8' }}>
                      {dayPanelShifts.length} shift{dayPanelShifts.length !== 1 ? 's' : ''} available
                    </p>
                  </div>
                  <button onClick={() => setSelectedDate(null)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[16px]"
                    style={{ background: '#F4F7FA', color: '#5B6B80' }}>
                    ×
                  </button>
                </div>

                <div className="p-3 space-y-3 max-h-[70vh] overflow-y-auto">
                  {dayPanelShifts.length === 0 ? (
                    <p className="text-center text-[13px] py-6" style={{ color: '#94A3B8' }}>
                      No shifts available on this day.
                    </p>
                  ) : (
                    dayPanelShifts.map(shift => {
                      const cred = CRED_STYLE[shift.credential_required]
                      const state = claimStates[shift.id] ?? 'idle'
                      return (
                        <div key={shift.id} className="rounded-xl overflow-hidden"
                          style={{ border: `1px solid #E4EAF0`, borderLeft: `3px solid ${TIER_DOT[shift.priority_tier] ?? '#94A3B8'}` }}>
                          <div className="px-3 pt-3 pb-2">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className="font-semibold text-[13px] leading-snug" style={{ color: '#0D1B2A' }}>
                                {shift.facility_name ?? 'Unknown Facility'}
                              </p>
                              {cred && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                  style={{ background: cred.bg, color: cred.color }}>
                                  {shift.credential_required}
                                </span>
                              )}
                            </div>
                            <p className="text-[12px]" style={{ color: '#5B6B80' }}>
                              {fmt12(shift.start_time)} – {fmt12(shift.end_time)}
                            </p>
                            {(shift.facility_address || shift.facility_city || shift.facility_state) && (() => {
                              const dest = encodeURIComponent([shift.facility_address, shift.facility_city, shift.facility_state].filter(Boolean).join(', '))
                              const mapsUrl = `https://www.google.com/maps/dir/?api=1${nurseOrigin ? `&origin=${encodeURIComponent(nurseOrigin)}` : ''}&destination=${dest}`
                              const driveTimeId = shift.facility_id ?? shift.placeholder_facility_id
                              const driveTime = driveTimeId ? driveMinutes[driveTimeId] : null
                              return (
                                <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                                  className="block mt-0.5 hover:underline"
                                  style={{ color: '#0D9488' }}
                                  onClick={e => e.stopPropagation()}>
                                  {shift.facility_address && (
                                    <span className="block text-[11px]">{shift.facility_address}</span>
                                  )}
                                  <span className="text-[11px]">
                                    {[shift.facility_city, shift.facility_state].filter(Boolean).join(', ')}
                                    {driveTime != null && <span> · ~{driveTime} min away</span>}
                                  </span>
                                </a>
                              )
                            })()}
                            {selectedAgency?.base_pay_rate && (() => {
                              const [sh, sm] = shift.start_time.split(':').map(Number)
                              const [eh, em] = shift.end_time.split(':').map(Number)
                              let mins = eh * 60 + em - (sh * 60 + sm)
                              if (mins < 0) mins += 24 * 60
                              const hours = mins / 60
                              const total = calculateTotalShiftPay(
                                selectedAgency.base_pay_rate,
                                shift.priority_tier as 1 | 2 | 3,
                                selectedAgency.tier_configs,
                                hours
                              )
                              return (
                                <p className="text-[12px] font-semibold mt-1" style={{ color: '#0D9488' }}>
                                  ${total.toFixed(2)} total
                                </p>
                              )
                            })()}
                          </div>
                          <div className="px-3 pb-3">
                            {state === 'claimed' ? (
                              <div className="w-full py-2 text-center text-[12px] font-semibold rounded-lg"
                                style={{ background: '#DCFCE7', color: '#15803D' }}>
                                Claimed ✓
                              </div>
                            ) : (
                              <button
                                data-tour-id="claim-shift-btn"
                                onClick={() => handleClaim(shift)}
                                disabled={state === 'submitting'}
                                className="w-full py-2 text-[12px] font-semibold text-white rounded-lg transition-all disabled:opacity-50"
                                style={{ background: '#0D9488' }}
                              >
                                {state === 'submitting' ? 'Claiming…' : 'Claim Shift'}
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="w-80 flex-shrink-0 rounded-xl flex items-center justify-center"
              style={{ border: '2px dashed #E4EAF0', minHeight: 200 }}>
              <p className="text-[13px] text-center px-6" style={{ color: '#94A3B8' }}>
                Click a day with shifts to see what's available
              </p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          LIST VIEW
      ══════════════════════════════════════════════════════════════════════ */}
      {viewMode === 'list' && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] mb-3" style={{ color: '#94A3B8' }}>
            Available Shifts ({filteredShifts.length})
          </p>
          {filteredShifts.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl" style={{ border: '1px solid #E4EAF0' }}>
              <p className="text-[14px]" style={{ color: '#5B6B80' }}>No available shifts match your credentials right now.</p>
              <p className="text-[12px] mt-1" style={{ color: '#94A3B8' }}>Check back later — facilities post shifts daily.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredShifts.map(renderCard)}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CONFLICT MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {conflictModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(13,27,42,0.5)' }}
          onClick={handleModalCancel}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={e => e.stopPropagation()}
          >
            {/* Icon + title */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: '#FEF3C7' }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2.5L17.5 15.5H2.5L10 2.5Z" stroke="#D97706" strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M10 8.5V11" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="10" cy="13.5" r="0.75" fill="#D97706"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-[15px]" style={{ color: '#0D1B2A' }}>
                  Schedule Conflict
                </h3>
                <p className="text-[13px] mt-1" style={{ color: '#5B6B80' }}>
                  {conflictModal.message}
                </p>
              </div>
            </div>

            {/* Shift being claimed */}
            <div className="rounded-xl px-4 py-3 mb-5" style={{ background: '#F4F7FA', border: '1px solid #E4EAF0' }}>
              <p className="text-[12px] font-semibold mb-0.5" style={{ color: '#0D1B2A' }}>
                {conflictModal.shift.facility_name ?? 'Unknown Facility'}
              </p>
              <p className="text-[12px]" style={{ color: '#5B6B80' }}>
                {fmt12(conflictModal.shift.start_time)} – {fmt12(conflictModal.shift.end_time)}
              </p>
            </div>

            {/* Actions */}
            <button
              onClick={handleModalCancel}
              className="w-full py-2.5 rounded-xl text-[13px] font-medium transition-colors"
              style={{ background: '#F4F7FA', color: '#5B6B80', border: '1px solid #E4EAF0' }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
