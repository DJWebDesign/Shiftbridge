import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/resend/client'
import { isDemoUser } from '@/lib/demo/context'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'facility_admin' && !isDemoUser(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: facilityAdmin } = await supabase
    .from('facility_admins')
    .select('facility_id')
    .eq('profile_id', user.id)
    .single()

  if (!facilityAdmin) {
    return NextResponse.json({ error: 'Facility not found' }, { status: 403 })
  }

  const facilityId = facilityAdmin.facility_id
  const body = await request.json()

  const {
    email, fullName, phone, licenseNumber, licenseState, credentialType,
    licenseStatus, licenseExpiration, ivCertified, ivCertSource,
    cprExpiration, tbTestDate, covidVaccinated, homeAddress,
    homeAddressLat, homeAddressLng, basePayRate, notes, nursysCheckedAt,
  } = body

  if (!email || !fullName || !licenseNumber || !licenseState || !credentialType) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Find or create the house agency for this facility
  const { data: facility } = await admin
    .from('facilities')
    .select('name')
    .eq('id', facilityId)
    .single()

  if (!facility) {
    return NextResponse.json({ error: 'Facility not found' }, { status: 404 })
  }

  let houseAgencyId: string

  const { data: existingHouseAgency } = await admin
    .from('agencies')
    .select('id')
    .eq('house_for_facility_id', facilityId)
    .single()

  if (existingHouseAgency) {
    houseAgencyId = existingHouseAgency.id
  } else {
    // Create house agency
    const { data: newAgency, error: agencyError } = await admin
      .from('agencies')
      .insert({
        name:                 `${facility.name} Staff`,
        status:               'active',
        house_for_facility_id: facilityId,
      })
      .select('id')
      .single()

    if (agencyError || !newAgency) {
      console.error('[facility-staff/create] house agency error:', agencyError)
      return NextResponse.json({ error: 'Failed to create facility staff group' }, { status: 500 })
    }

    houseAgencyId = newAgency.id

    // Connect the house agency to the facility
    await admin
      .from('agency_facility_connections')
      .insert({
        agency_id:   houseAgencyId,
        facility_id: facilityId,
        status:      'active',
      })
  }

  // Check if nurse already exists by license
  const { data: existingNurseProfile } = await admin
    .from('nurse_profiles')
    .select('id, profile_id')
    .eq('license_number', licenseNumber.trim().toUpperCase())
    .eq('license_state', licenseState.trim().toUpperCase())
    .single()

  if (existingNurseProfile) {
    const { error: relError } = await admin
      .from('agency_nurse_relationships')
      .insert({
        agency_id:        houseAgencyId,
        nurse_profile_id: existingNurseProfile.id,
        base_pay_rate:    basePayRate ? Number(basePayRate) : null,
        notes:            notes ?? null,
        status:           'active',
      })

    if (relError) {
      if (relError.code === '23505') {
        return NextResponse.json({ error: 'This nurse is already on your roster' }, { status: 409 })
      }
      console.error('[facility-staff/create] relationship error:', relError)
      return NextResponse.json({ error: 'Failed to add nurse to roster' }, { status: 500 })
    }

    return NextResponse.json({ nurseProfileId: existingNurseProfile.id, existing: true })
  }

  // New nurse — create auth user, profile, nurse_profile, and relationship
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email:         email.trim().toLowerCase(),
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata:  { role: 'nurse' },
  })

  if (authData?.user) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type:    'recovery',
      email:   email.trim().toLowerCase(),
      options: { redirectTo: `${siteUrl}/reset-password` },
    })
    if (linkError) console.warn('[facility-staff/create] generateLink error:', linkError)
    const inviteLink = (linkData as any)?.properties?.action_link
    if (inviteLink) {
      const emailOk = await sendEmail({
        to:      email.trim().toLowerCase(),
        subject: "You've been added to ShiftBridge — set your password",
        html: `
          <p>Hi ${fullName},</p>
          <p>Your ShiftBridge account has been created. Click the link below to set your password and log in:</p>
          <p><a href="${inviteLink}" style="color:#0e7490;font-weight:bold;">Set my password</a></p>
          <p>This link expires in 24 hours.</p>
          <p>— ShiftBridge</p>
        `,
      })
      if (!emailOk) console.warn('[facility-staff/create] invite email failed to send')
    }
  }

  if (authError) {
    if (authError.message?.includes('already been registered')) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
    }
    console.error('[facility-staff/create] auth error:', authError)
    return NextResponse.json({ error: 'Failed to create user account' }, { status: 500 })
  }

  const newUserId = authData!.user.id

  const { error: profileError } = await admin
    .from('profiles')
    .insert({
      id:        newUserId,
      role:      'nurse',
      full_name: fullName,
      email:     email.trim().toLowerCase(),
      phone:     phone ?? null,
    })

  if (profileError) {
    console.error('[facility-staff/create] profile error:', profileError)
    await admin.auth.admin.deleteUser(newUserId)
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
  }

  const { data: nurseProfile, error: npError } = await admin
    .from('nurse_profiles')
    .insert({
      profile_id:          newUserId,
      license_number:      licenseNumber.trim().toUpperCase(),
      license_state:       licenseState.trim().toUpperCase(),
      credential_type:     credentialType,
      license_status:      licenseStatus ?? 'active',
      license_expiration:  licenseExpiration ?? null,
      iv_certified:        ivCertified ?? (credentialType === 'RN'),
      iv_cert_source:      ivCertSource ?? (credentialType === 'RN' ? 'implicit_rn' : null),
      cpr_expiration:      cprExpiration ?? null,
      tb_test_date:        tbTestDate ?? null,
      covid_vaccinated:    covidVaccinated ?? false,
      phone:               phone ?? null,
      home_address:        homeAddress ?? null,
      home_address_lat:    homeAddressLat ?? null,
      home_address_lng:    homeAddressLng ?? null,
      nursys_last_checked: nursysCheckedAt ?? null,
    })
    .select('id')
    .single()

  if (npError || !nurseProfile) {
    console.error('[facility-staff/create] nurse_profile error:', npError)
    await admin.auth.admin.deleteUser(newUserId)
    return NextResponse.json({ error: 'Failed to create nurse profile' }, { status: 500 })
  }

  const { error: relError } = await admin
    .from('agency_nurse_relationships')
    .insert({
      agency_id:        houseAgencyId,
      nurse_profile_id: nurseProfile.id,
      base_pay_rate:    basePayRate ? Number(basePayRate) : null,
      notes:            notes ?? null,
      status:           'active',
    })

  if (relError) {
    console.error('[facility-staff/create] relationship error:', relError)
    return NextResponse.json({ error: 'Failed to link nurse to facility' }, { status: 500 })
  }

  return NextResponse.json({ nurseProfileId: nurseProfile.id, existing: false })
}
