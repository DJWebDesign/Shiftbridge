'use client'

import { useState } from 'react'
import Link from 'next/link'
import AddressAutocompleteInput from '@/components/ui/AddressAutocompleteInput'
import { formatPhoneInput } from '@/lib/utils/phone'

const CREDENTIAL_COLORS: Record<string, { bg: string; color: string }> = {
  CNA:    { bg: '#CCFBF1', color: '#0F766E' },
  CMA:    { bg: '#F3E8FF', color: '#7C3AED' },
  LPN:    { bg: '#DBEAFE', color: '#1D4ED8' },
  LPN_IV: { bg: '#E0E7FF', color: '#4338CA' },
  RN:     { bg: '#FEE2E2', color: '#B91C1C' },
}

function expiryColor(d: string | null | undefined): string {
  if (!d) return '#5B6B80'
  const date = new Date(d)
  const now = new Date()
  const soon = new Date(); soon.setDate(now.getDate() + 30)
  if (date < now) return '#B91C1C'
  if (date < soon) return '#B45309'
  return '#0D1B2A'
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Reusable field components ──────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.07em] mb-1" style={{ color: '#94A3B8' }}>{children}</p>
}

function ReadValue({ children, color }: { children: React.ReactNode; color?: string }) {
  return <p className="text-[14px] font-medium" style={{ color: color ?? '#0D1B2A' }}>{children || '—'}</p>
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

function SelectInput({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-lg text-[13px] outline-none transition-all"
      style={{ border: '1px solid #E4EAF0', background: '#fff', color: '#0D1B2A' }}
      onFocus={e => { (e.target as HTMLElement).style.borderColor = '#0D9488' }}
      onBlur={e => { (e.target as HTMLElement).style.borderColor = '#E4EAF0' }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({ title, subtitle, children, editing, onEdit, onSave, onCancel, saving, error }: {
  title: string; subtitle?: string; children: React.ReactNode
  editing: boolean; onEdit: () => void; onSave: () => void; onCancel: () => void
  saving?: boolean; error?: string | null
}) {
  return (
    <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E4EAF0' }}>
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
        <div>
          <h2 className="text-[13px] font-semibold" style={{ color: '#0D1B2A' }}>{title}</h2>
          {subtitle && <p className="text-[11px] mt-0.5" style={{ color: '#94A3B8' }}>{subtitle}</p>}
        </div>
        {!editing ? (
          <button
            onClick={onEdit}
            className="text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: '#F4F7FA', color: '#0D9488' }}
          >
            Edit
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="text-[12px] font-medium px-3 py-1.5 rounded-lg"
              style={{ background: '#F4F7FA', color: '#5B6B80' }}
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-lg text-white transition-colors disabled:opacity-50"
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
        {children}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export interface NurseProfileData {
  agencyId: string
  nurseId: string
  fullName: string
  email: string
  phone: string | null
  homeAddress: string | null
  homeAddressLat: number | null
  homeAddressLng: number | null
  credentialType: string
  licenseNumber: string
  licenseState: string
  licenseStatus: string
  licenseExpiration: string | null
  ivCertified: boolean
  ivCertSource: string | null
  nursysLastChecked: string | null
  cprExpiration: string | null
  tbTestDate: string | null
  covidVaccinated: boolean
  rosterStatus: string
  basePayRate: number | null
  notes: string | null
  addedAt: string
}

export default function NurseProfileClient({ data, backHref }: { data: NurseProfileData; backHref?: string }) {
  const { agencyId, nurseId } = data
  const rosterHref = backHref ?? `/agency/${agencyId}/staff`
  const cred = CREDENTIAL_COLORS[data.credentialType]

  // ── License edit state ──
  const [licEditing, setLicEditing] = useState(false)
  const [licSaving, setLicSaving] = useState(false)
  const [licError, setLicError] = useState<string | null>(null)
  const [licForm, setLicForm] = useState({
    licenseNumber: data.licenseNumber,
    licenseState: data.licenseState,
    licenseStatus: data.licenseStatus,
    licenseExpiration: data.licenseExpiration ?? '',
    credentialType: data.credentialType,
    ivCertified: data.ivCertified,
  })
  const [licDisplay, setLicDisplay] = useState({ ...licForm })

  async function saveLicense() {
    setLicSaving(true); setLicError(null)
    const res = await fetch(`/api/staff/${nurseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: 'license', agencyId, ...licForm }),
    })
    const json = await res.json()
    if (!res.ok) { setLicError(json.error ?? 'Save failed'); setLicSaving(false); return }
    setLicDisplay({ ...licForm })
    setLicEditing(false); setLicSaving(false)
  }

  // ── Contact edit state ──
  const [conEditing, setConEditing] = useState(false)
  const [conSaving, setConSaving] = useState(false)
  const [conError, setConError] = useState<string | null>(null)
  const [conForm, setConForm] = useState({
    phone: data.phone ?? '',
    homeAddressLine1: data.homeAddress?.split(',')[0]?.trim() ?? '',
    homeAddressCity: data.homeAddress?.split(',')[1]?.trim() ?? '',
    homeAddressState: data.homeAddress?.split(',')[2]?.trim().split(' ')[0] ?? '',
    homeAddressZip: data.homeAddress?.split(',')[2]?.trim().split(' ')[1] ?? '',
    homeAddressLat: data.homeAddressLat,
    homeAddressLng: data.homeAddressLng,
  })
  const [conDisplay, setConDisplay] = useState({ ...conForm })

  async function saveContact() {
    setConSaving(true); setConError(null)
    const res = await fetch(`/api/staff/${nurseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: 'contact', agencyId,
        phone: conForm.phone,
        homeAddress: [conForm.homeAddressLine1, conForm.homeAddressCity, `${conForm.homeAddressState} ${conForm.homeAddressZip}`.trim()].filter(Boolean).join(', ') || null,
        homeAddressLat: conForm.homeAddressLat,
        homeAddressLng: conForm.homeAddressLng,
      }),
    })
    const json = await res.json()
    if (!res.ok) { setConError(json.error ?? 'Save failed'); setConSaving(false); return }
    setConDisplay({ ...conForm })
    setConEditing(false); setConSaving(false)
  }

  // ── Health edit state ──
  const [hlthEditing, setHlthEditing] = useState(false)
  const [hlthSaving, setHlthSaving] = useState(false)
  const [hlthError, setHlthError] = useState<string | null>(null)
  const [hlthForm, setHlthForm] = useState({
    cprExpiration: data.cprExpiration ?? '',
    tbTestDate: data.tbTestDate ?? '',
    covidVaccinated: data.covidVaccinated,
  })
  const [hlthDisplay, setHlthDisplay] = useState({ ...hlthForm })

  async function saveHealth() {
    setHlthSaving(true); setHlthError(null)
    const res = await fetch(`/api/staff/${nurseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: 'health', agencyId, ...hlthForm }),
    })
    const json = await res.json()
    if (!res.ok) { setHlthError(json.error ?? 'Save failed'); setHlthSaving(false); return }
    setHlthDisplay({ ...hlthForm })
    setHlthEditing(false); setHlthSaving(false)
  }

  // ── Remove from roster state ──
  const [removeConfirm, setRemoveConfirm] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  async function handleRemove() {
    setRemoving(true); setRemoveError(null)
    const res = await fetch(`/api/staff/${nurseId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agencyId }),
    })
    const json = await res.json()
    if (!res.ok) { setRemoveError(json.error ?? 'Failed to remove nurse'); setRemoving(false); return }
    window.location.href = rosterHref
  }

  // ── Reactivate state ──
  const [reactivating, setReactivating] = useState(false)
  const [rosterStatus, setRosterStatus] = useState(data.rosterStatus)

  async function handleReactivate() {
    setReactivating(true)
    const res = await fetch(`/api/staff/${nurseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: 'agency', agencyId, basePayRate: data.basePayRate?.toString() ?? '', notes: data.notes ?? '', rosterStatus: 'active' }),
    })
    if (res.ok) setRosterStatus('active')
    setReactivating(false)
  }

  // ── Agency settings edit state ──
  const [agEditing, setAgEditing] = useState(false)
  const [agSaving, setAgSaving] = useState(false)
  const [agError, setAgError] = useState<string | null>(null)
  const [agForm, setAgForm] = useState({
    basePayRate: data.basePayRate?.toString() ?? '',
    notes: data.notes ?? '',
    rosterStatus: data.rosterStatus,
  })
  const [agDisplay, setAgDisplay] = useState({ ...agForm })

  async function saveAgency() {
    setAgSaving(true); setAgError(null)
    const res = await fetch(`/api/staff/${nurseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: 'agency', agencyId, ...agForm }),
    })
    const json = await res.json()
    if (!res.ok) { setAgError(json.error ?? 'Save failed'); setAgSaving(false); return }
    setAgDisplay({ ...agForm })
    setAgEditing(false); setAgSaving(false)
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href={rosterHref}
          className="text-[13px] font-medium mb-3 inline-flex items-center gap-1"
          style={{ color: '#5B6B80' }}>
          ← Staff Roster
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-serif text-[28px]" style={{ color: '#0D1B2A' }}>{data.fullName}</h1>
            <div className="flex items-center gap-2 mt-2">
              {cred && (
                <span className="text-[12px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: cred.bg, color: cred.color }}>
                  {data.credentialType}
                </span>
              )}
              {data.ivCertified && (
                <span className="text-[12px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: '#CFFAFE', color: '#0E7490' }}>
                  IV Certified
                </span>
              )}
              <span className="text-[12px] font-bold px-2.5 py-1 rounded-full"
                style={{
                  background: rosterStatus === 'active' ? '#DCFCE7' : '#F1F5F9',
                  color: rosterStatus === 'active' ? '#15803D' : '#5B6B80',
                }}>
                {rosterStatus}
              </span>
            </div>
          </div>

          {/* Remove / Reactivate */}
          <div className="flex flex-col items-end gap-2">
            {rosterStatus === 'inactive' ? (
              <button
                onClick={handleReactivate}
                disabled={reactivating}
                className="text-[13px] font-medium px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                style={{ color: '#15803D', border: '1px solid #BBF7D0', background: '#DCFCE7' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#BBF7D0'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#DCFCE7'}
              >
                {reactivating ? 'Reactivating…' : 'Reactivate'}
              </button>
            ) : !removeConfirm ? (
              <button
                onClick={() => setRemoveConfirm(true)}
                className="text-[13px] font-medium px-3 py-1.5 rounded-lg transition-all"
                style={{ color: '#B91C1C', border: '1px solid #FECACA', background: '#FEF2F2' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#FEE2E2'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#FEF2F2'}
              >
                Remove from Roster
              </button>
            ) : (
              <div className="text-right">
                <p className="text-[13px] font-medium mb-2" style={{ color: '#B91C1C' }}>
                  Remove {data.fullName} from your roster?
                </p>
                {removeError && (
                  <p className="text-[12px] mb-2" style={{ color: '#B91C1C' }}>{removeError}</p>
                )}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { setRemoveConfirm(false); setRemoveError(null) }}
                    disabled={removing}
                    className="text-[13px] px-3 py-1.5 rounded-lg"
                    style={{ border: '1px solid #E4EAF0', color: '#5B6B80' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRemove}
                    disabled={removing}
                    className="text-[13px] font-medium px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
                    style={{ background: '#B91C1C' }}
                  >
                    {removing ? 'Removing…' : 'Yes, Remove'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">

        {/* License */}
        <Section title="License" editing={licEditing}
          onEdit={() => setLicEditing(true)}
          onCancel={() => { setLicEditing(false); setLicForm({ ...licDisplay }); setLicError(null) }}
          onSave={saveLicense} saving={licSaving} error={licError}>
          {!licEditing ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
              <div><Label>Credential</Label><ReadValue>{licDisplay.credentialType}</ReadValue></div>
              <div><Label>License #</Label><ReadValue>{licDisplay.licenseNumber} ({licDisplay.licenseState})</ReadValue></div>
              <div><Label>Status</Label><ReadValue color={licDisplay.licenseStatus === 'active' ? '#15803D' : '#B91C1C'}>{licDisplay.licenseStatus}</ReadValue></div>
              <div><Label>Expires</Label><ReadValue color={expiryColor(licDisplay.licenseExpiration)}>{formatDate(licDisplay.licenseExpiration)}</ReadValue></div>
              <div><Label>IV Certified</Label><ReadValue>{licDisplay.ivCertified ? 'Yes' : 'No'}</ReadValue></div>
              <div><Label>NURSYS Checked</Label><ReadValue>{formatDate(data.nursysLastChecked)}</ReadValue></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <Label>Credential</Label>
                <SelectInput value={licForm.credentialType} onChange={v => setLicForm(f => ({ ...f, credentialType: v }))}
                  options={['CNA','CMA','LPN','LPN_IV','RN'].map(c => ({ value: c, label: c }))} />
              </div>
              <div>
                <Label>License #</Label>
                <TextInput value={licForm.licenseNumber} onChange={v => setLicForm(f => ({ ...f, licenseNumber: v }))} />
              </div>
              <div>
                <Label>State</Label>
                <TextInput value={licForm.licenseState} onChange={v => setLicForm(f => ({ ...f, licenseState: v.toUpperCase().slice(0, 2) }))} placeholder="LA" />
              </div>
              <div>
                <Label>License Status</Label>
                <SelectInput value={licForm.licenseStatus} onChange={v => setLicForm(f => ({ ...f, licenseStatus: v }))}
                  options={['active','expired','suspended','revoked'].map(s => ({ value: s, label: s }))} />
              </div>
              <div>
                <Label>Expiration Date</Label>
                <TextInput type="date" value={licForm.licenseExpiration} onChange={v => setLicForm(f => ({ ...f, licenseExpiration: v }))} />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input type="checkbox" id="iv_cert" checked={licForm.ivCertified}
                  onChange={e => setLicForm(f => ({ ...f, ivCertified: e.target.checked }))}
                  className="w-4 h-4 accent-teal-600" />
                <label htmlFor="iv_cert" className="text-[13px]" style={{ color: '#0D1B2A' }}>IV Certified</label>
              </div>
            </div>
          )}
        </Section>

        {/* Contact */}
        <Section title="Contact" editing={conEditing}
          onEdit={() => setConEditing(true)}
          onCancel={() => { setConEditing(false); setConForm({ ...conDisplay }); setConError(null) }}
          onSave={saveContact} saving={conSaving} error={conError}>
          {!conEditing ? (
            <div className="grid grid-cols-2 gap-5">
              <div><Label>Email</Label><ReadValue>{data.email}</ReadValue></div>
              <div><Label>Phone</Label><ReadValue>{conDisplay.phone || '—'}</ReadValue></div>
              <div className="col-span-2">
                <Label>Home Address</Label>
                <ReadValue>{[conDisplay.homeAddressLine1, conDisplay.homeAddressCity, `${conDisplay.homeAddressState} ${conDisplay.homeAddressZip}`.trim()].filter(Boolean).join(', ') || '—'}</ReadValue>
                <p className="text-[11px] mt-1" style={{ color: '#94A3B8' }}>Used for drive time estimates — never shared with facilities</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <p className="text-[13px] py-2" style={{ color: '#5B6B80' }}>{data.email} <span style={{ color: '#94A3B8' }}>(contact support to change)</span></p>
              </div>
              <div>
                <Label>Phone</Label>
                <TextInput type="tel" value={conForm.phone} onChange={v => setConForm(f => ({ ...f, phone: formatPhoneInput(v) }))} placeholder="(555) 555-5555" />
              </div>
              <div className="col-span-2">
                <Label>Home Address</Label>
                <AddressAutocompleteInput
                  value={conForm.homeAddressLine1}
                  onChange={v => setConForm(f => ({ ...f, homeAddressLine1: v }))}
                  onPlaceSelect={parsed => setConForm(f => ({
                    ...f,
                    homeAddressLine1: parsed.addressLine1,
                    homeAddressCity: parsed.city,
                    homeAddressState: parsed.state,
                    homeAddressZip: parsed.zip,
                    homeAddressLat: parsed.lat,
                    homeAddressLng: parsed.lng,
                  }))}
                  placeholder="123 Main St"
                  inputClassName="w-full px-3 py-2 rounded-lg text-[13px] outline-none transition-all"
                  inputStyle={{ border: '1px solid #E4EAF0', background: '#fff', color: '#0D1B2A' }}
                  onFocus={e => { e.target.style.borderColor = '#0D9488'; e.target.style.boxShadow = '0 0 0 3px rgba(13,148,136,0.1)' }}
                  onBlur={e => { e.target.style.borderColor = '#E4EAF0'; e.target.style.boxShadow = 'none' }}
                />
                <p className="text-[11px] mt-1" style={{ color: '#94A3B8' }}>Used for drive time estimates — never shared with facilities</p>
              </div>
              <div>
                <Label>City</Label>
                <TextInput value={conForm.homeAddressCity} onChange={v => setConForm(f => ({ ...f, homeAddressCity: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>State</Label>
                  <TextInput value={conForm.homeAddressState} onChange={v => setConForm(f => ({ ...f, homeAddressState: v.toUpperCase().slice(0, 2) }))} placeholder="LA" />
                </div>
                <div>
                  <Label>ZIP</Label>
                  <TextInput value={conForm.homeAddressZip} onChange={v => setConForm(f => ({ ...f, homeAddressZip: v }))} placeholder="70801" />
                </div>
              </div>
            </div>
          )}
        </Section>

        {/* Health Credentials */}
        <Section title="Health Credentials" editing={hlthEditing}
          onEdit={() => setHlthEditing(true)}
          onCancel={() => { setHlthEditing(false); setHlthForm({ ...hlthDisplay }); setHlthError(null) }}
          onSave={saveHealth} saving={hlthSaving} error={hlthError}>
          {!hlthEditing ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
              <div><Label>CPR Expires</Label><ReadValue color={expiryColor(hlthDisplay.cprExpiration)}>{formatDate(hlthDisplay.cprExpiration)}</ReadValue></div>
              <div><Label>TB Test Date</Label><ReadValue>{formatDate(hlthDisplay.tbTestDate)}</ReadValue></div>
              <div><Label>COVID Vaccinated</Label><ReadValue>{hlthDisplay.covidVaccinated ? 'Yes' : 'No'}</ReadValue></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <Label>CPR Expiration</Label>
                <TextInput type="date" value={hlthForm.cprExpiration} onChange={v => setHlthForm(f => ({ ...f, cprExpiration: v }))} />
              </div>
              <div>
                <Label>TB Test Date</Label>
                <TextInput type="date" value={hlthForm.tbTestDate} onChange={v => setHlthForm(f => ({ ...f, tbTestDate: v }))} />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input type="checkbox" id="covid_vax" checked={hlthForm.covidVaccinated}
                  onChange={e => setHlthForm(f => ({ ...f, covidVaccinated: e.target.checked }))}
                  className="w-4 h-4 accent-teal-600" />
                <label htmlFor="covid_vax" className="text-[13px]" style={{ color: '#0D1B2A' }}>COVID Vaccinated</label>
              </div>
            </div>
          )}
        </Section>

        {/* Agency Settings */}
        <Section title="Agency Settings" subtitle="Private — not visible to facilities" editing={agEditing}
          onEdit={() => setAgEditing(true)}
          onCancel={() => { setAgEditing(false); setAgForm({ ...agDisplay }); setAgError(null) }}
          onSave={saveAgency} saving={agSaving} error={agError}>
          {!agEditing ? (
            <div className="grid grid-cols-2 gap-5">
              <div><Label>Base Pay Rate</Label><ReadValue>{agDisplay.basePayRate ? `$${Number(agDisplay.basePayRate).toFixed(2)}/hr` : 'Not set'}</ReadValue></div>
              <div><Label>Roster Status</Label><ReadValue>{agDisplay.rosterStatus}</ReadValue></div>
              <div><Label>Added</Label><ReadValue>{formatDate(data.addedAt)}</ReadValue></div>
              {agDisplay.notes && <div className="col-span-2"><Label>Notes</Label><ReadValue>{agDisplay.notes}</ReadValue></div>}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Base Pay Rate ($/hr)</Label>
                <TextInput type="number" value={agForm.basePayRate} onChange={v => setAgForm(f => ({ ...f, basePayRate: v }))} placeholder="0.00" />
              </div>
              <div>
                <Label>Roster Status</Label>
                <SelectInput value={agForm.rosterStatus} onChange={v => setAgForm(f => ({ ...f, rosterStatus: v }))}
                  options={['active','inactive','suspended'].map(s => ({ value: s, label: s }))} />
              </div>
              <div className="col-span-2">
                <Label>Notes</Label>
                <textarea
                  value={agForm.notes}
                  onChange={e => setAgForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg text-[13px] outline-none transition-all resize-none"
                  style={{ border: '1px solid #E4EAF0', background: '#fff', color: '#0D1B2A' }}
                  onFocus={e => { (e.target as HTMLElement).style.borderColor = '#0D9488'; (e.target as HTMLElement).style.boxShadow = '0 0 0 3px rgba(13,148,136,0.1)' }}
                  onBlur={e => { (e.target as HTMLElement).style.borderColor = '#E4EAF0'; (e.target as HTMLElement).style.boxShadow = 'none' }}
                />
              </div>
            </div>
          )}
        </Section>

      </div>
    </div>
  )
}
