'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import AddressAutocompleteInput from '@/components/ui/AddressAutocompleteInput'
import { formatPhoneInput } from '@/lib/utils/phone'

type EntityType = 'agency' | 'facility'

const FACILITY_TYPES = [
  { value: 'long_term_care',  label: 'Long-Term Care' },
  { value: 'assisted_living', label: 'Assisted Living' },
  { value: 'hospital',        label: 'Hospital' },
  { value: 'rehabilitation',  label: 'Rehabilitation' },
  { value: 'memory_care',     label: 'Memory Care' },
]

const inputClass = "w-full px-3.5 py-2.5 rounded-lg text-[14px] outline-none transition-all"
const inputStyle = { border: '1px solid #E4EAF0', background: '#fff', color: '#0D1B2A' }

function InputField({
  id, label, type = 'text', value, onChange, placeholder, required = true, autoComplete,
}: {
  id: string; label: string; type?: string; value: string
  onChange: (v: string) => void; placeholder?: string; required?: boolean; autoComplete?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-semibold mb-1.5" style={{ color: '#0D1B2A' }}>
        {label}
      </label>
      <input
        id={id} type={type} required={required} value={value} autoComplete={autoComplete}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClass} style={inputStyle}
        onFocus={e => { e.target.style.borderColor = '#0D9488'; e.target.style.boxShadow = '0 0 0 3px rgba(13,148,136,0.1)' }}
        onBlur={e => { e.target.style.borderColor = '#E4EAF0'; e.target.style.boxShadow = 'none' }}
      />
    </div>
  )
}

