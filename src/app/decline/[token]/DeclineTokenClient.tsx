'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ShiftInfo {
  id: string
  status: string
  credential_required: string
  shift_date: string
  start_time: string
  end_time: string
}

interface NurseInfo {
  name: string
  credential: string
  license: string
  phone: string
  cprExp: string
  tbValid: string
}

interface Props {
  token: string
  shift: ShiftInfo
  facilityName: string
  nurse: NurseInfo | null
  agencyConfirmed?: boolean
}

function fmt12(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

function fmtDate(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number)
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

export default function DeclineTokenClient({ token, shift, facilityName, nurse, agencyConfirmed = false }: Props) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'declining' | 'declined' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [reopen, setReopen] = useState(true)
  const [wasReopened, setWasReopened] = useState(true)

  async function handleDecline() {
    setState('declining')
    try {
      const res = await fetch('/api/decline-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, reopen }),
      })
      const json = await res.json()

      if (!res.ok) {
        setErrorMsg(json.error ?? 'Something went wrong')
        setState('error')
        return
      }

      setWasReopened(reopen)
      setState('declined')
    } catch {
      setErrorMsg('Network error — please try again')
      setState('error')
    }
  }

  if (state === 'declined') {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md w-full text-center shadow-sm">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Shift Declined</h1>
        <p className="text-gray-500 text-sm mb-6">
          The nurse has been notified.{' '}
          {wasReopened
            ? 'The shift has been reopened for reassignment.'
            : 'The shift has been closed — no further emails will be sent.'}
        </p>
        <div className="bg-gray-50 rounded-xl p-4 text-left space-y-1.5 text-sm mb-5">
          <div className="flex justify-between">
            <span className="text-gray-500">Facility</span>
            <span className="font-medium text-gray-900">{facilityName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Date</span>
            <span className="font-medium text-gray-900">{fmtDate(shift.shift_date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Time</span>
            <span className="font-medium text-gray-900">{fmt12(shift.start_time)} – {fmt12(shift.end_time)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Credential</span>
            <span className="font-medium text-gray-900">{shift.credential_required}</span>
          </div>
        </div>
        <div className="border-t border-gray-100 pt-4 text-center">
          <p className="text-xs text-gray-400 mb-3">
            Want real-time shift management, credential tracking, and automated scheduling?
          </p>
          <a
            href={`/api/track/cta?event=coordinator_decline&tid=${token}&redirect=${encodeURIComponent('/')}`}
            className="inline-block bg-brand hover:bg-brand-hover text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Learn About ShiftBridge
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md w-full shadow-sm">
      <div className="mb-6">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">ShiftBridge</span>
        <h1 className="text-xl font-bold text-gray-900 mt-1">Decline This Shift?</h1>
        {agencyConfirmed ? (
          <div className="mt-3 rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#B45309' }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
            </svg>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#92400E' }}>Already confirmed by your agency</p>
              <p className="text-xs mt-0.5" style={{ color: '#B45309' }}>
                Your staffing agency confirmed this shift on your behalf. Declining will cancel the nurse's confirmed shift and notify them immediately.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mt-1">
            Are you sure you want to decline this nurse for the shift at <strong>{facilityName}</strong>?
            The nurse will be notified and the shift will be reopened.
          </p>
        )}
      </div>

      <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Shift Details</p>
        <div className="flex justify-between">
          <span className="text-gray-500">Date</span>
          <span className="font-medium text-gray-900">{fmtDate(shift.shift_date)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Time</span>
          <span className="font-medium text-gray-900">{fmt12(shift.start_time)} – {fmt12(shift.end_time)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Credential</span>
          <span className="font-medium text-gray-900">{shift.credential_required}</span>
        </div>
      </div>

      {nurse && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{agencyConfirmed ? 'Confirmed Nurse' : 'Nurse Information'}</p>
          <div className="flex justify-between">
            <span className="text-gray-500">Name</span>
            <span className="font-medium text-gray-900">{nurse.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">License</span>
            <span className="font-medium text-gray-900">{nurse.license}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Phone</span>
            <span className="font-medium text-gray-900">{nurse.phone}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">CPR Exp.</span>
            <span className="font-medium text-gray-900">{nurse.cprExp}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">TB Valid Until</span>
            <span className="font-medium text-gray-900">{nurse.tbValid}</span>
          </div>
        </div>
      )}

      <label className="flex items-start gap-3 mb-6 cursor-pointer">
        <input
          type="checkbox"
          checked={reopen}
          onChange={e => setReopen(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
        />
        <div>
          <span className="text-sm font-medium text-gray-900">Reopen shift for reassignment</span>
          <p className="text-xs text-gray-500 mt-0.5">
            Uncheck if you have coverage — the shift will be permanently closed and the staffing agency will not be asked to send another nurse.
          </p>
        </div>
      </label>

      {state === 'error' && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">
          {errorMsg}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => router.push(`/confirm/${token}`)}
          disabled={state === 'declining'}
          className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-semibold px-4 py-3 rounded-xl transition-colors text-sm"
        >
          Confirm Instead
        </button>
        <button
          onClick={handleDecline}
          disabled={state === 'declining'}
          className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold px-4 py-3 rounded-xl transition-colors text-sm"
        >
          {state === 'declining' ? 'Declining…' : 'Yes, Decline'}
        </button>
      </div>

      <p className="text-xs text-gray-400 text-center mt-4">
        Declining will notify the nurse and reopen the shift for reassignment.
      </p>
    </div>
  )
}
