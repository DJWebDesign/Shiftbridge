'use client'

import { useState } from 'react'
import CredentialCard, { type NurseCredentials } from '@/components/shifts/CredentialCard'
import { CredentialBadge, TierBadge } from '@/components/ui/Badge'

export type ClaimInQueue = {
  id: string
  status: string
  claimed_at: string
  agency_id: string
  nurse: NurseCredentials
}

export type ShiftQueueData = {
  id: string
  shift_date: string
  start_time: string
  end_time: string
  credential_required: string
  priority_tier: number
  status: string
  claims: ClaimInQueue[]
}

function fmt12(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

function formatDate(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number)
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

interface Props {
  shift: ShiftQueueData
  isPast: boolean
  dnrNurseIds?: Set<string>
}

export default function ShiftClaimQueue({ shift, isPast, dnrNurseIds }: Props) {
  const [confirmedClaimId, setConfirmedClaimId] = useState<string | null>(
    shift.claims.find(c => c.status === 'confirmed')?.id ?? null
  )
  const [isCanceled, setIsCanceled] = useState(false)
  const [dnrIssuedFor, setDnrIssuedFor] = useState<Set<string>>(dnrNurseIds ?? new Set())
  const [dnrPending, setDnrPending] = useState<{ nurse: NurseCredentials; agency_id: string } | null>(null)
  const [dnrLoading, setDnrLoading] = useState(false)
  const [undoLoading, setUndoLoading] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const tier = shift.priority_tier as 1 | 2 | 3

  function toggleExpand(claimId: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(claimId) ? next.delete(claimId) : next.add(claimId)
      return next
    })
  }

  async function handleConfirm(claimId: string) {
    setError(null)
    setLoadingId(claimId)
    try {
      const res = await fetch('/api/shifts/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim_id: claimId }),
      })
      if (res.ok) {
        setConfirmedClaimId(claimId)
      } else {
        const data = await res.json()
        setError(data.error ?? 'Failed to confirm.')
      }
    } catch {
      setError('Network error.')
    } finally {
      setLoadingId(null)
    }
  }

  async function handleCancel() {
    setError(null)
    setCancelLoading(true)
    try {
      const res = await fetch('/api/shifts/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift_id: shift.id }),
      })
      if (res.ok) {
        const data = await res.json()
        setIsCanceled(true)
        if (data.is_late_cancel) {
          setError('Late cancellation flagged (within 12 hours of shift start).')
        }
      } else {
        const data = await res.json()
        setError(data.error ?? 'Failed to cancel.')
      }
    } catch {
      setError('Network error.')
    } finally {
      setCancelLoading(false)
    }
  }

  async function confirmDnr() {
    if (!dnrPending) return
    setError(null)
    setDnrLoading(true)
    try {
      const res = await fetch('/api/dnr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nurse_profile_id: dnrPending.nurse.nurse_profile_id,
          agency_id: dnrPending.agency_id,
        }),
      })
      if (res.ok) {
        setDnrIssuedFor(prev => new Set([...prev, dnrPending.nurse.nurse_profile_id]))
        setDnrPending(null)
      } else {
        const data = await res.json()
        setError(data.error ?? 'Failed to add DNR.')
        setDnrPending(null)
      }
    } catch {
      setError('Network error.')
      setDnrPending(null)
    } finally {
      setDnrLoading(false)
    }
  }

  async function handleUndoDnr(nurse: NurseCredentials) {
    setError(null)
    setUndoLoading(nurse.nurse_profile_id)
    try {
      const res = await fetch('/api/dnr', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nurse_profile_id: nurse.nurse_profile_id }),
      })
      if (res.ok) {
        setDnrIssuedFor(prev => {
          const next = new Set(prev)
          next.delete(nurse.nurse_profile_id)
          return next
        })
      } else {
        const data = await res.json()
        setError(data.error ?? 'Failed to remove DNR.')
      }
    } catch {
      setError('Network error.')
    } finally {
      setUndoLoading(null)
    }
  }

  if (isCanceled) {
    return (
      <div className="card p-4 opacity-60">
        <div className="flex items-center gap-2 text-sm text-ink-2">
          <span className="line-through tabular-nums">{formatDate(shift.shift_date)} · {fmt12(shift.start_time)} – {fmt12(shift.end_time)}</span>
          <span className="text-ink-3">· Canceled</span>
        </div>
        {error && <p className="text-xs text-amber-600 mt-1">{error}</p>}
      </div>
    )
  }

  const pendingClaims = shift.claims.filter(c =>
    confirmedClaimId ? c.id === confirmedClaimId : c.status === 'pending'
  )

  return (
    <div className="card overflow-hidden">
      {/* Shift header */}
      <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-semibold text-ink text-sm tabular-nums">{formatDate(shift.shift_date)}</span>
          <span className="text-ink-3 text-sm">·</span>
          <span className="text-sm text-ink-2 tabular-nums">{fmt12(shift.start_time)} – {fmt12(shift.end_time)}</span>
          <TierBadge tier={tier} label={`Tier ${tier}`} />
          <CredentialBadge credential={shift.credential_required} />
          {confirmedClaimId && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-800">
              Confirmed
            </span>
          )}
        </div>
        {!confirmedClaimId && !isPast && (
          <button
            onClick={handleCancel}
            disabled={cancelLoading}
            className="text-xs text-ink-3 hover:text-red-500 disabled:opacity-50 shrink-0"
          >
            {cancelLoading ? 'Canceling…' : 'Cancel shift'}
          </button>
        )}
      </div>

      {/* Claims list */}
      <div className="divide-y divide-line">
        {pendingClaims.length === 0 && (
          <p className="px-4 py-3 text-sm text-ink-3 italic">No pending claims.</p>
        )}

        {pendingClaims.map((claim, idx) => {
          const isConfirmed = confirmedClaimId === claim.id
          const isExpanded = expanded.has(claim.id)
          const isDnr = dnrIssuedFor.has(claim.nurse.nurse_profile_id)

          return (
            <div key={claim.id} className={isConfirmed ? 'bg-green-50' : ''}>
              {/* Claim row */}
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="text-xs text-ink-3 w-4 text-center tabular-nums">{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{claim.nurse.full_name}</p>
                  <p className="text-xs text-ink-3">{claim.nurse.agency_name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleExpand(claim.id)}
                    className="text-xs text-brand hover:text-brand-hover"
                  >
                    {isExpanded ? 'Hide' : 'View credentials'}
                  </button>

                  {isConfirmed ? (
                    <span className="text-xs font-medium text-green-700">✓ Confirmed</span>
                  ) : isPast && confirmedClaimId ? null : confirmedClaimId ? null : (
                    <button
                      data-tour-id="confirm-claim-btn"
                      onClick={() => handleConfirm(claim.id)}
                      disabled={loadingId === claim.id}
                      className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50 font-medium"
                    >
                      {loadingId === claim.id ? 'Confirming…' : 'Confirm'}
                    </button>
                  )}

                  {/* DNR button: only on past confirmed shifts */}
                  {isPast && isConfirmed && (
                    isDnr ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-ink-3">DNR Issued</span>
                        <button
                          onClick={() => handleUndoDnr(claim.nurse)}
                          disabled={undoLoading === claim.nurse.nurse_profile_id}
                          className="text-xs text-brand hover:text-brand-hover disabled:opacity-50 underline"
                        >
                          {undoLoading === claim.nurse.nurse_profile_id ? '…' : 'Undo'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDnrPending({ nurse: claim.nurse, agency_id: shift.claims.find(c => c.id === claim.id)?.agency_id ?? '' })}
                        className="text-xs px-2.5 py-1 rounded-lg font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Issue DNR
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Credential card expand */}
              {isExpanded && (
                <div className="px-4 pb-3">
                  <CredentialCard nurse={claim.nurse} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <div className="px-4 py-2 border-t border-line bg-red-50">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* DNR confirmation modal */}
      {dnrPending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(13,27,42,0.5)' }}
          onClick={() => !dnrLoading && setDnrPending(null)}
        >
          <div
            className="card shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-4 border-b border-line">
              <h3 className="section-title text-[18px]">Issue Do Not Return?</h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-ink-2">
                <span className="font-semibold text-ink">{dnrPending.nurse.full_name}</span> will be placed on
                the Do Not Return list for this facility.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
                Any upcoming confirmed shifts for this nurse at this facility will be canceled and reopened.
                This action will notify the nurse and their agency.
              </div>
              <p className="text-xs text-ink-3">You can undo this after if it was a mistake.</p>
            </div>
            <div className="px-5 pb-5 flex gap-2 justify-end">
              <button
                onClick={() => setDnrPending(null)}
                disabled={dnrLoading}
                className="text-sm px-4 py-2 rounded-lg border border-line text-ink-2 hover:bg-background disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDnr}
                disabled={dnrLoading}
                className="text-sm px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {dnrLoading ? 'Issuing…' : 'Confirm DNR'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
