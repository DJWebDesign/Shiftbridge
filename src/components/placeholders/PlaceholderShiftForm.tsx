'use client'

import { useState } from 'react'
import type { Database } from '@/lib/supabase/types'

type Shift = Database['public']['Tables']['shifts']['Row']

interface PlaceholderFacility {
  id: string
  name: string
}

interface Props {
  placeholderFacilities: PlaceholderFacility[]
  initialDate?: string   // YYYY-MM-DD, pre-fills date
  onShiftPosted: (shifts: Shift[]) => void
}

const CREDENTIAL_OPTIONS = [
  { value: 'CNA', label: 'CNA' },
  { value: 'CMA', label: 'CMA' },
  { value: 'LPN', label: 'LPN' },
  { value: 'LPN_IV', label: 'LPN (IV)' },
  { value: 'RN', label: 'RN' },
]

const TIER_OPTIONS = [
  { value: 1, label: 'Tier 1' },
  { value: 2, label: 'Tier 2' },
  { value: 3, label: 'Tier 3' },
]

export default function PlaceholderShiftForm({
  placeholderFacilities,
  initialDate,
  onShiftPosted,
}: Props) {
  const [facilityId, setFacilityId] = useState(placeholderFacilities[0]?.id ?? '')
  const [credential, setCredential] = useState('CNA')
  const [shiftDate, setShiftDate] = useState(initialDate ?? '')
  const [startTime, setStartTime] = useState('07:00')
  const [endTime, setEndTime] = useState('19:00')
  const [tier, setTier] = useState(1)
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastPosted, setLastPosted] = useState<number | null>(null)

  async function submit(addAnother: boolean) {
    if (!facilityId) {
      setError('Select a facility')
      return
    }
    if (!shiftDate) {
      setError('Shift date is required')
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch('/api/shifts/placeholder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placeholder_facility_id: facilityId,
          credential_required: credential,
          shift_date: shiftDate,
          start_time: startTime + ':00',
          end_time: endTime + ':00',
          priority_tier: tier,
          quantity,
          notes: notes.trim() || null,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to post shift')
        return
      }

      onShiftPosted(json.shifts)
      setLastPosted(json.shifts.length)

      if (addAnother) {
        // Reset all fields except facility, credential, date (keep context)
        setStartTime('07:00')
        setEndTime('19:00')
        setTier(1)
        setQuantity(1)
        setNotes('')
      } else {
        // Full reset
        setStartTime('07:00')
        setEndTime('19:00')
        setTier(1)
        setQuantity(1)
        setNotes('')
        if (!initialDate) setShiftDate('')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  if (placeholderFacilities.length === 0) {
    return (
      <div className="text-sm text-gray-400 italic">
        No placeholder facilities found. Add one under Facilities first.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      {lastPosted !== null && !error && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-xs px-3 py-2 rounded-lg">
          {lastPosted} shift{lastPosted !== 1 ? 's' : ''} posted.
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Facility</label>
        <select
          value={facilityId}
          onChange={e => setFacilityId(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        >
          {placeholderFacilities.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Credential</label>
        <select
          value={credential}
          onChange={e => setCredential(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        >
          {CREDENTIAL_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
        <input
          type="date"
          value={shiftDate}
          onChange={e => setShiftDate(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Start</label>
          <input
            type="time"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">End</label>
          <input
            type="time"
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tier</label>
          <select
            value={tier}
            onChange={e => setTier(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          >
            {TIER_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Qty</label>
          <input
            type="number"
            min={1}
            max={10}
            value={quantity}
            onChange={e => setQuantity(Math.max(1, Math.min(10, Number(e.target.value))))}
            className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Special Requirements <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value.slice(0, 500))}
          placeholder="e.g. Must be comfortable with memory care unit"
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={submitting}
          className="flex-1 bg-brand hover:bg-brand-hover disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
        >
          {submitting ? 'Saving…' : 'Post Shift'}
        </button>
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={submitting}
          className="flex-1 bg-surface hover:bg-background disabled:opacity-50 text-ink-2 text-xs font-medium px-3 py-2 rounded-lg border border-line transition-colors"
        >
          Save + Add Another
        </button>
      </div>
    </div>
  )
}
