'use client'

import { useState } from 'react'
import CalendarComparison from './CalendarComparison'

type Step = 'details' | 'comparison' | 'confirm'

interface Props {
  requestId: string
  agencyName: string
  placeholderName: string
  facilityName?: string
  pendingShiftCount: number
  /** The role of the viewer — they are always the RESPONDER (non-initiator) */
  responderRole: 'facility_admin' | 'agency_admin'
  message?: string | null
  requestedAt: string
  onAccepted: (requestId: string, deletedShifts: number, migratedShifts: number) => void
  onDeclined: (requestId: string) => void
  onClose: () => void
}

export default function ConnectionRequestModal({
  requestId,
  agencyName,
  placeholderName,
  facilityName,
  pendingShiftCount,
  responderRole,
  message,
  requestedAt,
  onAccepted,
  onDeclined,
  onClose,
}: Props) {
  const [step, setStep] = useState<Step>('details')
  const [comparisonViewed, setComparisonViewed] = useState(false)
  const [shiftDeleteConfirmed, setShiftDeleteConfirmed] = useState(false)
  const [action, setAction] = useState<'idle' | 'accepting' | 'declining' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleAccept() {
    setError(null)
    setAction('accepting')
    try {
      const res = await fetch('/api/placeholders/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to accept')
        setAction('idle')
        return
      }
      setAction('done')
      onAccepted(requestId, json.deleted_shifts ?? 0, json.migrated_shifts ?? 0)
    } catch {
      setError('Network error — please try again')
      setAction('idle')
    }
  }

  async function handleDecline() {
    setError(null)
    setAction('declining')
    try {
      const res = await fetch('/api/placeholders/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to decline')
        setAction('idle')
        return
      }
      setAction('done')
      onDeclined(requestId)
    } catch {
      setError('Network error — please try again')
      setAction('idle')
    }
  }

  const initiatorLabel = responderRole === 'facility_admin' ? agencyName : (facilityName ?? 'The facility')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Connection Request</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(requestedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none mt-0.5">✕</button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-6 pt-4 pb-2 shrink-0">
          {(['details', 'comparison', 'confirm'] as Step[]).map((s, i) => {
            const labels = ['Details', 'Calendar Review', 'Confirm']
            const reached = step === s || (step === 'comparison' && i === 0) || (step === 'confirm' && i <= 1)
            return (
              <div key={s} className="flex items-center gap-0 flex-1 last:flex-none">
                <div className="flex items-center gap-1.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                    step === s ? 'bg-teal-600 text-white' : reached ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {i + 1}
                  </div>
                  <span className={`text-xs font-medium ${step === s ? 'text-teal-700' : reached ? 'text-teal-600' : 'text-gray-400'}`}>
                    {labels[i]}
                  </span>
                </div>
                {i < 2 && <div className="flex-1 h-px bg-gray-200 mx-2" />}
              </div>
            )
          })}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* ── Step 1: Details ── */}
          {step === 'details' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                <strong>{initiatorLabel}</strong> has requested to connect{' '}
                {responderRole === 'facility_admin'
                  ? <>their placeholder <strong>{placeholderName}</strong> with your facility.</>
                  : <>with your placeholder <strong>{placeholderName}</strong>.</>
                }
              </p>

              {message && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 mb-1">Message</p>
                  <p className="text-sm text-gray-700 italic">"{message}"</p>
                </div>
              )}

              <div className="bg-brand-tint border border-teal-200 rounded-xl p-4 text-sm text-teal-800 space-y-1">
                <p className="font-semibold">Before you can accept or decline, you must review the calendar comparison.</p>
                <p className="text-xs text-teal-700">
                  The next step shows placeholder shifts alongside your facility's live calendar so you can see exactly what will change.
                </p>
              </div>
            </div>
          )}

          {/* ── Step 2: Calendar Comparison ── */}
          {step === 'comparison' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Review the shifts on both sides before confirming. Scroll through all dates, then continue to confirm or decline.
              </p>
              <CalendarComparison requestId={requestId} />
            </div>
          )}

          {/* ── Step 3: Confirm / Decline ── */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
                <p className="font-semibold mb-1">You've reviewed the calendar comparison.</p>
                <p className="text-xs text-green-700">
                  Accepting will connect the placeholder to your live facility.
                  Confirmed shifts will be migrated and kept. Open placeholder shifts will be deleted.
                </p>
              </div>

              {pendingShiftCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-amber-800 mb-1">
                    ⚠ {pendingShiftCount} open shift{pendingShiftCount !== 1 ? 's' : ''} will be permanently deleted
                  </p>
                  <p className="text-xs text-amber-700 mb-3">
                    Only open and claimed placeholder shifts are deleted. Already-confirmed shifts are migrated and preserved.
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shiftDeleteConfirmed}
                      onChange={e => setShiftDeleteConfirmed(e.target.checked)}
                      className="w-4 h-4 rounded accent-amber-600"
                    />
                    <span className="text-xs text-amber-800 font-medium">
                      I understand {pendingShiftCount} open shift{pendingShiftCount !== 1 ? 's' : ''} will be deleted
                    </span>
                  </label>
                </div>
              )}

              {error && <p className="text-red-600 text-sm">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="px-6 pb-6 pt-4 border-t border-gray-100 shrink-0">
          {step === 'details' && (
            <div className="flex gap-3">
              <button
                onClick={() => { setStep('comparison'); setComparisonViewed(true) }}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
              >
                Review Calendar Comparison →
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {step === 'comparison' && (
            <div className="flex gap-3">
              <button
                onClick={() => setStep('details')}
                className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-xl transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep('confirm')}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
              >
                I've reviewed this — proceed to confirm →
              </button>
            </div>
          )}

          {step === 'confirm' && (
            <div className="flex gap-3">
              <button
                onClick={() => setStep('comparison')}
                className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-xl transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleAccept}
                disabled={action !== 'idle' || (pendingShiftCount > 0 && !shiftDeleteConfirmed)}
                className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
              >
                {action === 'accepting' ? 'Accepting…' : 'Accept & Connect'}
              </button>
              <button
                onClick={handleDecline}
                disabled={action !== 'idle'}
                className="flex-1 bg-white hover:bg-gray-50 disabled:opacity-40 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-xl border border-gray-300 transition-colors"
              >
                {action === 'declining' ? 'Declining…' : 'Decline'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
