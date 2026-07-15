'use client'

import { useState } from 'react'
import ConnectionRequestModal from '@/components/placeholders/ConnectionRequestModal'

interface PendingRequest {
  id: string
  facilityId: string
  facilityName: string
  placeholderName: string
  pendingShiftCount: number
  requestedAt: string
  message: string | null
}

interface Props {
  requests: PendingRequest[]
}

export default function AgencyPendingConnectionRequests({ requests: initialRequests }: Props) {
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
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Connection Requests from Facilities
        </h2>
        <div className="space-y-3">
          {requests.map(req => (
            <div
              key={req.id}
              className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start justify-between gap-4"
            >
              <div>
                <p className="text-sm font-semibold text-amber-900">{req.facilityName}</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Wants to connect with your placeholder: <strong>{req.placeholderName}</strong>
                </p>
                {req.message && (
                  <p className="text-xs text-amber-600 mt-1.5 italic">"{req.message}"</p>
                )}
                <p className="text-xs text-amber-500 mt-1">
                  {new Date(req.requestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <button
                onClick={() => setSelectedRequest(req)}
                className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              >
                Review
              </button>
            </div>
          ))}
        </div>
      </section>

      {selectedRequest && (
        <ConnectionRequestModal
          requestId={selectedRequest.id}
          agencyName=""
          placeholderName={selectedRequest.placeholderName}
          facilityName={selectedRequest.facilityName}
          pendingShiftCount={selectedRequest.pendingShiftCount}
          responderRole="agency_admin"
          message={selectedRequest.message}
          requestedAt={selectedRequest.requestedAt}
          onAccepted={(id, deleted, migrated) => {
            handleAccepted(id)
            void deleted; void migrated
          }}
          onDeclined={handleDeclined}
          onClose={() => setSelectedRequest(null)}
        />
      )}
    </>
  )
}
