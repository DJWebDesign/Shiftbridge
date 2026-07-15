'use client'

import { useState } from 'react'

interface Props {
  placeholderId: string
  placeholderName: string
  agencyName: string
  connectionStatus: string        // 'match_detected' | 'declined' | 'request_pending'
  onRequestSent: (placeholderId: string) => void
}

export default function FacilityMatchPrompt({
  placeholderId,
  placeholderName,
  agencyName,
  connectionStatus,
  onRequestSent,
}: Props) {
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/placeholders/facility-connect', {
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

  if (connectionStatus === 'request_pending') {
    return (
      <div className="bg-brand-tint border border-teal-200 rounded-xl p-4 flex items-start gap-3">
        <span className="text-brand text-lg leading-none mt-0.5">⏳</span>
        <div>
          <p className="text-sm font-semibold text-teal-900">Connection request pending</p>
          <p className="text-xs text-teal-700 mt-0.5">
            A connection request with <strong>{agencyName}</strong> (placeholder: <strong>{placeholderName}</strong>) is awaiting a response.
          </p>
        </div>
      </div>
    )
  }

  if (connectionStatus === 'declined') {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-700">Connection request declined</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Your last request to connect with <strong>{agencyName}</strong> was declined.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="shrink-0 text-xs font-medium text-brand hover:underline"
          >
            Resend
          </button>
        )}
        {showForm && (
          <div className="mt-2 space-y-2 w-full">
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Optional message to the agency admin…"
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
            {error && <p className="text-red-600 text-xs">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleSend}
                disabled={submitting}
                className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg"
              >
                {submitting ? 'Sending…' : 'Send Request'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="text-xs text-gray-500 hover:text-gray-700 px-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // match_detected — show the main prompt
  return (
    <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <span className="text-amber-500 text-xl leading-none mt-0.5">✦</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-900">
            {agencyName} is already managing shifts for your facility
          </p>
          <p className="text-xs text-amber-800 mt-0.5">
            Their placeholder <strong>{placeholderName}</strong> matches your facility's address. Send a connection request to merge calendars and get connected on ShiftBridge.
          </p>

          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-xs font-semibold text-amber-900 underline hover:text-amber-950"
            >
              Send Connection Request →
            </button>
          ) : (
            <div className="mt-3 space-y-2">
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Optional message to the agency admin…"
                rows={2}
                className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none bg-white"
              />
              {error && <p className="text-red-600 text-xs">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleSend}
                  disabled={submitting}
                  className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                >
                  {submitting ? 'Sending…' : 'Send Request'}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-xs text-gray-600 hover:text-gray-800 px-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
