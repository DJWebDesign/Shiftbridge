import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDemoUser } from '@/lib/demo/context'

// Credential types that are NOT in NURSYS (CNA, CMA)
const MANUAL_ONLY_CREDENTIALS = ['CNA', 'CMA']

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'agency_admin' && !isDemoUser(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { licenseNumber, state } = body

  if (!licenseNumber || !state) {
    return NextResponse.json({ error: 'licenseNumber and state are required' }, { status: 400 })
  }

  const apiKey  = process.env.NURSYS_API_KEY
  const baseUrl = process.env.NURSYS_API_BASE_URL

  if (!apiKey || !baseUrl) {
    return NextResponse.json(
      { error: 'NURSYS not configured', manual: true },
      { status: 503 }
    )
  }

  try {
    const url = new URL('/license/verify', baseUrl)
    url.searchParams.set('licenseNumber', licenseNumber.trim().toUpperCase())
    url.searchParams.set('state', state.trim().toUpperCase())

    const res = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    })

    if (res.status === 404) {
      return NextResponse.json({ error: 'License not found in NURSYS', notFound: true }, { status: 404 })
    }

    if (!res.ok) {
      throw new Error(`NURSYS returned ${res.status}`)
    }

    const data = await res.json()

    // Map NURSYS response to our internal shape
    const credentialType = mapCredentialType(data.licenseType, data.endorsements)

    if (MANUAL_ONLY_CREDENTIALS.includes(credentialType)) {
      return NextResponse.json({ error: 'CNA/CMA not in NURSYS — use manual entry', manual: true }, { status: 422 })
    }

    const licenseStatus = mapLicenseStatus(data.status)

    if (licenseStatus === 'revoked') {
      return NextResponse.json({ error: 'License is revoked', revoked: true }, { status: 422 })
    }

    return NextResponse.json({
      fullName:          data.firstName + ' ' + data.lastName,
      credentialType,
      licenseStatus,
      licenseExpiration: data.expirationDate ?? null,
      ivCertified:       credentialType === 'RN' || credentialType === 'LPN_IV',
      ivCertSource:      credentialType === 'RN' ? 'implicit_rn' : credentialType === 'LPN_IV' ? 'manual' : null,
      nursysCheckedAt:   new Date().toISOString(),
    })
  } catch (err) {
    console.error('[nursys/lookup] error:', err)
    return NextResponse.json(
      { error: 'NURSYS lookup failed — you can enter the license details manually', manual: true },
      { status: 502 }
    )
  }
}

function mapCredentialType(licenseType: string, endorsements: string[] = []): string {
  const type = (licenseType ?? '').toUpperCase()
  if (type.includes('REGISTERED') || type === 'RN')  return 'RN'
  if (type.includes('PRACTICAL')  || type === 'LPN') {
    const hasIV = endorsements.some(e => e.toUpperCase().includes('IV'))
    return hasIV ? 'LPN_IV' : 'LPN'
  }
  // CNA/CMA should not appear in NURSYS but handle gracefully
  return 'LPN'
}

function mapLicenseStatus(status: string): string {
  const s = (status ?? '').toUpperCase()
  if (s === 'ACTIVE' || s === 'CURRENT') return 'active'
  if (s === 'EXPIRED') return 'expired'
  if (s === 'SUSPENDED') return 'suspended'
  if (s === 'REVOKED') return 'revoked'
  return 'active'
}
