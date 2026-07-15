'use client'

import { useState } from 'react'
import AddressAutocompleteInput from '@/components/ui/AddressAutocompleteInput'

const FACILITY_TYPE_LABELS: Record<string, string> = {
  long_term_care: 'Long-Term Care',
  assisted_living: 'Assisted Living',
  hospital: 'Hospital',
  rehabilitation: 'Rehabilitation',
  memory_care: 'Memory Care',
}

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
  created_at: string
}

interface Props {
  onCreated: (facility: PlaceholderFacility) => void
  onCancel?: () => void
}

export default function PlaceholderFacilityForm({ onCreated, onCancel }: Props) {
  const [name, setName] = useState('')
  const [facilityType, setFacilityType] = useState('long_term_care')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [coordinatorEmail, setCoordinatorEmail] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch('/api/placeholders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          facility_type: facilityType,
          address_line1: addressLine1,
          address_line2: addressLine2 || undefined,
          city,
          state,
          zip,
          coordinator_email: coordinatorEmail || undefined,
          lat: lat,
          lng: lng,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to create facility')
        return
      }

      onCreated(json.facility)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Facility Name *</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          placeholder="Oakwood Care Center"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Facility Type *</label>
        <select
          value={facilityType}
          onChange={e => setFacilityType(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        >
          {Object.entries(FACILITY_TYPE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
        <AddressAutocompleteInput
          value={addressLine1}
          onChange={setAddressLine1}
          onPlaceSelect={parsed => {
            setAddressLine1(parsed.addressLine1)
            setCity(parsed.city)
            setState(parsed.state)
            setZip(parsed.zip)
            setLat(parsed.lat)
            setLng(parsed.lng)
          }}
          required
          placeholder="123 Main Street"
          inputClassName="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
        <input
          type="text"
          value={addressLine2}
          onChange={e => setAddressLine2(e.target.value)}
          placeholder="Suite 100"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
          <input
            type="text"
            value={city}
            onChange={e => setCity(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
          <input
            type="text"
            value={state}
            onChange={e => setState(e.target.value.toUpperCase().slice(0, 2))}
            required
            maxLength={2}
            placeholder="LA"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand uppercase"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ZIP *</label>
          <input
            type="text"
            value={zip}
            onChange={e => setZip(e.target.value)}
            required
            maxLength={10}
            placeholder="70503"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Coordinator Email
          <span className="text-gray-400 font-normal ml-1">(optional — receives shift claim notifications)</span>
        </label>
        <input
          type="email"
          value={coordinatorEmail}
          onChange={e => setCoordinatorEmail(e.target.value)}
          placeholder="coordinator@facility.com"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 bg-brand hover:bg-brand-hover disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {submitting ? 'Saving…' : 'Add Facility'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
