'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AddressAutocompleteInput from '@/components/ui/AddressAutocompleteInput'
import { formatPhoneInput } from '@/lib/utils/phone'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

const CREDENTIAL_TYPES = ['CNA', 'CMA', 'LPN', 'LPN_IV', 'RN'] as const
type CredentialType = typeof CREDENTIAL_TYPES[number]

type FormData = {
  email: string
  fullName: string
  phone: string
  licenseNumber: string
  licenseState: string
  credentialType: CredentialType | ''
  licenseStatus: string
  licenseExpiration: string
  ivCertified: boolean
  ivCertSource: string | null
  cprExpiration: string
  tbTestDate: string
  covidVaccinated: boolean
  homeAddressLine1: string
  homeAddressCity: string
  homeAddressState: string
  homeAddressZip: string
  homeAddressLat: number | null
  homeAddressLng: number | null
  basePayRate: string
  notes: string
}

export default function NursysLookupForm({ agencyId, facilityId }: { agencyId?: string; facilityId?: string }) {
  const isFacilityMode = !!facilityId
  const router = useRouter()

  const [step, setStep] = useState<'select-credential' | 'complete'>('select-credential')

  const [form, setForm] = useState<FormData>({
    email: '', fullName: '', phone: '',
    licenseNumber: '', licenseState: '',
    credentialType: '', licenseStatus: 'active',
    licenseExpiration: '', ivCertified: false, ivCertSource: null,
    cprExpiration: '', tbTestDate: '', covidVaccinated: false,
    homeAddressLine1: '', homeAddressCity: '', homeAddressState: '', homeAddressZip: '',
    homeAddressLat: null, homeAddressLng: null,
    basePayRate: '', notes: '',
  })

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function set(field: keyof FormData, value: string | boolean | null) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleCredentialSelect(cred: CredentialType) {
    setForm(prev => ({
      ...prev,
      credentialType: cred,
      ivCertified:    cred === 'RN',
      ivCertSource:   cred === 'RN' ? 'implicit_rn' : null,
    }))
    setStep('complete')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setSubmitting(true)

    try {
      const endpoint = isFacilityMode ? '/api/facility-staff/create' : '/api/staff/create'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:             form.email,
          fullName:          form.fullName,
          phone:             form.phone || null,
          licenseNumber:     form.licenseNumber,
          licenseState:      form.licenseState,
          credentialType:    form.credentialType,
          licenseStatus:     form.licenseStatus,
          licenseExpiration: form.licenseExpiration || null,
          ivCertified:       form.ivCertified,
          ivCertSource:      form.ivCertSource,
          cprExpiration:     form.cprExpiration || null,
          tbTestDate:        form.tbTestDate || null,
          covidVaccinated:   form.covidVaccinated,
          homeAddress:       [form.homeAddressLine1, form.homeAddressCity, `${form.homeAddressState} ${form.homeAddressZip}`.trim()].filter(Boolean).join(', ') || null,
          homeAddressLat:    form.homeAddressLat,
          homeAddressLng:    form.homeAddressLng,
          basePayRate:       form.basePayRate || null,
          notes:             form.notes || null,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        if (isFacilityMode) {
          window.location.href = `/facility/${facilityId}/staff/${data.nurseProfileId}`
        } else {
          window.location.href = `/agency/${agencyId}/staff/${data.nurseProfileId}`
        }
      } else {
        setSubmitError(data.error ?? 'Failed to add nurse. Please try again.')
      }
    } catch {
      setSubmitError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Step 1: Select credential type ───────────────────────────────────────
  if (step === 'select-credential') {
    return (
      <div className="max-w-lg">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Select Credential Type</h2>
          <p className="text-sm text-gray-500 mb-5">
            Choose the credential type to continue enrolling this staff member.
          </p>

          <div className="space-y-2">
            {CREDENTIAL_TYPES.map(cred => (
              <button
                key={cred}
                type="button"
                onClick={() => handleCredentialSelect(cred)}
                className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:border-teal-400 hover:bg-brand-tint transition-colors"
              >
                <span className="font-medium text-gray-900">{cred}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Step 2: Complete profile form ─────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">

      {/* License info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">License Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
            <input
              type="text"
              value={form.licenseNumber}
              onChange={e => set('licenseNumber', e.target.value.toUpperCase())}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
            <input
              type="text"
              value={form.licenseState}
              onChange={e => set('licenseState', e.target.value.toUpperCase())}
              required
              maxLength={2}
              placeholder="LA"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Credential Type</label>
            <select
              value={form.credentialType}
              onChange={e => {
                const cred = e.target.value as CredentialType
                set('credentialType', cred)
                if (cred === 'RN') { set('ivCertified', true); set('ivCertSource', 'implicit_rn') }
                else if (cred !== 'LPN_IV') { set('ivCertified', false); set('ivCertSource', null) }
              }}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">Select</option>
              {CREDENTIAL_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">License Status</label>
            <select
              value={form.licenseStatus}
              onChange={e => set('licenseStatus', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="suspended">Suspended</option>
              <option value="revoked">Revoked</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">License Expiration</label>
            <input
              type="date"
              value={form.licenseExpiration}
              onChange={e => set('licenseExpiration', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div className="flex items-center gap-3 pt-5">
            <input
              type="checkbox"
              id="ivCertified"
              checked={form.ivCertified}
              onChange={e => {
                set('ivCertified', e.target.checked)
                if (e.target.checked && form.credentialType !== 'RN') set('ivCertSource', 'manual')
                else if (!e.target.checked) set('ivCertSource', null)
              }}
              disabled={form.credentialType === 'RN'}
              className="h-4 w-4 text-brand rounded"
            />
            <label htmlFor="ivCertified" className="text-sm text-gray-700">
              IV Certified
              {form.credentialType === 'RN' && <span className="text-gray-400 ml-1">(implicit for RN)</span>}
            </label>
          </div>
        </div>
      </div>

      {/* Personal info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Personal Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={form.fullName}
              onChange={e => set('fullName', e.target.value)}
              required
              placeholder="First Last"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              required
              placeholder="nurse@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <p className="text-xs text-gray-400 mt-1">Used for login — nurse will receive an invite</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => set('phone', formatPhoneInput(e.target.value))}
              placeholder="(555) 555-5555"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Home Address</label>
            <AddressAutocompleteInput
              value={form.homeAddressLine1}
              onChange={v => set('homeAddressLine1', v)}
              onPlaceSelect={parsed => {
                set('homeAddressLine1', parsed.addressLine1)
                set('homeAddressCity', parsed.city)
                set('homeAddressState', parsed.state)
                set('homeAddressZip', parsed.zip)
                setForm(f => ({ ...f, homeAddressLat: parsed.lat, homeAddressLng: parsed.lng }))
              }}
              placeholder="123 Main St"
              inputClassName="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <p className="text-xs text-gray-400 mt-1">Used for drive time estimates — never shared with facilities</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input type="text" value={form.homeAddressCity} onChange={e => set('homeAddressCity', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input type="text" value={form.homeAddressState} onChange={e => set('homeAddressState', e.target.value.toUpperCase().slice(0, 2))}
                maxLength={2} placeholder="LA"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand uppercase" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
              <input type="text" value={form.homeAddressZip} onChange={e => set('homeAddressZip', e.target.value)}
                maxLength={10} placeholder="70801"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>
        </div>
      </div>

      {/* Health credentials */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Health Credentials</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CPR Expiration</label>
            <input
              type="date"
              value={form.cprExpiration}
              onChange={e => set('cprExpiration', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">TB Test Date</label>
            <input
              type="date"
              value={form.tbTestDate}
              onChange={e => set('tbTestDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="covidVaccinated"
              checked={form.covidVaccinated}
              onChange={e => set('covidVaccinated', e.target.checked)}
              className="h-4 w-4 text-brand rounded"
            />
            <label htmlFor="covidVaccinated" className="text-sm text-gray-700">COVID Vaccinated</label>
          </div>
        </div>
      </div>

      {/* Pay / notes */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          {isFacilityMode ? 'Enrollment Settings' : 'Agency Settings'}
          {!isFacilityMode && <span className="text-xs font-normal text-gray-400 ml-1">(private — not visible to facilities)</span>}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base Pay Rate ($/hr)</label>
            <input
              type="number"
              value={form.basePayRate}
              onChange={e => set('basePayRate', e.target.value)}
              min="0"
              step="0.01"
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Internal Notes</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={3}
              placeholder="Private notes about this nurse..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
            />
          </div>
        </div>
      </div>

      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Enrolling...' : 'Enroll Staff'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
