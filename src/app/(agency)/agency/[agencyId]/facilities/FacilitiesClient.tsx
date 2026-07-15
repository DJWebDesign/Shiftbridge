'use client'

import { useState } from 'react'
import Link from 'next/link'
import PlaceholderFacilityForm from '@/components/placeholders/PlaceholderFacilityForm'
import AddressMatchAlert from '@/components/placeholders/AddressMatchAlert'

interface PlaceholderFacility {
  id: string
  name: string
  facility_type: string
  address_line1: string
  address_line2: string | null
  city: string
  state: string
  zip: string
  coordinator_email: string | null
  connection_status: string
  matched_facility_id: string | null
  matched_facility_name?: string | null
  created_at: string
}

interface Props {
  agencyId: string
  basePath?: string
  initialPlaceholders: PlaceholderFacility[]
  matchedFacilityNames: Record<string, string>  // facility_id → name
  facilityTypeLabels: Record<string, string>
  connectionStatusStyles: Record<string, string>
  connectionStatusLabels: Record<string, string>
}

export default function FacilitiesClient({
  agencyId,
  basePath,
  initialPlaceholders,
  matchedFacilityNames,
  facilityTypeLabels,
  connectionStatusStyles,
  connectionStatusLabels,
}: Props) {
  const placeholderBase = basePath ?? `/agency/${agencyId}`
  const [placeholders, setPlaceholders] = useState<PlaceholderFacility[]>(initialPlaceholders)
  const [matchedNames, setMatchedNames] = useState<Record<string, string>>(matchedFacilityNames)
  const [showForm, setShowForm] = useState(false)

  function handleCreated(facility: PlaceholderFacility) {
    setPlaceholders(prev => [...prev, facility])
    if (facility.matched_facility_id && facility.matched_facility_name) {
      setMatchedNames(prev => ({ ...prev, [facility.matched_facility_id!]: facility.matched_facility_name! }))
    }
    setShowForm(false)
  }

  function handleRequestSent(placeholderId: string) {
    setPlaceholders(prev =>
      prev.map(pf => pf.id === placeholderId
        ? { ...pf, connection_status: 'request_pending' }
        : pf
      )
    )
  }

  return (
    <div className="space-y-4">
      {placeholders.length === 0 && !showForm && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 text-sm text-amber-800">
          No placeholder facilities yet. Add your first one to start posting shifts without a connected facility.
        </div>
      )}

      {placeholders.filter(pf => pf.connection_status !== 'connected').length > 0 && (
        <div className="space-y-2">
          {placeholders.filter(pf => pf.connection_status !== 'connected').map((pf, idx) => {
            const matchedName = pf.matched_facility_id ? matchedNames[pf.matched_facility_id] : null
            return (
              <div key={pf.id} data-tour-id={idx === 0 ? 'placeholder-row' : undefined} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`${placeholderBase}/facilities/placeholder/${pf.id}`}
                    className="flex-1 min-w-0 group"
                  >
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm group-hover:text-teal-700 transition-colors" style={{ color: '#0D1B2A' }}>{pf.name}</p>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: '#E0E7FF', color: '#4338CA' }}>PH</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${connectionStatusStyles[pf.connection_status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {connectionStatusLabels[pf.connection_status] ?? pf.connection_status}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: '#5B6B80' }}>
                      {facilityTypeLabels[pf.facility_type] ?? pf.facility_type} · {pf.address_line1}, {pf.city}, {pf.state} {pf.zip}
                    </p>
                    {pf.coordinator_email && (
                      <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Coordinator: {pf.coordinator_email}</p>
                    )}
                  </Link>
                  <span className="text-xs font-medium flex-shrink-0 mt-0.5" style={{ color: '#0D9488' }}>Edit →</span>
                </div>

                {/* Address match alert — outside the link so its buttons still work */}
                {matchedName && (
                  <div className="mt-2">
                    <AddressMatchAlert
                      placeholderId={pf.id}
                      placeholderName={pf.name}
                      matchedFacilityName={matchedName}
                      connectionStatus={pf.connection_status}
                      onRequestSent={handleRequestSent}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showForm ? (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Add Placeholder Facility</h3>
          <PlaceholderFacilityForm
            onCreated={handleCreated}
            onCancel={() => setShowForm(false)}
          />
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-sm text-brand hover:text-brand-hover font-medium"
        >
          <span className="text-lg leading-none">+</span>
          Add Placeholder Facility
        </button>
      )}
    </div>
  )
}
