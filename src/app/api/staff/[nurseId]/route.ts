import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDemoUser } from '@/lib/demo/context'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ nurseId: string }> }
) {
  const { nurseId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const role = user?.app_metadata?.role
  if (!user || (role !== 'agency_admin' && role !== 'facility_admin' && !isDemoUser(user))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { section, agencyId } = body

  if (!agencyId) return NextResponse.json({ error: 'Missing agencyId' }, { status: 400 })

  const admin = createAdminClient()

  // Verify caller owns the agency (agency_admin) or the house agency belongs to their facility (facility_admin)
  if (role === 'agency_admin') {
    const { data: agencyAdmin } = await supabase
      .from('agency_admins').select('agency_id').eq('profile_id', user.id).single()
    if (!agencyAdmin || agencyAdmin.agency_id !== agencyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else {
    const { data: facilityAdmin } = await supabase
      .from('facility_admins').select('facility_id').eq('profile_id', user.id).single()
    if (!facilityAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { data: houseAgency } = await admin
      .from('agencies').select('id').eq('id', agencyId).eq('house_for_facility_id', facilityAdmin.facility_id).single()
    if (!houseAgency) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: rel } = await admin
    .from('agency_nurse_relationships')
    .select('id')
    .eq('agency_id', agencyId)
    .eq('nurse_profile_id', nurseId)
    .single()
  if (!rel) return NextResponse.json({ error: 'Nurse not on this roster' }, { status: 404 })

  if (section === 'license') {
    const { licenseNumber, licenseState, licenseStatus, licenseExpiration, credentialType, ivCertified } = body
    const { error } = await admin.from('nurse_profiles').update({
      license_number:     licenseNumber?.trim().toUpperCase(),
      license_state:      licenseState?.trim().toUpperCase(),
      license_status:     licenseStatus,
      license_expiration: licenseExpiration || null,
      credential_type:    credentialType,
      iv_certified:       ivCertified,
      iv_cert_source:     ivCertified ? (credentialType === 'RN' ? 'implicit_rn' : 'manual') : null,
    }).eq('id', nurseId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  else if (section === 'contact') {
    const { phone, homeAddress, homeAddressLat, homeAddressLng } = body
    // Only update lat/lng when a new address was selected from autocomplete (non-null).
    // If null, preserve whatever is already stored so saving phone alone doesn't wipe coordinates.
    const coordUpdate = homeAddressLat != null && homeAddressLng != null
      ? { home_address_lat: homeAddressLat, home_address_lng: homeAddressLng }
      : {}
    const { error } = await admin.from('nurse_profiles').update({
      phone:        phone || null,
      home_address: homeAddress || null,
      ...coordUpdate,
    }).eq('id', nurseId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Only clear cached drive times when a new address was picked (new coordinates)
    if (coordUpdate.home_address_lat != null) {
      await admin.from('nurse_drive_times').delete().eq('nurse_profile_id', nurseId)
    }

    // Also update profiles table phone
    const { data: np } = await admin.from('nurse_profiles').select('profile_id').eq('id', nurseId).single()
    if (np) {
      await admin.from('profiles').update({ phone: phone || null }).eq('id', np.profile_id)
    }
  }

  else if (section === 'health') {
    const { cprExpiration, tbTestDate, covidVaccinated } = body
    const { error } = await admin.from('nurse_profiles').update({
      cpr_expiration:  cprExpiration || null,
      tb_test_date:    tbTestDate || null,
      covid_vaccinated: covidVaccinated,
    }).eq('id', nurseId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  else if (section === 'agency') {
    const { basePayRate, notes, rosterStatus } = body
    const { error } = await admin.from('agency_nurse_relationships').update({
      base_pay_rate: basePayRate ? Number(basePayRate) : null,
      notes:         notes || null,
      status:        rosterStatus,
    }).eq('agency_id', agencyId).eq('nurse_profile_id', nurseId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  else {
    return NextResponse.json({ error: 'Unknown section' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ nurseId: string }> }
) {
  const { nurseId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const deleteRole = user?.app_metadata?.role
  if (!user || (deleteRole !== 'agency_admin' && deleteRole !== 'facility_admin' && !isDemoUser(user))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { agencyId } = body

  if (!agencyId) return NextResponse.json({ error: 'Missing agencyId' }, { status: 400 })

  const admin = createAdminClient()

  if (deleteRole === 'agency_admin') {
    const { data: agencyAdmin } = await supabase
      .from('agency_admins').select('agency_id').eq('profile_id', user.id).single()
    if (!agencyAdmin || agencyAdmin.agency_id !== agencyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else {
    const { data: facilityAdmin } = await supabase
      .from('facility_admins').select('facility_id').eq('profile_id', user.id).single()
    if (!facilityAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { data: houseAgency } = await admin
      .from('agencies').select('id').eq('id', agencyId).eq('house_for_facility_id', facilityAdmin.facility_id).single()
    if (!houseAgency) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: rel } = await admin
    .from('agency_nurse_relationships')
    .select('id')
    .eq('agency_id', agencyId)
    .eq('nurse_profile_id', nurseId)
    .single()
  if (!rel) return NextResponse.json({ error: 'Nurse not on this roster' }, { status: 404 })

  // Set relationship to inactive — preserves history and shift records
  const { error } = await admin
    .from('agency_nurse_relationships')
    .update({ status: 'inactive' })
    .eq('agency_id', agencyId)
    .eq('nurse_profile_id', nurseId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
