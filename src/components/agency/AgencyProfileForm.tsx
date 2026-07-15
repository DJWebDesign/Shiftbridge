'use client'

import { useState } from 'react'

interface AgencyProfile {
  display_name: string | null
  contact_email: string | null
  bio: string | null
  logo_url: string | null
}

interface Props {
  agencyId: string
  initial: AgencyProfile
}

export default function AgencyProfileForm({ agencyId, initial }: Props) {
  const [displayName, setDisplayName] = useState(initial.display_name ?? '')
  const [contactEmail, setContactEmail] = useState(initial.contact_email ?? '')
  const [bio, setBio] = useState(initial.bio ?? '')
  const [logoUrl, setLogoUrl] = useState(initial.logo_url ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/settings/agency-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agencyId,
          display_name: displayName.trim() || null,
          contact_email: contactEmail.trim() || null,
          bio: bio.trim() || null,
          logo_url: logoUrl.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to save')
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Display Name</label>
        <input
          type="text"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder="e.g. Sunrise Staffing Solutions"
          maxLength={120}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <p className="text-xs text-gray-400 mt-1">Shown to facilities and in coordinator emails. Falls back to your account name if blank.</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Contact Email</label>
        <input
          type="email"
          value={contactEmail}
          onChange={e => setContactEmail(e.target.value)}
          placeholder="e.g. staffing@sunrisestaffing.com"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <p className="text-xs text-gray-400 mt-1">Included in coordinator emails so facilities can reach you directly.</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Bio <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={bio}
          onChange={e => setBio(e.target.value.slice(0, 600))}
          placeholder="Brief description of your agency — specialties, coverage area, years in operation…"
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand"
        />
        {bio.length > 500 && (
          <p className="text-xs text-gray-400 mt-0.5 text-right">{bio.length}/600</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Logo URL <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          type="url"
          value={logoUrl}
          onChange={e => setLogoUrl(e.target.value)}
          placeholder="https://…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        {logoUrl && (
          <div className="mt-2">
            <img
              src={logoUrl}
              alt="Logo preview"
              className="h-12 object-contain rounded border border-gray-200"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Profile'}
      </button>
    </div>
  )
}
