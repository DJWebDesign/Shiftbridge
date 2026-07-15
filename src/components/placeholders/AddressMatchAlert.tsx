'use client'

import { useState } from 'react'

interface Props {
  placeholderId: string
  placeholderName: string
  matchedFacilityName: string
  connectionStatus: string
  onRequestSent: (placeholderId: string) => void
}

export default function AddressMatchAlert({
  placeholderId,
  placeholderName,
  matchedFacilityName,
  connectionStatus,
  onRequestSent,
}: Props) {
  const [message, setMessage] = useState('')
  const [showMessageBox, setShowMessageBox] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (connectionStatus === 'request_pending') {
    return (
      <div className="mt-2 bg-brand-tint border border-teal-200 rounded-lg px-3 py-2.5 text-sm text-teal-700">
        Connection request sent to <strong>{matchedFacilityName}</strong> — awaiting their response.
      </div>
    )
  }

  if (connectionStatus === 'connected') {
    return null  // Connected facilities shown in the connected section
  }

  if (connectionStatus === 'declined') {
    return (
      <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600">
        <strong>{matchedFacilityName}</strong> declined your last connection request.
        <button
          onClick={() => setShowMessageBox(true)}
          className="ml-2 text-brand hover:underline font-medium"
        >
          Resend
        </button>
        {showMessageBox && <SendForm />}
      </div>
    )
  }

  // match_detected — show the alert
  async function handleSend() {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/placeholders/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeholder_id: placeholderId, message: message || undefined }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to send request')
        return
      }
      onRequestSent(placeholderId)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  function SendForm() {
    return (
      <div className="mt-3 space-y-2">
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Optional message to the facility admin…"
          rows={2}
          className="w-full border border-teal-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
        />
        {error && <p className="text-red-600 text-xs">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSend}
            disabled={submitting}
            className="bg-brand hover:bg-brand-hover disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            {submitting ? 'Sending…' : 'Send Request'}
          </button>
          <button
            onClick={() => setShowMessageBox(false)}
            className="text-xs text-gray-500 hover:text-gray-700 px-2"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-3">
      <div className="flex items-start gap-2">
        <span className="text-amber-500 text-base leading-none mt-0.5">✦</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-800">
            Match detected: <strong>{matchedFacilityName}</strong>
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            This facility is now on ShiftBridge. Send a connection request to link your placeholder and migrate shifts.
          </p>

          {!showMessageBox ? (
            <button
              onClick={() => setShowMessageBox(true)}
              className="mt-2 text-xs font-medium text-amber-800 underline hover:text-amber-900"
            >
              Send Connection Request →
            </button>
          ) : (
            <SendForm />
          )}
        </div>
      </div>
    </div>
  )
}
