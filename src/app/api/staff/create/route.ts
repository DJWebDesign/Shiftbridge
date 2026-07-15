import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/resend/client'
import { isDemoUser } from '@/lib/demo/context'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'agency_admin' && !isDemoUser(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify the agency_id matches this admin's agency
  const { data: agencyAdmin } = await supabase
    .from('agency_admins')
    .select('agency_id')
    .eq('profile_id', user.id)
    .single()

  if (!agencyAdmin) {
    return NextResponse.json({ error: 'Agency not found' }, { status: 403 })
  }

  const agencyId = agencyAdmin.agency_id
  const body = await request.json()

  const {
    email,
    fullName,
    phone,
    licenseNumber,
    licenseState,
    credentialType,
    licenseStatus,
    licenseExpiration,
    ivCertified,
    ivCertSource,
    cprExpiration,
    tbTestDate,
    covidVaccinated,
    homeAddress,
    homeAddressLat,
    homeAddressLng,
    basePayRate,
    notes,
    nursysCheckedAt,
  } = body

  if (!email || !fullName || !licenseNumber || !licenseState || !credentialType) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Check if nurse_profiles already exists for this license (nurse at another agency)
  const { data: existingNurseProfile } = await admin
    .from('nurse_profiles')
    .select('id, profile_id')
    .eq('license_number', licenseNumber.trim().toUpperCase())
    .eq('license_state', licenseState.trim().toUpperCase())
    .single()

  if (existingNurseProfile) {
    // Nurse is already in the system — just create the relationship
    const { error: relError } = await admin
      .from('agency_nurse_relationships')
      .insert({
        agency_id:        agencyId,
        nurse_profile_id: existingNurseProfile.id,
        base_pay_rate:    basePayRate ? Number(basePayRate) : null,
        notes:            notes ?? null,
        status:           'active',
      })

    if (relError) {
      if (relError.code === '23505') {
        return NextResponse.json({ error: 'This nurse is already on your roster' }, { status: 409 })
      }
      console.error('[staff/create] relationship error:', relError)
      return NextResponse.json({ error: 'Failed to add nurse to roster' }, { status: 500 })
    }

    return NextResponse.json({ nurseProfileId: existingNurseProfile.id, existing: true })
  }

  // New nurse — create auth user, profile, nurse_profile, and relationship
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email:          email.trim().toLowerCase(),
    email_confirm:  true,
    user_metadata:  { full_name: fullName },
    app_metadata:   { role: 'nurse' },
  })

  // Generate a password-set link and email it to the nurse
  if (authData?.user) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type:    'recovery',
      email:   email.trim().toLowerCase(),
      options: { redirectTo: `${siteUrl}/reset-password` },
    })
    if (linkError) {
      console.warn('[staff/create] generateLink error:', linkError)
    }
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
      if (!emailOk) console.warn('[staff/create] invite email failed to send')
    } else {
      console.warn('[staff/create] no action_link returned from generateLink')
    }
  }

  if (authError) {
    if (authError.message?.includes('already been registered')) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
    }
    console.error('[staff/create] auth error:', authError)
    return NextResponse.json({ error: 'Failed to create user account' }, { status: 500 })
  }

  const newUserId = authData.user.id

  // Create profiles record (no auto-trigger in schema)
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
    console.error('[staff/create] profile error:', profileError)
    await admin.auth.admin.deleteUser(newUserId)
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
  }

  // Create nurse_profiles record
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
    console.error('[staff/create] nurse_profile error:', npError)
    await admin.auth.admin.deleteUser(newUserId)
    return NextResponse.json({ error: 'Failed to create nurse profile' }, { status: 500 })
  }

  // Create agency_nurse_relationships
  const { error: relError } = await admin
    .from('agency_nurse_relationships')
    .insert({
      agency_id:        agencyId,
      nurse_profile_id: nurseProfile.id,
      base_pay_rate:    basePayRate ? Number(basePayRate) : null,
      notes:            notes ?? null,
      status:           'active',
    })

  if (relError) {
    console.error('[staff/create] relationship error:', relError)
    return NextResponse.json({ error: 'Failed to link nurse to agency' }, { status: 500 })
  }

  return NextResponse.json({ nurseProfileId: nurseProfile.id, existing: false })
}
