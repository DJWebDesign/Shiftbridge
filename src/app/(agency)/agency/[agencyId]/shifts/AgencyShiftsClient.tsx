'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const CRED_STYLE: Record<string, { bg: string; color: string }> = {
  CNA:    { bg: '#CCFBF1', color: '#0F766E' },
  CMA:    { bg: '#F3E8FF', color: '#7C3AED' },
  LPN:    { bg: '#DBEAFE', color: '#1D4ED8' },
  LPN_IV: { bg: '#E0E7FF', color: '#4338CA' },
  RN:     { bg: '#FEE2E2', color: '#B91C1C' },
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  open:      { bg: '#CCFBF1', color: '#0F766E', label: 'Open'      },
  claimed:   { bg: '#FEF3C7', color: '#B45309', label: 'Claimed'   },
  confirmed: { bg: '#DCFCE7', color: '#15803D', label: 'Confirmed' },
  canceled:  { bg: '#F1F5F9', color: '#5B6B80', label: 'Canceled'  },
}

const TIER_DOT: Record<number, string> = { 1: '#94A3B8', 2: '#F59E0B', 3: '#EF4444' }
const TIER_LABEL: Record<number, string> = { 1: 'Standard', 2: 'Priority', 3: 'Urgent' }

const STATUS_PILL: Record<string, { bg: string; color: string; label: string }> = {
  open:      { bg: '#CCFBF1', color: '#0F766E', label: 'open'      },
  claimed:   { bg: '#FEF3C7', color: '#92400E', label: 'pending'   },
  confirmed: { bg: '#DCFCE7', color: '#166534', label: 'confirmed' },
  canceled:  { bg: '#F1F5F9', color: '#64748B', label: 'canceled'  },
}
const STATUS_ORDER = ['open', 'claimed', 'confirmed', 'canceled']

