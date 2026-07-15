'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import AgencyShiftCalendarView from '@/components/calendar/AgencyShiftCalendarView'
import AddressAutocompleteInput from '@/components/ui/AddressAutocompleteInput'
import type { Database } from '@/lib/supabase/types'

type Shift = Database['public']['Tables']['shifts']['Row']

const FACILITY_TYPE_OPTIONS = [
  { value: 'long_term_care',  label: 'Long-Term Care'  },
  { value: 'assisted_living', label: 'Assisted Living'  },
  { value: 'hospital',        label: 'Hospital'         },
  { value: 'rehabilitation',  label: 'Rehabilitation'   },
  { value: 'memory_care',     label: 'Memory Care'      },
]

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  unmatched:       { bg: '#F1F5F9', color: '#5B6B80', label: 'Unmatched'        },
  match_detected:  { bg: '#FEF3C7', color: '#B45309', label: 'Match Detected'   },
  request_pending: { bg: '#DBEAFE', color: '#1D4ED8', label: 'Request Pending'  },
  connected:       { bg: '#DCFCE7', color: '#15803D', label: 'Connected'        },
  declined:        { bg: '#FEE2E2', color: '#B91C1C', label: 'Declined'         },
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
  facility_notes: string | null
  connection_status: string
}

interface Props {
  agencyId: string
  placeholder: PlaceholderFacility
  initialShifts: Shift[]
  initialYear: number
  initialMonth: number
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.07em] mb-1" style={{ color: '#94A3B8' }}>{children}</p>
}

function TextInput({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-lg text-[13px] outline-none transition-all"
      style={{ border: '1px solid #E4EAF0', background: '#fff', color: '#0D1B2A' }}
      onFocus={e => { (e.target as HTMLElement).style.borderColor = '#0D9488'; (e.target as HTMLElement).style.boxShadow = '0 0 0 3px rgba(13,148,136,0.1)' }}
      onBlur={e => { (e.target as HTMLElement).style.borderColor = '#E4EAF0'; (e.target as HTMLElement).style.boxShadow = 'none' }}
    />
  )
}

