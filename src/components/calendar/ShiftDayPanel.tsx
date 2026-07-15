'use client'

import { useState } from 'react'
import ShiftPostForm from '@/components/shifts/ShiftPostForm'
import type { Database } from '@/lib/supabase/types'
import { CredentialBadge, TierBadge } from '@/components/ui/Badge'

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
            { label: 'License',  value: `${nurse.license_number} (${nurse.license_state}) — ${nurse.license_status}` },
            { label: 'Expires',  value: fmtDate(nurse.license_expiration) },
            { label: 'Phone',    value: nurse.phone ?? '—' },
            { label: 'CPR',      value: fmtDate(nurse.cpr_expiration) },
            { label: 'TB Valid Until', value: fmtDate(tbExpiry) },
            { label: 'COVID',    value: nurse.covid_vaccinated ? 'Vaccinated' : 'Not vaccinated' },
            { label: 'IV Cert',  value: nurse.iv_certified ? 'Yes' : 'No' },
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

interface ShiftSlot {
  shift_name: string
  start_time: string
  end_time: string
}

type ShiftConfigsByCredential = Partial<Record<string, ShiftSlot[]>>

interface Props {
  date: string   // YYYY-MM-DD
  shifts: Shift[]
  shiftConfigs: ShiftConfigsByCredential
  facilityId: string
  onClose: () => void
  onShiftPosted: (shifts: Shift[]) => void
  onTierChange: (shiftId: string, tier: number) => void
  onShiftCanceled: (shiftId: string) => void
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
  // dateStr = YYYY-MM-DD, parse as local date to avoid UTC offset issues
  const [y, mo, d] = dateStr.split('-').map(Number)
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

function TierSelect({ shift, onChange }: { shift: Shift; onChange: (tier: number) => void }) {
  const [loading, setLoading] = useState(false)

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const tier = Number(e.target.value)
    setLoading(true)
    try {
      const res = await fetch(`/api/shifts/${shift.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority_tier: tier }),
      })
      if (res.ok) onChange(tier)
    } finally {
      setLoading(false)
    }
  }

  return (
    <select
      value={shift.priority_tier}
      onChange={handleChange}
      disabled={loading}
      className="text-xs border border-line rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50"
    >
      {[1, 2, 3].map(t => (
        <option key={t} value={t}>Tier {t}</option>
      ))}
    </select>
  )
}

export default function ShiftDayPanel({
  date, shifts, shiftConfigs, facilityId,
  onClose, onShiftPosted, onTierChange, onShiftCanceled,
}: Props) {
  const [nurseModal, setNurseModal] = useState<NurseInfo | null>(null)
  const [loadingShiftId, setLoadingShiftId] = useState<string | null>(null)
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)

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

  // Group active shifts by credential
  const byCredential: Record<string, Shift[]> = {}
  for (const s of activeShifts) {
    if (!byCredential[s.credential_required]) byCredential[s.credential_required] = []
    byCredential[s.credential_required].push(s)
  }

  const today = new Date().toISOString().split('T')[0]
  const isPast = date < today

  return (
    <>
    <div className="card flex flex-col h-full">
      {/* Header */}
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
        {/* Existing shifts */}
        {activeShifts.length > 0 && (
          <div className="space-y-2">
            {Object.entries(byCredential).map(([ct, ctShifts]) => (
              <div key={ct}>
                <div className="text-xs font-semibold text-ink-3 uppercase tracking-wide mb-1.5">
                  {CREDENTIAL_LABELS[ct] ?? ct}
                </div>
                <div className="space-y-1.5">
                  {ctShifts.map(shift => (
                    <div key={shift.id} className="rounded-lg overflow-hidden">
                      <div
                        className={`flex items-center justify-between bg-background px-3 py-2 ${shift.status === 'confirmed' ? 'cursor-pointer hover:bg-green-50' : ''}`}
                        onClick={shift.status === 'confirmed' && cancelConfirmId !== shift.id ? () => handleConfirmedClick(shift.id) : undefined}
                        title={shift.status === 'confirmed' ? 'Click to view nurse info' : undefined}
                      >
                        <div className="flex items-center gap-2 text-sm text-ink-2 tabular-nums">
                          <span>{fmt12(shift.start_time)} – {fmt12(shift.end_time)}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_STYLES[shift.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {loadingShiftId === shift.id ? '…' : shift.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {shift.status === 'open' ? (
                            <TierSelect
                              shift={shift}
                              onChange={(tier) => onTierChange(shift.id, tier)}
                            />
                          ) : (
                            <TierBadge tier={shift.priority_tier} label={`Tier ${shift.priority_tier}`} />
                          )}
                          {cancelConfirmId !== shift.id && (
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
                      {shift.notes && cancelConfirmId !== shift.id && (
                        <div className="bg-surface border-t border-line px-3 py-1.5">
                          <p className="text-xs text-ink-3 italic">{shift.notes}</p>
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
                  ))}
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
              {canceledShifts.length} canceled shift{canceledShifts.length !== 1 ? 's' : ''}
            </summary>
            <div className="mt-1.5 space-y-1">
              {canceledShifts.map(s => (
                <div key={s.id} className="text-ink-3 line-through tabular-nums">
                  {CREDENTIAL_LABELS[s.credential_required] ?? s.credential_required} · {fmt12(s.start_time)} – {fmt12(s.end_time)}
                </div>
              ))}
            </div>
          </details>
        )}

        {activeShifts.length === 0 && canceledShifts.length === 0 && (
          <p className="text-sm text-ink-3 italic">No shifts on this day.</p>
        )}

        {/* Post new shift */}
        {!isPast && (
          <div>
            <div className="border-t border-line pt-4 mb-3">
              <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Post New Shift</p>
            </div>
            <ShiftPostForm
              facilityId={facilityId}
              shiftDate={date}
              shiftConfigs={shiftConfigs}
              onSuccess={onShiftPosted}
            />
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
