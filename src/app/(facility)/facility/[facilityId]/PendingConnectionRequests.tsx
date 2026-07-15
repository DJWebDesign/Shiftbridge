'use client'

import { useState } from 'react'
import ConnectionRequestModal from '@/components/placeholders/ConnectionRequestModal'

interface PendingRequest {
  id: string
  agencyId: string
  agencyName: string
  placeholderName: string
  facilityName: string
  pendingShiftCount: number
  requestedAt: string
  message: string | null
}

interface Props {
  requests: PendingRequest[]
}

export default function PendingConnectionRequests({ requests: initialRequests }: Props) {
  const [requests, setRequests] = useState<PendingRequest[]>(initialRequests)
  const [selectedRequest, setSelectedRequest] = useState<PendingRequest | null>(null)

  function handleAccepted(requestId: string) {
    setRequests(prev => prev.filter(r => r.id !== requestId))
    setSelectedRequest(null)
  }

  function handleDeclined(requestId: string) {
    setRequests(prev => prev.filter(r => r.id !== requestId))
    setSelectedRequest(null)
  }

  if (requests.length === 0) return null

  return (
    <>
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Connection Requests
        </h2>
        {requests.map(req => (
          <div
            key={req.id}
            className="bg-brand-tint border border-teal-200 rounded-xl p-4 flex items-start justify-between gap-4"
          >
            <div>
              <p className="text-sm font-semibold text-teal-900">{req.agencyName}</p>
              <p className="text-xs text-teal-700 mt-0.5">
                Wants to connect via placeholder: <strong>{req.placeholderName}</strong>
              </p>
              {req.message && (
                <p className="text-xs text-teal-600 mt-1.5 italic">"{req.message}"</p>
              )}
              <p className="text-xs text-teal-600 mt-1 tabular-nums">
                {new Date(req.requestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <button
              onClick={() => setSelectedRequest(req)}
              className="shrink-0 bg-brand hover:bg-brand-hover text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              Review
            </button>
          </div>
        ))}
      </div>

      {selectedRequest && (
        <ConnectionRequestModal
          requestId={selectedRequest.id}
          agencyName={selectedRequest.agencyName}
          placeholderName={selectedRequest.placeholderName}
          facilityName={selectedRequest.facilityName}
          pendingShiftCount={selectedRequest.pendingShiftCount}
          responderRole="facility_admin"
          message={selectedRequest.message}
          requestedAt={selectedRequest.requestedAt}
          onAccepted={(id, deleted, migrated) => {
            handleAccepted(id)
            // Could surface migrated count in a toast — no-op for now
            void deleted; void migrated
          }}
          onDeclined={handleDeclined}
          onClose={() => setSelectedRequest(null)}
        />
      )}
    </>
  )
}