export default function SignupPage() {
  const [step, setStep] = useState<'choose' | 'form'>('choose')
  const [entityType, setEntityType] = useState<EntityType>('agency')

  const [fullName, setFullName]       = useState('')
  const [entityName, setEntityName]   = useState('')
  const [facilityType, setFacilityType] = useState('')
  const [email, setEmail]             = useState('')
  const [phone, setPhone]             = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [city, setCity]               = useState('')
  const [stateVal, setStateVal]       = useState('')
  const [zip, setZip]                 = useState('')
  const [addrLat, setAddrLat]         = useState<number | null>(null)
  const [addrLng, setAddrLng]         = useState<number | null>(null)
  const [password, setPassword]       = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [error, setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function chooseEntity(type: EntityType) {
    setEntityType(type)
    setStep('form')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType,
        fullName,
        email,
        password,
        phone,
        agencyName:   entityType === 'agency'   ? entityName : undefined,
        facilityName: entityType === 'facility' ? entityName : undefined,
        facilityType: entityType === 'facility' ? facilityType : undefined,
        addressLine1,
        city,
        state: stateVal,
        zip,
        lat: entityType === 'facility' ? addrLat : undefined,
        lng: entityType === 'facility' ? addrLng : undefined,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    // Sign in immediately after account creation
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (signInError) {
      setError('Account created but sign-in failed. Please go to login.')
      setLoading(false)
      return
    }

    window.location.href = '/'
  }

  if (step === 'choose') {
    return (
      <div>
        <h1 className="font-serif text-[30px] leading-tight mb-1" style={{ color: '#0D1B2A' }}>
          Create your account
        </h1>
        <p className="text-[14px] mb-8" style={{ color: '#5B6B80' }}>
          Which best describes you?
        </p>

        <div className="flex flex-col gap-4">
          <button
            onClick={() => chooseEntity('agency')}
            className="w-full text-left p-5 rounded-xl border-2 transition-all hover:shadow-md"
            style={{ borderColor: '#E4EAF0', background: '#fff' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#0D9488' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E4EAF0' }}
          >
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #0D9488, #0891B2)' }}>
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2}
                  viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-[15px]" style={{ color: '#0D1B2A' }}>Staffing Agency</p>
                <p className="text-[13px] mt-0.5" style={{ color: '#5B6B80' }}>
                  Add nurses, manage shifts, and connect with facilities
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => chooseEntity('facility')}
            className="w-full text-left p-5 rounded-xl border-2 transition-all hover:shadow-md"
            style={{ borderColor: '#E4EAF0', background: '#fff' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#0D9488' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E4EAF0' }}
          >
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}>
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2}
                  viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-[15px]" style={{ color: '#0D1B2A' }}>Healthcare Facility</p>
                <p className="text-[13px] mt-0.5" style={{ color: '#5B6B80' }}>
                  Post shifts, review claims, and manage your schedule
                </p>
              </div>
            </div>
          </button>
        </div>

        <p className="text-center text-[13px] mt-8" style={{ color: '#5B6B80' }}>
          Already have an account?{' '}
          <Link href="/login" className="font-medium" style={{ color: '#0D9488' }}>Sign in</Link>
        </p>
      </div>
    )
  }

  const isAgency = entityType === 'agency'

  return (
    <div>
      <button
        onClick={() => setStep('choose')}
        className="flex items-center gap-1.5 text-[13px] font-medium mb-6 transition-colors"
        style={{ color: '#5B6B80' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#0D9488' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#5B6B80' }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <h1 className="font-serif text-[28px] leading-tight mb-1" style={{ color: '#0D1B2A' }}>
        {isAgency ? 'Set up your agency' : 'Set up your facility'}
      </h1>
      <p className="text-[14px] mb-6" style={{ color: '#5B6B80' }}>
        {isAgency ? 'Staffing Agency' : 'Healthcare Facility'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <InputField id="fullName" label="Your full name" value={fullName} onChange={setFullName}
          placeholder="Jane Smith" autoComplete="name" />

        <InputField
          id="entityName"
          label={isAgency ? 'Agency name' : 'Facility name'}
          value={entityName} onChange={setEntityName}
          placeholder={isAgency ? 'Sunrise Staffing LLC' : 'Oakwood Care Center'}
          autoComplete="organization"
        />

        {!isAgency && (
          <div>
            <label htmlFor="facilityType" className="block text-[13px] font-semibold mb-1.5" style={{ color: '#0D1B2A' }}>
              Facility type
            </label>
            <select
              id="facilityType" required value={facilityType}
              onChange={e => setFacilityType(e.target.value)}
              className={inputClass} style={inputStyle}
              onFocus={e => { e.target.style.borderColor = '#0D9488'; e.target.style.boxShadow = '0 0 0 3px rgba(13,148,136,0.1)' }}
              onBlur={e => { e.target.style.borderColor = '#E4EAF0'; e.target.style.boxShadow = 'none' }}
            >
              <option value="">Select a type…</option>
              {FACILITY_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        )}

        <InputField id="email" label="Contact email" type="email" value={email} onChange={setEmail}
          placeholder="you@example.com" autoComplete="email" />

        <InputField id="phone" label="Phone number" type="tel" value={phone}
          onChange={v => setPhone(formatPhoneInput(v))}
          placeholder="(555) 555-5555" autoComplete="tel" />

        <div>
          <label htmlFor="addressLine1" className="block text-[13px] font-semibold mb-1.5" style={{ color: '#0D1B2A' }}>
            Street address
          </label>
          <AddressAutocompleteInput
            id="addressLine1"
            value={addressLine1}
            onChange={setAddressLine1}
            onPlaceSelect={parsed => {
              setAddressLine1(parsed.addressLine1)
              setCity(parsed.city)
              setStateVal(parsed.state)
              setZip(parsed.zip)
              setAddrLat(parsed.lat)
              setAddrLng(parsed.lng)
            }}
            placeholder="123 Main St"
            required
            inputClassName={inputClass}
            inputStyle={inputStyle}
            onFocus={e => { e.target.style.borderColor = '#0D9488'; e.target.style.boxShadow = '0 0 0 3px rgba(13,148,136,0.1)' }}
            onBlur={e => { e.target.style.borderColor = '#E4EAF0'; e.target.style.boxShadow = 'none' }}
          />
        </div>

        <div className="grid grid-cols-5 gap-2">
          <div className="col-span-2">
            <InputField id="city" label="City" value={city} onChange={setCity}
              placeholder="Baton Rouge" autoComplete="address-level2" />
          </div>
          <div className="col-span-1">
            <InputField id="state" label="State" value={stateVal} onChange={setStateVal}
              placeholder="LA" autoComplete="address-level1" />
          </div>
          <div className="col-span-2">
            <InputField id="zip" label="ZIP" value={zip} onChange={setZip}
              placeholder="70801" autoComplete="postal-code" />
          </div>
        </div>

        <InputField id="password" label="Password" type="password" value={password} onChange={setPassword}
          placeholder="Min. 8 characters" autoComplete="new-password" />

        <InputField id="confirmPassword" label="Confirm password" type="password"
          value={confirmPassword} onChange={setConfirmPassword}
          placeholder="••••••••" autoComplete="new-password" />

        {error && (
          <div className="px-4 py-3 rounded-lg text-[13px]"
            style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}>
            {error}
          </div>
        )}

        <button
          type="submit" disabled={loading}
          className="w-full py-2.5 px-4 rounded-lg text-[14px] font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: loading ? '#0F766E' : '#0D9488' }}
          onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = '#0F766E' }}
          onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = '#0D9488' }}
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="text-center text-[13px] mt-6" style={{ color: '#5B6B80' }}>
        Already have an account?{' '}
        <Link href="/login" className="font-medium" style={{ color: '#0D9488' }}>Sign in</Link>
      </p>
    </div>
  )
}
