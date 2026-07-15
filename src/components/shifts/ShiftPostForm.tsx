'use client'

import { useState } from 'react'
import type { Database } from '@/lib/supabase/types'

type Shift = Database['public']['Tables']['shifts']['Row']

interface ShiftSlot {
  shift_name: string
  start_time: string
  end_time: string
}

type ShiftConfigsByCredential = Partial<Record<string, ShiftSlot[]>>

interface Props {
  facilityId: string
  shiftDate: string
  shiftConfigs: ShiftConfigsByCredential
  onSuccess: (shifts: Shift[]) => void
}

const CREDENTIAL_LABELS: Record<string, string> = {
  CNA: 'CNA',
  CMA: 'CMA',
  LPN: 'LPN',
  LPN_IV: 'LPN (IV)',
  RN: 'RN',
}

const TIER_LABELS: Record<number, string> = {
  1: 'Tier 1 — Standard',
  2: 'Tier 2 — Priority',
  3: 'Tier 3 — Urgent',
}

function fmt12(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 || 12
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`
}

const CREDENTIAL_ORDER = ['CNA', 'CMA', 'LPN', 'LPN_IV', 'RN']

export default function ShiftPostForm({ facilityId, shiftDate, shiftConfigs, onSuccess }: Props) {
  const availableCredentials = CREDENTIAL_ORDER.filter(
    ct => (shiftConfigs[ct] ?? []).length > 0
  )

  const [credential, setCredential] = useState(availableCredentials[0] ?? '')
  const [slotIdx, setSlotIdx] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [tier, setTier] = useState(1)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const slots = shiftConfigs[credential] ?? []

  function handleCredentialChange(ct: string) {
    setCredential(ct)
    setSlotIdx(0)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!credential || slots.length === 0) return
    const slot = slots[slotIdx]
    if (!slot) return

    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facility_id: facilityId,
          credential_required: credential,
          shift_date: shiftDate,
          start_time: slot.start_time,
          end_time: slot.end_time,
          priority_tier: tier,
          quantity,
          notes: notes.trim() || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to post shift.')
        return
      }

      onSuccess(data.shifts as Shift[])
      setQuantity(1)
      setTier(1)
      setNotes('')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (availableCredentials.length === 0) {
    return (
      <p className="text-sm text-ink-2 italic">
        No shift slots configured.{' '}
        <a href="../settings" className="text-brand hover:underline">
          Go to Settings
        </a>{' '}
        to set up shifts for this facility.
      </p>
    )
  }

  const selectedSlot = slots[slotIdx]

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Credential */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Credential</label>
        <div className="flex flex-wrap gap-1.5">
          {availableCredentials.map(ct => (
            <button
              key={ct}
              type="button"
              onClick={() => handleCredentialChange(ct)}
              className={[
                'px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
                credential === ct
                  ? 'bg-brand text-white border-brand'
                  : 'bg-surface text-ink-2 border-line hover:border-brand',
              ].join(' ')}
            >
              {CREDENTIAL_LABELS[ct] ?? ct}
            </button>
          ))}
        </div>
      </div>

      {/* Shift slot */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Shift</label>
        <select
          value={slotIdx}
          onChange={e => setSlotIdx(Number(e.target.value))}
          className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand"
        >
          {slots.map((slot, i) => (
            <option key={i} value={i}>
              {slot.shift_name} ({fmt12(slot.start_time)} – {fmt12(slot.end_time)})
            </option>
          ))}
        </select>
      </div>

      {/* Quantity + Tier */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
          <input
            type="number"
            min={1}
            max={10}
            value={quantity}
            onChange={e => setQuantity(Math.min(10, Math.max(1, Number(e.target.value))))}
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Priority Tier</label>
          <select
            value={tier}
            onChange={e => setTier(Number(e.target.value))}
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand"
          >
            {[1, 2, 3].map(t => (
              <option key={t} value={t}>{TIER_LABELS[t]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Special Requirements <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value.slice(0, 500))}
          placeholder="e.g. Must be comfortable with memory care unit"
          rows={2}
          className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-brand"
        />
        {notes.length > 400 && (
          <p className="text-xs text-gray-400 mt-0.5 text-right">{notes.length}/500</p>
        )}
      </div>

      {selectedSlot && (
        <p className="text-xs text-gray-400">
          Will create {quantity} × {CREDENTIAL_LABELS[credential] ?? credential}{' '}
          &ldquo;{selectedSlot.shift_name}&rdquo; shift{quantity > 1 ? 's' : ''} on this day.
        </p>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !selectedSlot}
        className="w-full py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover disabled:opacity-50 transition-colors"
      >
        {submitting ? 'Posting…' : `Post ${quantity > 1 ? `${quantity} shifts` : 'shift'}`}
      </button>
    </form>
  )
}
