'use client'

import { useState } from 'react'

const CREDENTIAL_TYPES = ['CNA', 'CMA', 'LPN', 'LPN_IV', 'RN'] as const
type CredentialType = typeof CREDENTIAL_TYPES[number]

const CREDENTIAL_LABELS: Record<CredentialType, string> = {
  CNA: 'CNA',
  CMA: 'CMA',
  LPN: 'LPN',
  LPN_IV: 'LPN (IV Certified)',
  RN: 'RN',
}

export type ShiftSlot = {
  shift_name: string
  start_time: string
  end_time: string
}

export type ShiftConfigsByCredential = Partial<Record<CredentialType, ShiftSlot[]>>

interface Props {
  facilityId: string
  initial: ShiftConfigsByCredential
}

function emptySlot(): ShiftSlot {
  return { shift_name: '', start_time: '', end_time: '' }
}

export default function ShiftConfigForm({ facilityId, initial }: Props) {
  const [configs, setConfigs] = useState<ShiftConfigsByCredential>(() => {
    const base: ShiftConfigsByCredential = {}
    for (const ct of CREDENTIAL_TYPES) {
      base[ct] = initial[ct] ?? []
    }
    return base
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addSlot(ct: CredentialType) {
    setConfigs(prev => ({ ...prev, [ct]: [...(prev[ct] ?? []), emptySlot()] }))
    setSaved(false)
  }

  function removeSlot(ct: CredentialType, idx: number) {
    setConfigs(prev => ({
      ...prev,
      [ct]: (prev[ct] ?? []).filter((_, i) => i !== idx),
    }))
    setSaved(false)
  }

  function updateSlot(ct: CredentialType, idx: number, field: keyof ShiftSlot, value: string) {
    setConfigs(prev => ({
      ...prev,
      [ct]: (prev[ct] ?? []).map((slot, i) => i === idx ? { ...slot, [field]: value } : slot),
    }))
    setSaved(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)

    // Build flat list, skip credential types with no slots
    const rows: Array<{ credential_type: string; shift_name: string; start_time: string; end_time: string }> = []
    for (const ct of CREDENTIAL_TYPES) {
      for (const slot of configs[ct] ?? []) {
        if (!slot.shift_name.trim() || !slot.start_time || !slot.end_time) {
          setError('All shift slots must have a name, start time, and end time.')
          return
        }
        rows.push({
          credential_type: ct,
          shift_name: slot.shift_name.trim(),
          start_time: slot.start_time,
          end_time: slot.end_time,
        })
      }
    }

    setSaving(true)
    try {
      const res = await fetch('/api/settings/shift-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facilityId, configs: rows }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to save.')
        return
      }
      setSaved(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {CREDENTIAL_TYPES.map(ct => {
        const slots = configs[ct] ?? []
        return (
          <div key={ct} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200">
              <span className="font-medium text-gray-900 text-sm">{CREDENTIAL_LABELS[ct]}</span>
              <button
                type="button"
                onClick={() => addSlot(ct)}
                className="text-xs text-brand hover:text-brand-hover font-medium"
              >
                + Add shift
              </button>
            </div>

            {slots.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-400 italic">
                No shifts configured — click &ldquo;Add shift&rdquo; to define a slot.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {slots.map((slot, idx) => (
                  <div key={idx} className="px-4 py-3 flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="Shift name (e.g. Day, Night, 1st)"
                      value={slot.shift_name}
                      onChange={e => updateSlot(ct, idx, 'shift_name', e.target.value)}
                      className="flex-1 text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                    <input
                      type="time"
                      value={slot.start_time}
                      onChange={e => updateSlot(ct, idx, 'start_time', e.target.value)}
                      className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                    <span className="text-gray-400 text-xs">to</span>
                    <input
                      type="time"
                      value={slot.end_time}
                      onChange={e => updateSlot(ct, idx, 'end_time', e.target.value)}
                      className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                    <button
                      type="button"
                      onClick={() => removeSlot(ct, idx)}
                      className="text-gray-400 hover:text-red-500 text-sm leading-none"
                      aria-label="Remove shift"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save configuration'}
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
      </div>
    </form>
  )
}