export default function PlaceholderFacilityDetailClient({
  agencyId,
  placeholder,
  initialShifts,
  initialYear,
  initialMonth,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const facilitiesHref = pathname.replace(/\/facilities\/placeholder\/[^/]+$/, '/facilities')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [form, setForm] = useState({
    name:              placeholder.name,
    facility_type:     placeholder.facility_type,
    address_line1:     placeholder.address_line1,
    address_line2:     placeholder.address_line2 ?? '',
    city:              placeholder.city,
    state:             placeholder.state,
    zip:               placeholder.zip,
    coordinator_email: placeholder.coordinator_email ?? '',
    facility_notes:    placeholder.facility_notes ?? '',
  })
  const [display, setDisplay] = useState({ ...form })

  const status = STATUS_STYLES[placeholder.connection_status] ?? STATUS_STYLES.unmatched
  const facilityNames: Record<string, string> = { [placeholder.id]: display.name }

  async function save() {
    setSaving(true); setError(null)
    const res = await fetch(`/api/placeholders/${placeholder.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agencyId, ...form, lat, lng }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Save failed'); setSaving(false); return }
    setDisplay({ ...form })
    setEditing(false); setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/placeholders/${placeholder.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json()
      setError(json.error ?? 'Delete failed')
      setDeleting(false)
      setConfirmDelete(false)
      return
    }
    router.push(facilitiesHref)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href={facilitiesHref}
          className="text-[13px] font-medium inline-flex items-center gap-1 mb-3"
          style={{ color: '#5B6B80' }}
        >
          ← Facilities
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-[28px]" style={{ color: '#0D1B2A' }}>{display.name}</h1>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#E0E7FF', color: '#4338CA' }}>
                Placeholder
              </span>
            </div>
            <p className="text-[13px] mt-1" style={{ color: '#5B6B80' }}>
              {FACILITY_TYPE_OPTIONS.find(o => o.value === display.facility_type)?.label ?? display.facility_type}
            </p>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[12px] font-bold px-3 py-1 rounded-full"
              style={{ background: status.bg, color: status.color }}>
              {status.label}
            </span>
            {placeholder.connection_status !== 'connected' && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}
              >
                Delete
              </button>
            )}
            {confirmDelete && (
              <div className="flex items-center gap-2">
                <span className="text-[12px]" style={{ color: '#B91C1C' }}>Delete this placeholder?</span>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-[12px] font-medium px-3 py-1.5 rounded-lg"
                  style={{ background: '#F4F7FA', color: '#5B6B80' }}
                >
                  Keep
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-[12px] font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
                  style={{ background: '#DC2626' }}
                >
                  {deleting ? 'Deleting…' : 'Yes, Delete'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info card */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E4EAF0' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <h2 className="text-[13px] font-semibold" style={{ color: '#0D1B2A' }}>Facility Details</h2>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: '#F4F7FA', color: '#0D9488' }}
            >
              Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => { setEditing(false); setForm({ ...display }); setError(null) }}
                className="text-[12px] font-medium px-3 py-1.5 rounded-lg"
                style={{ background: '#F4F7FA', color: '#5B6B80' }}
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="text-[12px] font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
                style={{ background: '#0D9488' }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>

        <div className="px-6 py-5">
          {error && (
            <div className="mb-4 px-4 py-2.5 rounded-lg text-[13px]"
              style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}>
              {error}
            </div>
          )}

          {!editing ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
              <div><Label>Name</Label><p className="text-[14px] font-medium" style={{ color: '#0D1B2A' }}>{display.name}</p></div>
              <div><Label>Type</Label><p className="text-[14px] font-medium" style={{ color: '#0D1B2A' }}>{FACILITY_TYPE_OPTIONS.find(o => o.value === display.facility_type)?.label}</p></div>
              <div><Label>Address</Label><p className="text-[14px] font-medium" style={{ color: '#0D1B2A' }}>{display.address_line1}{display.address_line2 ? ', ' + display.address_line2 : ''}</p></div>
              <div><Label>City</Label><p className="text-[14px] font-medium" style={{ color: '#0D1B2A' }}>{display.city}</p></div>
              <div><Label>State / ZIP</Label><p className="text-[14px] font-medium" style={{ color: '#0D1B2A' }}>{display.state} {display.zip}</p></div>
              <div><Label>Coordinator Email</Label><p className="text-[14px] font-medium" style={{ color: '#0D1B2A' }}>{display.coordinator_email || '—'}</p></div>
              {display.facility_notes && (
                <div className="col-span-2 sm:col-span-3">
                  <Label>Facility Notes for Nurses</Label>
                  <p className="text-[14px] font-medium whitespace-pre-wrap" style={{ color: '#0D1B2A' }}>{display.facility_notes}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <Label>Facility Name</Label>
                <TextInput value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
              </div>
              <div>
                <Label>Type</Label>
                <select
                  value={form.facility_type}
                  onChange={e => setForm(f => ({ ...f, facility_type: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
                  style={{ border: '1px solid #E4EAF0', background: '#fff', color: '#0D1B2A' }}
                >
                  {FACILITY_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <Label>Address Line 1</Label>
                <AddressAutocompleteInput
                  value={form.address_line1}
                  onChange={v => setForm(f => ({ ...f, address_line1: v }))}
                  onPlaceSelect={parsed => {
                    setForm(f => ({
                      ...f,
                      address_line1: parsed.addressLine1,
                      city: parsed.city,
                      state: parsed.state,
                      zip: parsed.zip,
                    }))
                    setLat(parsed.lat)
                    setLng(parsed.lng)
                  }}
                  placeholder="123 Main St"
                  inputClassName="w-full px-3 py-2 rounded-lg text-[13px] outline-none transition-all"
                  inputStyle={{ border: '1px solid #E4EAF0', background: '#fff', color: '#0D1B2A' }}
                  onFocus={e => { e.target.style.borderColor = '#0D9488'; e.target.style.boxShadow = '0 0 0 3px rgba(13,148,136,0.1)' }}
                  onBlur={e => { e.target.style.borderColor = '#E4EAF0'; e.target.style.boxShadow = 'none' }}
                />
              </div>
              <div>
                <Label>Address Line 2</Label>
                <TextInput value={form.address_line2} onChange={v => setForm(f => ({ ...f, address_line2: v }))} placeholder="Optional" />
              </div>
              <div>
                <Label>City</Label>
                <TextInput value={form.city} onChange={v => setForm(f => ({ ...f, city: v }))} />
              </div>
              <div>
                <Label>State</Label>
                <TextInput value={form.state} onChange={v => setForm(f => ({ ...f, state: v.toUpperCase().slice(0, 2) }))} placeholder="LA" />
              </div>
              <div>
                <Label>ZIP</Label>
                <TextInput value={form.zip} onChange={v => setForm(f => ({ ...f, zip: v }))} />
              </div>
              <div>
                <Label>Coordinator Email</Label>
                <TextInput type="email" value={form.coordinator_email} onChange={v => setForm(f => ({ ...f, coordinator_email: v }))} placeholder="Optional" />
              </div>
              <div className="col-span-2 sm:col-span-3">
                <Label>Facility Notes for Nurses</Label>
                <textarea
                  value={form.facility_notes}
                  onChange={e => setForm(f => ({ ...f, facility_notes: e.target.value }))}
                  rows={3}
                  placeholder="e.g. Park in the rear lot. Enter through the side door. Check in with charge nurse."
                  className="w-full px-3 py-2 rounded-lg text-[13px] outline-none resize-none transition-all"
                  style={{ border: '1px solid #E4EAF0', background: '#fff', color: '#0D1B2A', lineHeight: '1.6' }}
                  onFocus={e => { e.target.style.borderColor = '#0D9488'; e.target.style.boxShadow = '0 0 0 3px rgba(13,148,136,0.1)' }}
                  onBlur={e => { e.target.style.borderColor = '#E4EAF0'; e.target.style.boxShadow = 'none' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Shift calendar */}
      <div data-tour-id="placeholder-calendar" className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E4EAF0' }}>
        <div className="px-6 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <h2 className="text-[13px] font-semibold" style={{ color: '#0D1B2A' }}>Placeholder Shifts</h2>
          <p className="text-[12px] mt-0.5" style={{ color: '#94A3B8' }}>Click a day to view or post shifts</p>
        </div>
        <div className="p-4">
          <AgencyShiftCalendarView
            agencyId={agencyId}
            initialShifts={initialShifts}
            initialYear={initialYear}
            initialMonth={initialMonth}
            placeholderFacilities={[{ id: placeholder.id, name: display.name }]}
            connectedFacilities={[]}
            facilityNames={facilityNames}
            filterPlaceholderId={placeholder.id}
          />
        </div>
      </div>
    </div>
  )
}
