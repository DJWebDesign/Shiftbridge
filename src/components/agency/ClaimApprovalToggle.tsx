'use client'

import { useState } from 'react'

interface Props {
  agencyId: string
  initial: boolean
}

export default function ClaimApprovalToggle({ agencyId, initial }: Props) {
  const [enabled, setEnabled] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    const next = !enabled
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/agency/${agencyId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ require_claim_approval: next }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to save')
        return
      }
      setEnabled(next)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={toggle}
          disabled={saving}
          className={[
            'relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50',
            enabled ? 'bg-brand' : 'bg-gray-300',
          ].join(' ')}
        >
          <span
            className={[
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200',
              enabled ? 'translate-x-5' : 'translate-x-0',
            ].join(' ')}
          />
        </button>
        <div>
          <p className="text-sm font-medium text-gray-800">
            {enabled ? 'Approval required' : 'Approval not required'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {enabled
              ? "Nurses' claims route to you first — facilities only see claims you've approved."
              : 'Claims go directly to facilities without agency review.'}
          </p>
        </div>
      </label>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}
