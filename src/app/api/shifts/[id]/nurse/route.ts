import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: shiftId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const role = user?.app_metadata?.role
  if (!user || !['facility_admin', 'agency_admin'].includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Get the confirmed or pending claim for this shift (pending covers claimed placeholder shifts)
  const { data: claims } = await admin
    .from('shift_claims')
    .select('nurse_profile_id, status')
    .eq('shift_id', shiftId)
    .in('status', ['confirmed', 'pending'])
    .order('claimed_at')

  const claim = claims?.find(c => c.status === 'confirmed') ?? claims?.[0] ?? null

  if (!claim) {
    return NextResponse.json({ error: 'No active claim found' }, { status: 404 })
  }

  // Fetch nurse profile + linked auth profile (name, email, phone)
  const { data: nurseProfile } = await admin
    .from('nurse_profiles')
    .select(`
      id,
      credential_type,
      license_number,
      license_state,
      license_status,
      license_expiration,
      iv_certified,
      cpr_expiration,
      tb_test_date,
      covid_vaccinated,
      phone,
      profile_id
    `)
    .eq('id', claim.nurse_profile_id)
    .single()

  if (!nurseProfile) {
    return NextResponse.json({ error: 'Nurse profile not found' }, { status: 404 })
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, email, phone')
    .eq('id', nurseProfile.profile_id)
    .single()

  return NextResponse.json({
    nurse: {
      full_name:          profile?.full_name ?? 'Unknown',
      email:              profile?.email ?? null,
      phone:              nurseProfile.phone ?? profile?.phone ?? null,
      credential_type:    nurseProfile.credential_type,
      license_number:     nurseProfile.license_number,
      license_state:      nurseProfile.license_state,
      license_status:     nurseProfile.license_status,
      license_expiration: nurseProfile.license_expiration,
      iv_certified:       nurseProfile.iv_certified,
      cpr_expiration:     nurseProfile.cpr_expiration,
      tb_test_date:       nurseProfile.tb_test_date,
      covid_vaccinated:   nurseProfile.covid_vaccinated,
    },
  })
}
