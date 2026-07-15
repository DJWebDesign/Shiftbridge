'use client'

import { useState, useEffect } from 'react'
import PlaceholderShiftForm from '@/components/placeholders/PlaceholderShiftForm'
import type { Database } from '@/lib/supabase/types'
import { CredentialBadge } from '@/components/ui/Badge'

interface NurseInfo {
  full_name: string
  email: string | null
  phone: string | null
  credential_type: string
  license_number: string
  license_state: string
  license_status: string
  license_expiration: string | null
  iv_certified: boolean
  cpr_expiration: string | null
  tb_test_date: string | null
  covid_vaccinated: boolean
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function NurseModal({ nurse, onClose }: { nurse: NurseInfo; onClose: () => void }) {
  const initials = nurse.full_name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
  const tbExpiry = nurse.tb_test_date
    ? new Date(new Date(nurse.tb_test_date).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(13,27,42,0.5)' }}
      onClick={onClose}>
      <div className="card shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-4 border-b border-line">
          <div className="flex items-center justify-between mb-3">
            <h3 className="section-title text-[18px]">Confirmed Nurse</h3>
            <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-[16px] bg-background text-ink-2">×</button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0 bg-brand">{initials}</div>
            <div>
              <p className="font-semibold text-[14px] text-ink">{nurse.full_name}</p>
              <CredentialBadge credential={nurse.credential_type} className="text-[11px] font-bold" />
            </div>
          </div>
        </div>
        <div className="px-5 py-4 space-y-2">
          {[
            { label: 'License',       value: `${nurse.license_number} (${nurse.license_state}) — ${nurse.license_status}` },
            { label: 'Expires',       value: fmtDate(nurse.license_expiration) },
            { label: 'Phone',         value: nurse.phone ?? '—' },
            { label: 'CPR',           value: fmtDate(nurse.cpr_expiration) },
            { label: 'TB Valid Until',value: fmtDate(tbExpiry) },
            { label: 'COVID',         value: nurse.covid_vaccinated ? 'Vaccinated' : 'Not vaccinated' },
            { label: 'IV Cert',       value: nurse.iv_certified ? 'Yes' : 'No' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-baseline justify-between gap-4">
              <span className="text-[11px] font-semibold uppercase tracking-wide flex-shrink-0 text-ink-3">{label}</span>
              <span className="text-[13px] text-right text-ink tabular-nums">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

type Shift = Database['public']['Tables']['shifts']['Row']

interface PlaceholderFacility {
  id: string
  name: string
}

interface Props {
  date: string
  shifts: Shift[]
  facilityNames: Record<string, string>
  placeholderFacilities: PlaceholderFacility[]
  onClose: () => void
  onShiftPosted: (shifts: Shift[]) => void
  onShiftCanceled: (shiftId: string) => void
  onShiftConfirmed: (shiftId: string) => void
  onShiftReopened: (shiftId: string) => void
}

const STATUS_STYLES: Record<string, string> = {
  open:      'bg-brand-tint text-brand',
  claimed:   'bg-amber-100 text-amber-800',
  confirmed: 'bg-green-100 text-green-800',
  canceled:  'bg-gray-100 text-gray-600',
  filled:    'bg-purple-100 text-purple-800',
}

const CREDENTIAL_LABELS: Record<string, string> = {
  CNA: 'CNA', CMA: 'CMA', LPN: 'LPN', LPN_IV: 'LPN (IV)', RN: 'RN',
}

function fmt12(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

function formatDate(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number)
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

export default function AgencyShiftDayPanel({
  date, shifts, facilityNames, placeholderFacilities, onClose, onShiftPosted, onShiftCanceled, onShiftConfirmed, onShiftReopened,
}: Props) {
  const [showPostForm, setShowPostForm] = useState(false)
  const [nurseModal, setNurseModal] = useState<NurseInfo | null>(null)
  const [nurseInfoMap, setNurseInfoMap] = useState<Record<string, NurseInfo>>({})
  const [loadingShiftId, setLoadingShiftId] = useState<string | null>(null)
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  // Review state for claimed placeholder shifts (confirm/decline)
  const [reviewShiftId, setReviewShiftId] = useState<string | null>(null)
  const [reviewAction, setReviewAction] = useState<'confirm' | 'decline' | null>(null)
  const [reviewReopen, setReviewReopen] = useState(true)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewError, setReviewError] = useState<string | null>(null)

  // Fetch nurse info for any claimed placeholder shifts on this day
  useEffect(() => {
    const claimedPH = shifts.filter(s => s.is_placeholder && s.status === 'claimed')
    for (const shift of claimedPH) {
      if (nurseInfoMap[shift.id]) continue
      fetch(`/api/shifts/${shift.id}/nurse`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.nurse) setNurseInfoMap(prev => ({ ...prev, [shift.id]: data.nurse })) })
        .catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shifts])

  async function handleCancelShift(shiftId: string) {
    setCancelingId(shiftId)
    setCancelError(null)
    try {
      const res = await fetch('/api/shifts/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift_id: shiftId, final: true }),
      })
      if (res.ok) {
        setCancelConfirmId(null)
        onShiftCanceled(shiftId)
      } else {
        const data = await res.json()
        setCancelError(data.error ?? 'Failed to cancel shift.')
        setCancelConfirmId(null)
      }
    } catch {
      setCancelError('Network error.')
      setCancelConfirmId(null)
    } finally {
      setCancelingId(null)
    }
  }

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
        setReviewShiftId(null)
        setReviewAction(null)
        if (reviewAction === 'confirm') {
          onShiftConfirmed(shiftId)
        } else if (reviewReopen) {
          onShiftReopened(shiftId)
        } else {
          onShiftCanceled(shiftId)
        }
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

  async function handleConfirmedClick(shiftId: string) {
    setLoadingShiftId(shiftId)
    try {
      const res = await fetch(`/api/shifts/${shiftId}/nurse`)
      if (res.ok) {
        const data = await res.json()
        setNurseModal(data.nurse)
      }
    } finally {
      setLoadingShiftId(null)
    }
  }

  const activeShifts = shifts.filter(s => s.status !== 'canceled')
  const canceledShifts = shifts.filter(s => s.status === 'canceled')

  const today = new Date().toISOString().split('T')[0]
  const isPast = date < today

  function getFacilityName(shift: Shift): string {
    if (shift.facility_id && facilityNames[shift.facility_id]) {
      return facilityNames[shift.facility_id]
    }
    if (shift.placeholder_facility_id && facilityNames[shift.placeholder_facility_id]) {
      return facilityNames[shift.placeholder_facility_id]
    }
    return shift.is_placeholder ? 'Placeholder' : 'Facility'
  }

  // Group by facility
  const byFacility: Record<string, Shift[]> = {}
  for (const s of activeShifts) {
    const key = s.facility_id ?? s.placeholder_facility_id ?? 'unknown'
    if (!byFacility[key]) byFacility[key] = []
    byFacility[key].push(s)
  }

  return (
    <>
    <div className="card flex flex-col h-full">
      <div className="flex items-start justify-between px-4 py-3 border-b border-line">
        <div>
          <p className="section-title text-[17px]">{formatDate(date)}</p>
          <p className="text-xs text-ink-3 mt-0.5">
            {activeShifts.length} active shift{activeShifts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-ink-3 hover:text-ink-2 text-lg leading-none p-1"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {activeShifts.length > 0 && (
          <div className="space-y-3">
            {Object.entries(byFacility).map(([facKey, facShifts]) => (
              <div key={facKey}>
                <div className="text-xs font-semibold text-ink-3 mb-1.5 flex items-center gap-1.5">
                  {facShifts[0].is_placeholder && (
                    <span className="bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded font-medium">PH</span>
                  )}
                  {getFacilityName(facShifts[0])}
                </div>
                <div className="space-y-1.5">
                  {facShifts.map(shift => {
                    const isReviewing = reviewShiftId === shift.id
                    const isClaimedPlaceholder = shift.is_placeholder && shift.status === 'claimed'
                    return (
                    <div key={shift.id} className="rounded-lg overflow-hidden">
                      <div
                        className={`flex items-center justify-between bg-background px-3 py-2 ${shift.status === 'confirmed' && cancelConfirmId !== shift.id && !isReviewing ? 'cursor-pointer hover:bg-green-50' : ''}`}
                        onClick={shift.status === 'confirmed' && cancelConfirmId !== shift.id && !isReviewing ? () => handleConfirmedClick(shift.id) : undefined}
                        title={shift.status === 'confirmed' ? 'Click to view nurse info' : undefined}
                      >
                        <div className="flex items-center gap-2 text-sm text-ink-2 tabular-nums">
                          <span className="text-xs font-medium text-ink-3">
                            {CREDENTIAL_LABELS[shift.credential_required] ?? shift.credential_required}
                          </span>
                          <span>{fmt12(shift.start_time)} – {fmt12(shift.end_time)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_STYLES[shift.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {loadingShiftId === shift.id ? '…' : shift.status}
                          </span>
                          {/* Confirm / Decline buttons for claimed placeholder shifts */}
                          {isClaimedPlaceholder && !isReviewing && cancelConfirmId !== shift.id && (
                            <div className="flex items-center gap-1">
                              <button
                                data-tour-id="confirm-placeholder-btn"
                                onClick={e => { e.stopPropagation(); setReviewShiftId(shift.id); setReviewAction('confirm'); setReviewReopen(true); setReviewError(null) }}
                                className="text-xs px-1.5 py-0.5 rounded font-medium bg-green-100 text-green-800 hover:bg-green-200 transition-colors"
                                title="Confirm this nurse"
                              >
                                ✓
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); setReviewShiftId(shift.id); setReviewAction('decline'); setReviewReopen(true); setReviewError(null) }}
                                className="text-xs px-1.5 py-0.5 rounded font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                                title="Decline this nurse"
                              >
                                ✕
                              </button>
                            </div>
                          )}
                          {/* Cancel button for placeholder shifts (not while review is open) */}
                          {cancelConfirmId !== shift.id && !isReviewing && shift.is_placeholder && !isClaimedPlaceholder && (
                            <button
                              onClick={e => { e.stopPropagation(); setCancelConfirmId(shift.id); setCancelError(null) }}
                              className="text-xs text-ink-3 hover:text-red-500 transition-colors"
                              title="Cancel shift"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Notes */}
                      {shift.notes && !isClaimedPlaceholder && cancelConfirmId !== shift.id && !isReviewing && (
                        <div className="bg-surface border-t border-line px-3 py-1.5">
                          <p className="text-xs text-ink-3 italic">{shift.notes}</p>
                        </div>
                      )}

                      {/* Nurse info for claimed placeholder shifts */}
                      {isClaimedPlaceholder && nurseInfoMap[shift.id] && (() => {
                        const n = nurseInfoMap[shift.id]
                        const tbUntil = n.tb_test_date
                          ? new Date(new Date(n.tb_test_date).getTime() + 365*24*60*60*1000).toISOString().split('T')[0]
                          : null
                        return (
                          <div className="px-3 py-2 space-y-1 bg-background border-t border-line">
                            <p className="text-[10px] font-semibold uppercase tracking-wide mb-1 text-ink-3">Claimed by</p>
                            <p className="text-[12px] font-semibold text-ink">{n.full_name}</p>
                            {[
                              { label: 'License', value: `${n.license_number} (${n.license_state}) — ${n.license_status}` },
                              { label: 'Phone',   value: n.phone ?? '—' },
                              { label: 'CPR Exp', value: fmtDate(n.cpr_expiration) },
                              { label: 'TB Until', value: fmtDate(tbUntil) },
                            ].map(({ label, value }) => (
                              <div key={label} className="flex justify-between gap-2">
                                <span className="text-[10px] text-ink-3">{label}</span>
                                <span className="text-[11px] text-right text-ink-2 tabular-nums">{value}</span>
                              </div>
                            ))}
                          </div>
                        )
                      })()}

                      {/* Confirm prompt */}
                      {isReviewing && reviewAction === 'confirm' && (
                        <div className="bg-green-50 border-t border-green-100 px-3 py-2 space-y-2">
                          <p className="text-xs text-green-800 font-medium">Confirm this nurse for the shift?</p>
                          <p className="text-xs text-green-700">The nurse will be notified by SMS and in-app.</p>
                          {reviewError && <p className="text-xs text-red-600">{reviewError}</p>}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => { setReviewShiftId(null); setReviewAction(null) }}
                              disabled={reviewingId === shift.id}
                              className="text-xs text-ink-2 hover:text-ink disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleReviewSubmit(shift.id)}
                              disabled={reviewingId === shift.id}
                              className="text-xs px-2.5 py-1 bg-green-600 text-white rounded font-medium hover:bg-green-700 disabled:opacity-50"
                            >
                              {reviewingId === shift.id ? '…' : 'Yes, Confirm'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Decline prompt */}
                      {isReviewing && reviewAction === 'decline' && (
                        <div className="bg-red-50 border-t border-red-100 px-3 py-2 space-y-2">
                          <p className="text-xs text-red-800 font-medium">Decline this nurse?</p>
                          <label className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={reviewReopen}
                              onChange={e => setReviewReopen(e.target.checked)}
                              className="mt-0.5 h-3.5 w-3.5 rounded border-line text-brand"
                            />
                            <span className="text-xs text-red-700">
                              Reopen shift for reassignment
                              {!reviewReopen && <span className="ml-1 text-red-500">(will be permanently closed)</span>}
                            </span>
                          </label>
                          {reviewError && <p className="text-xs text-red-600">{reviewError}</p>}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => { setReviewShiftId(null); setReviewAction(null) }}
                              disabled={reviewingId === shift.id}
                              className="text-xs text-ink-2 hover:text-ink disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleReviewSubmit(shift.id)}
                              disabled={reviewingId === shift.id}
                              className="text-xs px-2.5 py-1 bg-red-600 text-white rounded font-medium hover:bg-red-700 disabled:opacity-50"
                            >
                              {reviewingId === shift.id ? '…' : 'Yes, Decline'}
                            </button>
                          </div>
                        </div>
                      )}

                      {cancelConfirmId === shift.id && (
                        <div className="bg-red-50 border-t border-red-100 px-3 py-2 flex items-center justify-between gap-2">
                          <span className="text-xs text-red-700">
                            {shift.status === 'confirmed' ? 'Cancel shift and notify the assigned nurse?' : 'Cancel this shift?'}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => setCancelConfirmId(null)}
                              disabled={cancelingId === shift.id}
                              className="text-xs text-ink-2 hover:text-ink disabled:opacity-50"
                            >
                              Keep
                            </button>
                            <button
                              onClick={() => handleCancelShift(shift.id)}
                              disabled={cancelingId === shift.id}
                              className="text-xs px-2.5 py-1 bg-red-600 text-white rounded font-medium hover:bg-red-700 disabled:opacity-50"
                            >
                              {cancelingId === shift.id ? '…' : 'Cancel shift'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {cancelError && (
          <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">{cancelError}</p>
        )}

        {canceledShifts.length > 0 && (
          <details className="text-xs text-ink-3">
            <summary className="cursor-pointer hover:text-ink-2">
              {canceledShifts.length} canceled
            </summary>
            <div className="mt-1.5 space-y-1">
              {canceledShifts.map(s => (
                <div key={s.id} className="text-ink-3 line-through tabular-nums">
                  {getFacilityName(s)} · {CREDENTIAL_LABELS[s.credential_required]} · {fmt12(s.start_time)}
                </div>
              ))}
            </div>
          </details>
        )}

        {activeShifts.length === 0 && canceledShifts.length === 0 && (
          <p className="text-sm text-ink-3 italic">No shifts on this day.</p>
        )}

        {/* Post placeholder shift */}
        {!isPast && placeholderFacilities.length > 0 && (
          <div>
            <div className="border-t border-line pt-4">
              {!showPostForm ? (
                <button
                  data-tour-id="post-placeholder-shift-btn"
                  onClick={() => setShowPostForm(true)}
                  className="text-xs text-brand hover:text-brand-hover font-medium"
                >
                  + Post placeholder shift
                </button>
              ) : (
                <div data-tour-id="placeholder-shift-form">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Post Placeholder Shift</p>
                    <button onClick={() => setShowPostForm(false)} className="text-xs text-ink-3 hover:text-ink-2">
                      Cancel
                    </button>
                  </div>
                  <PlaceholderShiftForm
                    placeholderFacilities={placeholderFacilities}
                    initialDate={date}
                    onShiftPosted={(newShifts) => {
                      onShiftPosted(newShifts)
                      setShowPostForm(false)
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {isPast && (
          <p className="text-xs text-ink-3 italic pt-2">Cannot post shifts on past dates.</p>
        )}
      </div>
    </div>

    {nurseModal && <NurseModal nurse={nurseModal} onClose={() => setNurseModal(null)} />}
    </>
  )
}
