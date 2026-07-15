'use client'

import { calculateTotalShiftPay, tierLabel, type PayTierConfig } from '@/lib/utils/pay'
import { CredentialBadge, TierBadge } from '@/components/ui/Badge'

export type ShiftCardData = {
  id: string
  facility_id: string | null
  placeholder_facility_id: string | null
  facility_name: string | null
  facility_address: string | null
  facility_city: string | null
  facility_state: string | null
  credential_required: string
  shift_date: string
  start_time: string
  end_time: string
  priority_tier: number
  status: string
  notes?: string | null
  facility_notes?: string | null
}

function fmt12(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

function getShiftHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let mins = eh * 60 + em - (sh * 60 + sm)
  if (mins < 0) mins += 24 * 60
  return mins / 60
}

function formatDate(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number)
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

type ClaimStatus = 'idle' | 'warning' | 'submitting' | 'claimed' | 'error'

interface Props {
  shift: ShiftCardData
  basePay: number | null
  tierConfigs: PayTierConfig[]
  claimStatus: ClaimStatus
  conflictWarning: string | null
  driveMinutes?: number | null
  nurseOrigin?: string
  onClaim: () => void
  onConfirmClaim: () => void
  onDismissWarning: () => void
}

export default function ShiftCard({
  shift, basePay, tierConfigs, claimStatus, conflictWarning, driveMinutes, nurseOrigin,
  onClaim, onConfirmClaim, onDismissWarning,
}: Props) {
  const hours = getShiftHours(shift.start_time, shift.end_time)
  const tier = shift.priority_tier as 1 | 2 | 3
  const label = tierLabel(tier, tierConfigs)

  const totalPay = basePay
    ? calculateTotalShiftPay(basePay, tier, tierConfigs, hours)
    : null

  return (
    <div className={[
      'card transition-shadow',
      claimStatus === 'claimed' ? 'border-green-300 opacity-75' : 'hover:shadow-sm',
    ].join(' ')}>
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="font-semibold text-ink text-sm">
              {shift.facility_name ?? 'Unknown Facility'}
            </p>
            {(shift.facility_address || shift.facility_city) && (() => {
              const dest = encodeURIComponent([shift.facility_address, shift.facility_city, shift.facility_state].filter(Boolean).join(', '))
              const mapsUrl = `https://www.google.com/maps/dir/?api=1${nurseOrigin ? `&origin=${encodeURIComponent(nurseOrigin)}` : ''}&destination=${dest}`
              return (
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                  className="block mt-0.5 hover:underline group text-brand">
                  {shift.facility_address && (
                    <span className="block text-xs">{shift.facility_address}</span>
                  )}
                  <span className="text-xs">
                    {[shift.facility_city, shift.facility_state].filter(Boolean).join(', ')}
                    {driveMinutes != null && (
                      <span className="ml-1.5">· ~{driveMinutes} min away</span>
                    )}
                  </span>
                </a>
              )
            })()}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <CredentialBadge credential={shift.credential_required} />
            <TierBadge tier={tier} label={label} />
          </div>
        </div>

        {/* Date + time */}
        <div className="flex items-center gap-3 text-sm text-ink-2 mb-3">
          <span className="font-medium text-ink">{formatDate(shift.shift_date)}</span>
          <span className="text-ink-3">·</span>
          <span className="tabular-nums">{fmt12(shift.start_time)} – {fmt12(shift.end_time)}</span>
          <span className="text-ink-3">·</span>
          <span className="tabular-nums">{hours % 1 === 0 ? hours : hours.toFixed(1)}h</span>
        </div>

        {/* Pay */}
        {basePay !== null && (
          <div className="text-sm text-ink-2 mb-3">
            {totalPay !== null ? (
              <span>
                <span className="font-semibold text-ink tabular-nums">${totalPay.toFixed(2)}</span>
                <span className="text-ink-3"> total</span>
                <span className="text-ink-3 mx-1">·</span>
                <span className="tabular-nums">${basePay.toFixed(2)}/hr base</span>
              </span>
            ) : (
              <span className="tabular-nums">${basePay.toFixed(2)}/hr</span>
            )}
          </div>
        )}

        {/* Facility info callout */}
        {shift.facility_notes && claimStatus !== 'claimed' && (
          <div className="mb-3 rounded-lg px-3 py-2" style={{ background: '#F0FDF9', border: '1px solid #99F6E4' }}>
            <p className="text-xs font-medium mb-0.5" style={{ color: '#0F766E' }}>Facility Info</p>
            <p className="text-xs" style={{ color: '#134E4A' }}>{shift.facility_notes}</p>
          </div>
        )}

        {/* Shift notes callout */}
        {shift.notes && claimStatus !== 'claimed' && (
          <div className="mb-3 bg-background border border-line rounded-lg px-3 py-2">
            <p className="text-xs font-medium text-ink-3 mb-0.5">Special Requirements</p>
            <p className="text-xs text-ink-2">{shift.notes}</p>
          </div>
        )}

        {/* Warning */}
        {claimStatus === 'warning' && conflictWarning && (
          <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            <p className="text-xs text-amber-800 font-medium mb-1">Schedule conflict detected</p>
            <p className="text-xs text-amber-700">{conflictWarning}</p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={onConfirmClaim}
                className="text-xs px-2.5 py-1 bg-amber-600 text-white rounded-md hover:bg-amber-700 font-medium"
              >
                Claim anyway
              </button>
              <button
                onClick={onDismissWarning}
                className="text-xs px-2.5 py-1 text-amber-700 hover:text-amber-900"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {claimStatus === 'error' && (
          <p className="text-xs text-red-600 mb-3">Failed to submit claim. Please try again.</p>
        )}

        {/* Action */}
        {claimStatus === 'claimed' ? (
          <div className="flex items-center gap-1.5 text-green-700 text-sm font-medium">
            <span>✓</span>
            <span>Claim submitted — awaiting confirmation</span>
          </div>
        ) : claimStatus !== 'warning' ? (
          <button
            data-tour-id="claim-shift-btn"
            onClick={onClaim}
            disabled={claimStatus === 'submitting'}
            className="w-full py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover disabled:opacity-50 transition-colors"
          >
            {claimStatus === 'submitting' ? 'Submitting…' : 'Claim Shift'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