function fmt12(t: string) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  const [y, mo, day] = d.split('-').map(Number)
  return new Date(y, mo - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export interface Shift {
  id: string
  shift_date: string
  start_time: string
  end_time: string
  credential_required: string
  priority_tier: number
  status: string
  is_placeholder: boolean
  facility_id: string | null
  placeholder_facility_id: string | null
}

interface Facility { id: string; name: string }

interface NurseInfo {
  full_name: string
  phone: string | null
  credential_type: string
  license_number: string
  license_state: string
  license_status: string
  license_expiration: string | null
  cpr_expiration: string | null
  tb_test_date: string | null
  iv_certified: boolean
  covid_vaccinated: boolean
}

interface Props {
  agencyId: string
  initialShifts: Shift[]
  initialYear: number
  initialMonth: number
  connectedFacilities: Facility[]
  placeholderFacilities: Facility[]
  facilityNames: Record<string, string>
}

export default function AgencyShiftsClient({
  agencyId,
  initialShifts,
  initialYear,
  initialMonth,
  connectedFacilities,
  placeholderFacilities,
  facilityNames,
}: Props) {
  const today = new Date()
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())

  const [year, setYear]           = useState(initialYear)
  const [month, setMonth]         = useState(initialMonth)
  const [shifts, setShifts]       = useState<Shift[]>(initialShifts)
  const [loading, setLoading]     = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [filterFacilityId, setFilterFacilityId] = useState<string>('')
  // Nurse info cache for claimed placeholder shifts
  const [nurseInfoMap, setNurseInfoMap] = useState<Record<string, NurseInfo>>({})

  // Review state for claimed placeholder shifts
  const [reviewShiftId, setReviewShiftId] = useState<string | null>(null)
  const [reviewAction, setReviewAction]   = useState<'confirm' | 'decline' | null>(null)
  const [reviewReopen, setReviewReopen]   = useState(true)
  const [reviewingId, setReviewingId]     = useState<string | null>(null)
  const [reviewError, setReviewError]     = useState<string | null>(null)

  // All facilities for the dropdown
  const allFacilities: Facility[] = useMemo(() => [
    ...connectedFacilities,
    ...placeholderFacilities,
  ], [connectedFacilities, placeholderFacilities])

  // Filtered shifts
  const visibleShifts = useMemo(() => {
    if (!filterFacilityId) return shifts
    return shifts.filter(s =>
      s.facility_id === filterFacilityId ||
      s.placeholder_facility_id === filterFacilityId
    )
  }, [shifts, filterFacilityId])

  // Group by date
  const shiftsByDate = useMemo(() => {
    const map: Record<string, Shift[]> = {}
    for (const s of visibleShifts) {
      if (!map[s.shift_date]) map[s.shift_date] = []
      map[s.shift_date].push(s)
    }
    return map
  }, [visibleShifts])

  const firstDow    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  async function loadMonth(y: number, m: number) {
    setLoading(true)
    const from = `${y}-${String(m + 1).padStart(2, '0')}-01`
    const to   = `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m + 1, 0).getDate()}`
    const supabase = createClient()

    // Fetch real facility shifts
    const facilityIds = connectedFacilities.map(f => f.id)
    const phIds       = placeholderFacilities.map(f => f.id)

    const queries: PromiseLike<{ data: Shift[] | null }>[] = []

    if (facilityIds.length > 0) {
      queries.push(
        supabase.from('shifts').select('id,shift_date,start_time,end_time,credential_required,priority_tier,status,is_placeholder,facility_id,placeholder_facility_id')
          .in('facility_id', facilityIds).gte('shift_date', from).lte('shift_date', to)
          .then(r => ({ data: (r.data ?? []) as Shift[] }))
      )
    }
    if (phIds.length > 0) {
      queries.push(
        supabase.from('shifts').select('id,shift_date,start_time,end_time,credential_required,priority_tier,status,is_placeholder,facility_id,placeholder_facility_id')
          .in('placeholder_facility_id', phIds).gte('shift_date', from).lte('shift_date', to)
          .then(r => ({ data: (r.data ?? []) as Shift[] }))
      )
    }

    const results = await Promise.all(queries)
    const combined = results.flatMap(r => r.data ?? [])
    // Deduplicate by id
    const seen = new Set<string>()
    const deduped = combined.filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true })
    setShifts(deduped)
    setLoading(false)
  }

  // Fetch nurse info for claimed placeholder shifts when a day is selected
  useEffect(() => {
    if (!selectedDate) return
    const claimedPH = (shiftsByDate[selectedDate] ?? []).filter(s => s.is_placeholder && s.status === 'claimed')
    for (const shift of claimedPH) {
      if (nurseInfoMap[shift.id]) continue
      fetch(`/api/shifts/${shift.id}/nurse`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.nurse) setNurseInfoMap(prev => ({ ...prev, [shift.id]: data.nurse })) })
        .catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, shiftsByDate])

  async function handleReviewSubmit(shiftId: string) {
    if (!reviewAction) return
    setReviewingId(shiftId)
    setReviewError(null)
    try {
      const res = await fetch('/api/shifts/placeholder-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift_id: shiftId, action: reviewAction, reopen: reviewReopen }),
      })
      if (res.ok) {
        const newStatus = reviewAction === 'confirm' ? 'confirmed' : reviewReopen ? 'open' : 'canceled'
        setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, status: newStatus } : s))
        setReviewShiftId(null)
        setReviewAction(null)
      } else {
        const data = await res.json()
        setReviewError(data.error ?? 'Something went wrong.')
      }
    } catch {
      setReviewError('Network error.')
    } finally {
      setReviewingId(null)
    }
  }

  function prevMonth() {
    const y = month === 0 ? year - 1 : year
    const m = month === 0 ? 11 : month - 1
    setYear(y); setMonth(m); setSelectedDate(null)
    loadMonth(y, m)
  }

  function nextMonth() {
    const y = month === 11 ? year + 1 : year
    const m = month === 11 ? 0 : month + 1
    setYear(y); setMonth(m); setSelectedDate(null)
    loadMonth(y, m)
  }

  const dayPanelShifts = selectedDate ? (shiftsByDate[selectedDate] ?? []) : []

  function getFacilityName(s: Shift) {
    const id = s.facility_id ?? s.placeholder_facility_id
    return id ? (facilityNames[id] ?? 'Unknown') : 'Unknown'
  }

  return (
    <div className="space-y-5">
      {/* Controls row */}
      <div className="flex items-center gap-4 flex-wrap">
        {allFacilities.length > 1 && (
          <div className="flex items-center gap-2">
            <label className="text-[12px] font-semibold uppercase tracking-[0.07em] flex-shrink-0"
              style={{ color: '#94A3B8' }}>Facility:</label>
            <select
              value={filterFacilityId}
              onChange={e => { setFilterFacilityId(e.target.value); setSelectedDate(null) }}
              className="px-3 py-2 rounded-lg text-[13px] outline-none"
              style={{ border: '1px solid #E4EAF0', background: '#fff', color: '#0D1B2A', minWidth: 220 }}
              onFocus={e => { (e.target as HTMLElement).style.borderColor = '#0D9488' }}
              onBlur={e => { (e.target as HTMLElement).style.borderColor = '#E4EAF0' }}
            >
              <option value="">All Facilities</option>
              {connectedFacilities.length > 0 && (
                <optgroup label="Connected">
                  {connectedFacilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </optgroup>
              )}
              {placeholderFacilities.length > 0 && (
                <optgroup label="Placeholder">
                  {placeholderFacilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </optgroup>
              )}
            </select>
          </div>
        )}
        {loading && <span className="text-[12px]" style={{ color: '#94A3B8' }}>Loading…</span>}
      </div>

      {/* Calendar + day panel */}
      <div className="flex gap-5 items-start">

        {/* ── Calendar card ── */}
        <div className="flex-1 min-w-0" style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)' }}>

          {/* Navy header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#0D1B2A' }}>
            <button onClick={prevMonth} aria-label="Previous month" style={{ width: 30, height: 30, border: '1px solid rgba(255,255,255,0.10)', borderRadius: 7, background: 'rgba(255,255,255,0.05)', color: '#7B93AB', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
              ‹
            </button>
            <span className="font-serif" style={{ fontSize: 17, color: '#F1F5F9' }}>
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
            {Array.from({ length: firstDow }).map((_, i) => (
              <div key={`e${i}`} style={{ minHeight: 74, borderRadius: 10 }} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day        = i + 1
              const dateStr    = toDateStr(year, month, day)
              const dayShifts  = shiftsByDate[dateStr] ?? []
              const isToday    = dateStr === todayStr
              const isSelected = dateStr === selectedDate
              const hasTealRing = isToday || isSelected
              const counts: Record<string, number> = {}
              for (const s of dayShifts) counts[s.status] = (counts[s.status] ?? 0) + 1

              return (
                <button key={day}
                  onClick={() => setSelectedDate(prev => prev === dateStr ? null : dateStr)}
                  style={{
                    minHeight: 74,
                    borderRadius: 10,
                    padding: '8px 8px 7px',
                    background: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'box-shadow .12s, transform .12s, background .12s',
                    boxShadow: hasTealRing ? 'inset 0 0 0 2.5px #0D9488' : undefined,
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                  onMouseEnter={e => {
                    if (!hasTealRing) {
                      const el = e.currentTarget as HTMLElement
                      el.style.background = '#EBF5F4'
                      el.style.transform = 'translateY(-1px)'
                      el.style.boxShadow = '0 3px 8px rgba(13,148,136,.10)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!hasTealRing) {
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
                  {dayShifts.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {STATUS_ORDER.filter(s => counts[s] > 0).map(status => {
                        const pill = STATUS_PILL[status]
                        return (
                          <span key={status} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, whiteSpace: 'nowrap', width: 'fit-content', lineHeight: 1.5, background: pill.bg, color: pill.color }}>
                            {counts[status]} {pill.label}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '11px 22px', borderTop: '1px solid #E4EAF0', background: '#fff' }}>
            {[{ color: '#0D9488', label: 'Open' }, { color: '#F59E0B', label: 'Pending' }, { color: '#22C55E', label: 'Confirmed' }, { color: '#94A3B8', label: 'Canceled' }].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
                <span style={{ fontSize: 11, color: '#5B6B80', fontWeight: 500 }}>{label}</span>
              </div>
            ))}
          </div>

        </div>

        {/* Day panel */}
        {selectedDate ? (
          <div className="w-80 flex-shrink-0">
            <div className="bg-white rounded-xl overflow-hidden sticky top-4" style={{ border: '1px solid #E4EAF0' }}>
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
                <div>
                  <p className="font-semibold text-[14px]" style={{ color: '#0D1B2A' }}>
                    {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </p>
                  <p className="text-[12px] mt-0.5" style={{ color: '#94A3B8' }}>
                    {dayPanelShifts.length} shift{dayPanelShifts.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button onClick={() => setSelectedDate(null)}
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: '#F4F7FA', color: '#5B6B80' }}>×</button>
              </div>

              <div className="p-3 space-y-2 max-h-[70vh] overflow-y-auto">
                {dayPanelShifts.length === 0 ? (
                  <p className="text-center text-[13px] py-6" style={{ color: '#94A3B8' }}>No shifts on this day.</p>
                ) : (
                  dayPanelShifts.map(s => {
                    const cred   = CRED_STYLE[s.credential_required]
                    const status = STATUS_STYLE[s.status] ?? { bg: '#F1F5F9', color: '#5B6B80', label: s.status }
                    const isPH   = s.is_placeholder
                    const isClaimedPH = isPH && s.status === 'claimed'
                    const isReviewing = reviewShiftId === s.id
                    return (
                      <div key={s.id} className="rounded-xl overflow-hidden"
                        style={{ border: '1px solid #E4EAF0', borderLeft: `3px solid ${TIER_DOT[s.priority_tier] ?? '#94A3B8'}` }}>
                        <div className="px-3 py-3 space-y-1.5">
                          {/* Facility + placeholder badge */}
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-[13px] leading-snug" style={{ color: '#0D1B2A' }}>
                              {getFacilityName(s)}
                            </p>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {isPH && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                  style={{ background: '#E0E7FF', color: '#4338CA' }}>PH</span>
                              )}
                              {cred && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                  style={{ background: cred.bg, color: cred.color }}>
                                  {s.credential_required}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Time */}
                          <p className="text-[12px]" style={{ color: '#5B6B80' }}>
                            {fmt12(s.start_time)} – {fmt12(s.end_time)}
                          </p>

                          {/* Status + tier */}
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: status.bg, color: status.color }}>
                              {status.label}
                            </span>
                            <span className="text-[11px]" style={{ color: '#94A3B8' }}>
                              {TIER_LABEL[s.priority_tier] ?? 'Standard'}
                            </span>
                          </div>

                          {/* Nurse info for claimed placeholder shifts */}
                          {isClaimedPH && nurseInfoMap[s.id] && (() => {
                            const n = nurseInfoMap[s.id]
                            const tbExpiry = n.tb_test_date
                              ? new Date(new Date(n.tb_test_date).getTime() + 365*24*60*60*1000).toISOString().split('T')[0]
                              : null
                            return (
                              <div className="rounded-lg px-2.5 py-2 space-y-1" style={{ background: '#F8FAFC', border: '1px solid #E4EAF0' }}>
                                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Claimed by</p>
                                <p className="text-[13px] font-semibold" style={{ color: '#0D1B2A' }}>{n.full_name}</p>
                                {[
                                  { label: 'License', value: `${n.license_number} (${n.license_state}) — ${n.license_status}` },
                                  { label: 'Phone',   value: n.phone ?? '—' },
                                  { label: 'CPR Exp', value: fmtDate(n.cpr_expiration) },
                                  { label: 'TB Until', value: fmtDate(tbExpiry) },
                                ].map(({ label, value }) => (
                                  <div key={label} className="flex justify-between gap-2">
                                    <span className="text-[11px]" style={{ color: '#94A3B8' }}>{label}</span>
                                    <span className="text-[11px] text-right" style={{ color: '#374151' }}>{value}</span>
                                  </div>
                                ))}
                              </div>
                            )
                          })()}

                          {/* Confirm / Decline buttons for claimed placeholder shifts */}
                          {isClaimedPH && !isReviewing && (
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => { setReviewShiftId(s.id); setReviewAction('confirm'); setReviewReopen(true); setReviewError(null) }}
                                className="flex-1 text-[12px] font-semibold py-1.5 rounded-lg transition-colors"
                                style={{ background: '#DCFCE7', color: '#15803D' }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#BBF7D0')}
                                onMouseLeave={e => (e.currentTarget.style.background = '#DCFCE7')}
                              >
                                ✓ Confirm
                              </button>
                              <button
                                onClick={() => { setReviewShiftId(s.id); setReviewAction('decline'); setReviewReopen(true); setReviewError(null) }}
                                className="flex-1 text-[12px] font-semibold py-1.5 rounded-lg transition-colors"
                                style={{ background: '#FEE2E2', color: '#B91C1C' }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#FECACA')}
                                onMouseLeave={e => (e.currentTarget.style.background = '#FEE2E2')}
                              >
                                ✕ Decline
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Confirm prompt */}
                        {isReviewing && reviewAction === 'confirm' && (
                          <div className="px-3 py-3 space-y-2" style={{ background: '#F0FDF4', borderTop: '1px solid #BBF7D0' }}>
                            <p className="text-[12px] font-semibold" style={{ color: '#15803D' }}>Confirm this nurse for the shift?</p>
                            <p className="text-[11px]" style={{ color: '#166534' }}>The nurse will be notified by SMS and in-app.</p>
                            {reviewError && <p className="text-[11px]" style={{ color: '#DC2626' }}>{reviewError}</p>}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => { setReviewShiftId(null); setReviewAction(null) }}
                                disabled={reviewingId === s.id}
                                className="text-[12px] disabled:opacity-50"
                                style={{ color: '#5B6B80' }}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleReviewSubmit(s.id)}
                                disabled={reviewingId === s.id}
                                className="text-[12px] font-semibold px-3 py-1 rounded-lg disabled:opacity-50 transition-colors"
                                style={{ background: '#16A34A', color: '#fff' }}
                              >
                                {reviewingId === s.id ? '…' : 'Yes, Confirm'}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Decline prompt */}
                        {isReviewing && reviewAction === 'decline' && (
                          <div className="px-3 py-3 space-y-2" style={{ background: '#FFF1F2', borderTop: '1px solid #FECDD3' }}>
                            <p className="text-[12px] font-semibold" style={{ color: '#BE123C' }}>Decline this nurse?</p>
                            <label className="flex items-start gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={reviewReopen}
                                onChange={e => setReviewReopen(e.target.checked)}
                                className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300"
                              />
                              <span className="text-[11px]" style={{ color: '#9F1239' }}>
                                Reopen shift for reassignment
                                {!reviewReopen && <span style={{ color: '#DC2626' }}> (will be permanently closed)</span>}
                              </span>
                            </label>
                            {reviewError && <p className="text-[11px]" style={{ color: '#DC2626' }}>{reviewError}</p>}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => { setReviewShiftId(null); setReviewAction(null) }}
                                disabled={reviewingId === s.id}
                                className="text-[12px] disabled:opacity-50"
                                style={{ color: '#5B6B80' }}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleReviewSubmit(s.id)}
                                disabled={reviewingId === s.id}
                                className="text-[12px] font-semibold px-3 py-1 rounded-lg disabled:opacity-50 transition-colors"
                                style={{ background: '#DC2626', color: '#fff' }}
                              >
                                {reviewingId === s.id ? '…' : 'Yes, Decline'}
                              </button>
                            </div>
                          </div>
                        )}
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
              Click a day to see shifts
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
