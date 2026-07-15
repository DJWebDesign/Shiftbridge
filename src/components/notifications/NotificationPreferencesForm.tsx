'use client'

import { useState, useEffect } from 'react'

type Channel = 'in_app' | 'email' | 'sms'
type EventType = 'new_claim' | 'shift_confirmed' | 'shift_canceled' | 'dnr' | 'credential_expiry'

const EVENT_LABELS: Record<EventType, string> = {
  new_claim: 'New shift claim',
  shift_confirmed: 'Shift confirmed',
  shift_canceled: 'Shift canceled',
  dnr: 'DNR issued',
  credential_expiry: 'Credential expiring soon',
}

const EVENT_ORDER: EventType[] = ['new_claim', 'shift_confirmed', 'shift_canceled', 'dnr', 'credential_expiry']

interface Props {
  channels: Channel[]
}

type Prefs = Record<EventType, Record<Channel, boolean>>

function buildDefaultPrefs(channels: Channel[]): Prefs {
  const prefs = {} as Prefs
  for (const evt of EVENT_ORDER) {
    prefs[evt] = {} as Record<Channel, boolean>
    for (const ch of channels) {
      prefs[evt][ch] = true
    }
  }
  return prefs
}

export default function NotificationPreferencesForm({ channels }: Props) {
  const [prefs, setPrefs] = useState<Prefs>(buildDefaultPrefs(channels))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/notifications/preferences')
      .then(r => r.json())
      .then(json => {
        if (json.preferences && Object.keys(json.preferences).length > 0) {
          // Merge loaded prefs with defaults (in case new event types were added)
          const merged = buildDefaultPrefs(channels)
          for (const evt of EVENT_ORDER) {
            for (const ch of channels) {
              if (json.preferences[evt]?.[ch] !== undefined) {
                merged[evt][ch] = json.preferences[evt][ch]
              }
            }
          }
          setPrefs(merged)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(evt: EventType, ch: Channel) {
    setPrefs(p => ({
      ...p,
      [evt]: { ...p[evt], [ch]: !p[evt][ch] },
    }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: prefs }),
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

  const CHANNEL_LABELS: Record<Channel, string> = { in_app: 'In-App', email: 'Email', sms: 'SMS' }

  if (loading) {
    return <p className="text-sm text-gray-400">Loading preferences…</p>
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Event</th>
              {channels.map(ch => (
                <th key={ch} className="text-center text-xs font-medium text-gray-500 pb-2 px-3 min-w-[64px]">
                  {CHANNEL_LABELS[ch]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {EVENT_ORDER.map(evt => (
              <tr key={evt}>
                <td className="py-2.5 pr-4 text-gray-700">{EVENT_LABELS[evt]}</td>
                {channels.map(ch => (
                  <td key={ch} className="py-2.5 px-3 text-center">
                    <input
                      type="checkbox"
                      checked={prefs[evt]?.[ch] ?? true}
                      onChange={() => toggle(evt, ch)}
                      className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-2">Uncheck a box to opt out of that notification channel for that event.</p>

      {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="mt-4 px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Preferences'}
      </button>
    </div>
  )
}
