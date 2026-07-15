import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeAddress } from '@/lib/utils/address'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { entityType, fullName, email, password, phone, agencyName, facilityName, facilityType,
    addressLine1, city, state, zip, lat, lng } = body

  if (!entityType || !fullName || !email || !password || !phone || !addressLine1 || !city || !state || !zip) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (entityType === 'agency' && !agencyName) {
    return NextResponse.json({ error: 'Agency name is required' }, { status: 400 })
  }

  if (entityType === 'facility' && (!facilityName || !facilityType)) {
    return NextResponse.json({ error: 'Facility name and type are required' }, { status: 400 })
  }

  const role = entityType === 'agency' ? 'agency_admin' : 'facility_admin'
  const admin = createAdminClient()

  // Create auth user with role in app_metadata
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email:         email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata:  { role },
  })

  if (authError) {
    if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }
    console.error('[signup] auth error:', authError)
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }

  const userId = authData.user.id

  // Create profiles record
  const { error: profileError } = await admin.from('profiles').insert({
    id:        userId,
    role,
    full_name: fullName.trim(),
    email:     email.trim().toLowerCase(),
    phone:     phone.trim(),
  })

  if (profileError) {
    console.error('[signup] profile error:', profileError)
    await admin.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
  }

  if (entityType === 'agency') {
    // Create agency record
    const { data: agency, error: agencyError } = await admin.from('agencies').insert({
      name:    agencyName.trim(),
      address: addressLine1.trim(),
      city:    city.trim(),
      state:   state.trim().toUpperCase(),
      zip:     zip.trim(),
      phone:   phone.trim(),
      status:  'active',
    }).select('id').single()

    if (agencyError || !agency) {
      console.error('[signup] agency error:', agencyError)
      await admin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: 'Failed to create agency' }, { status: 500 })
    }

    // Link admin to agency
    const { error: adminLinkError } = await admin.from('agency_admins').insert({
      profile_id: userId,
      agency_id:  agency.id,
    })

    if (adminLinkError) {
      console.error('[signup] agency_admins error:', adminLinkError)
      await admin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: 'Failed to link admin to agency' }, { status: 500 })
    }

    return NextResponse.json({ success: true, entityType: 'agency' })
  }

  // Facility signup
  const addressNormalized = normalizeAddress({ address_line1: addressLine1, city, state, zip })

  const { data: facility, error: facilityError } = await admin.from('facilities').insert({
    name:               facilityName.trim(),
    facility_type:      facilityType,
    address_line1:      addressLine1.trim(),
    city:               city.trim(),
    state:              state.trim().toUpperCase(),
    zip:                zip.trim(),
    address_normalized: addressNormalized,
    lat:                lat ?? null,
    lng:                lng ?? null,
    status:             'active',
  }).select('id').single()

  if (facilityError || !facility) {
    console.error('[signup] facility error:', facilityError)
    await admin.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: 'Failed to create facility' }, { status: 500 })
  }

  // Link admin to facility
  const { error: adminLinkError } = await admin.from('facility_admins').insert({
    profile_id:  userId,
    facility_id: facility.id,
  })

  if (adminLinkError) {
    console.error('[signup] facility_admins error:', adminLinkError)
    await admin.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: 'Failed to link admin to facility' }, { status: 500 })
  }

  return NextResponse.json({ success: true, entityType: 'facility' })
}
