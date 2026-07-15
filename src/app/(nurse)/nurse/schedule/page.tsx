import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import NurseScheduleClient, { type ScheduleClaim } from './NurseScheduleClient'

export default async function NurseSchedulePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: nurseProfile } = await admin
    .from('nurse_profiles')
    .select('id, home_address, home_address_lat, home_address_lng')
    .eq('profile_id', user.id)
    .single()

  if (!nurseProfile) redirect('/nurse')

  const nurseOrigin = nurseProfile.home_address_lat && nurseProfile.home_address_lng
    ? `${nurseProfile.home_address_lat},${nurseProfile.home_address_lng}`
    : nurseProfile.home_address ?? undefined

  const today = new Date().toISOString().split('T')[0]

  // Load cached drive times from DB
  const { data: cachedDriveTimes } = await admin
    .from('nurse_drive_times')
    .select('facility_id, minutes')
    .eq('nurse_profile_id', nurseProfile.id)

  const initialDriveTimes: Record<string, number | null> = {}
  for (const row of cachedDriveTimes ?? []) {
    initialDriveTimes[row.facility_id] = row.minutes
  }

  const { data: rawClaims } = await admin
    .from('shift_claims')
    .select(`
      id, status, claimed_at, confirmed_at, agency_id,
      agencies(name),
      shifts!inner(
        id, shift_date, start_time, end_time, credential_required, priority_tier, status,
        facility_id, placeholder_facility_id,
        facilities(name, address_line1, city, state),
        placeholder_facilities(name, address_line1, city, state)
      )
    `)
    .eq('nurse_profile_id', nurseProfile.id)
    .neq('status', 'withdrawn')
    .order('shifts(shift_date)', { ascending: true })
    .order('shifts(start_time)', { ascending: true })

  const claims: ScheduleClaim[] = (rawClaims ?? []).map(c => {
    const shift = c.shifts as unknown as {
      id: string
      shift_date: string
      start_time: string
      end_time: string
      credential_required: string
      priority_tier: number
      status: string
      facility_id: string | null
      placeholder_facility_id: string | null
      facilities: { name: string; address_line1: string; city: string; state: string } | null
      placeholder_facilities: { name: string; address_line1: string; city: string; state: string } | null
    }
    const facilityInfo = shift.facilities ?? shift.placeholder_facilities
    const isPlaceholder = !shift.facilities && !!shift.placeholder_facilities

    return {
      id: c.id,
      status: c.status,
      claimed_at: c.claimed_at,
      confirmed_at: c.confirmed_at,
      agency_id: c.agency_id,
      agencies: c.agencies as { name: string } | null,
      shift: {
        id: shift.id,
        shift_date: shift.shift_date,
        start_time: shift.start_time,
        end_time: shift.end_time,
        credential_required: shift.credential_required,
        priority_tier: shift.priority_tier,
        status: shift.status,
        facilityId: shift.facility_id ?? null,
        placeholderFacilityId: shift.placeholder_facility_id ?? null,
        facilityName: facilityInfo?.name ?? null,
        facilityAddress: facilityInfo?.address_line1 ?? null,
        facilityCity: facilityInfo?.city ?? null,
        facilityState: facilityInfo?.state ?? null,
        isPlaceholder,
      },
    }
  })

  return (
    <NurseScheduleClient
      claims={claims}
      today={today}
      nurseOrigin={nurseOrigin}
      initialDriveTimes={initialDriveTimes}
    />
  )
}
