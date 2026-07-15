'use client'

import { useState } from 'react'

interface Props {
  facilityId: string
  initialNotes: string
}

export default function FacilityNotesForm({ facilityId, initialNotes }: Props) {
  const [notes, setNotes] = useState(initialNotes)
  const [saved, setSaved] = useState(initialNotes)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = notes !== saved

  async function handleSave() {
    setSaving(true); setError(null)
    const res = await fetch('/api/settings/facility-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facilityId, facility_notes: notes }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Save failed'); setSaving(false); return }
    setSaved(notes)
    setSaving(false)
  }

  return (
    <div className="space-y-3">
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        rows={4}
        placeholder="e.g. Park in the rear lot. Enter through the side door on Maple St. Check in with the charge nurse on Unit 3."
        className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none transition-all"
        style={{ border: '1px solid #E4EAF0', color: '#0D1B2A', lineHeight: '1.6' }}
        onFocus={e => { e.target.style.borderColor = '#0D9488'; e.target.style.boxShadow = '0 0 0 3px rgba(13,148,136,0.1)' }}
        onBlur={e => { e.target.style.borderColor = '#E4EAF0'; e.target.style.boxShadow = 'none' }}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
          style={{ background: '#0D9488' }}
        >
          {saving ? 'Saving…' : 'Save Notes'}
        </button>
        {!dirty && saved && (
          <span className="text-xs" style={{ color: '#0D9488' }}>Saved</span>
        )}
      </div>
    </div>
  )
}
