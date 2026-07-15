import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import NurseShiftList, { type AgencyOption } from '@/components/shifts/NurseShiftList'
import type { ShiftCardData } from '@/components/shifts/ShiftCard'
import type { PayTierConfig } from '@/lib/utils/pay'

export default async function NurseAvailableShiftsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Get nurse profile — admin client bypasses RLS on nurse_profiles
  const { data: nurseProfile } = await admin
    .from('nurse_profiles')
    .select('id, credential_type, home_address, home_address_lat, home_address_lng')
    .eq('profile_id', user.id)
    .single()

  if (!nurseProfile) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <p className="text-gray-500 text-sm">Nurse profile not found. Contact your agency.</p>
      </div>
    )
  }

  // Get agency relationships with agency names — admin client bypasses RLS
  const { data: agencyRels } = await admin
    .from('agency_nurse_relationships')
    .select('agency_id, base_pay_rate, agencies(id, name)')
    .eq('nurse_profile_id', nurseProfile.id)
    .eq('status', 'active')

  const agencyIds = (agencyRels ?? []).map(r => r.agency_id)

  // Get all facility IDs connected to those agencies so we can show their open shifts
  const { data: connectedFacilities } = agencyIds.length > 0
    ? await admin
        .from('agency_facility_connections')
        .select('facility_id')
        .in('agency_id', agencyIds)
        .eq('status', 'active')
    : { data: [] }
  const facilityIds = (connectedFacilities ?? []).map(c => c.facility_id).filter(Boolean) as string[]

  // Get pay tier configs for those agencies
  // Note: requires RLS policy allowing nurses to read pay_tier_configs for their agencies.
  // Run this SQL if tier pay info is missing:
  //   CREATE POLICY "nurse_reads_own_agency_tiers" ON pay_tier_configs
  //   FOR SELECT USING (agency_id IN (
  //     SELECT agency_id FROM agency_nurse_relationships
  //     WHERE nurse_profile_id = get_my_nurse_profile_id() AND status = 'active'
  //   ));
  const { data: tierRows } = await admin
    .from('pay_tier_configs')
    .select('agency_id, tier_number, custom_label, bonus_amount, bonus_type')
    .in('agency_id', agencyIds.length > 0 ? agencyIds : ['00000000-0000-0000-0000-000000000000'])

  // Group tier configs by agency
  const tiersByAgency: Record<string, PayTierConfig[]> = {}
  for (const row of tierRows ?? []) {
    if (!tiersByAgency[row.agency_id]) tiersByAgency[row.agency_id] = []
    tiersByAgency[row.agency_id].push(row as PayTierConfig)
  }

  // Build agency options
  const agencies: AgencyOption[] = (agencyRels ?? [])
    .filter(r => r.agencies)
    .map(r => ({
      agency_id: r.agency_id,
      agency_name: (r.agencies as { name: string } | null)?.name ?? r.agency_id,
      base_pay_rate: r.base_pay_rate,
      tier_configs: tiersByAgency[r.agency_id] ?? [],
    }))

  const today = new Date().toISOString().split('T')[0]

  // Get DNR records for this nurse — exclude those facilities from shift queries
  const { data: dnrRecords } = await admin
    .from('dnr_records')
    .select('facility_id')
    .eq('nurse_profile_id', nurseProfile.id)

  const dnrFacilityIds = new Set((dnrRecords ?? []).map(d => d.facility_id).filter(Boolean) as string[])
  const allowedFacilityIds = facilityIds.filter(id => !dnrFacilityIds.has(id))

  // RNs can also work LPN and LPN_IV shifts; LPN_IV can work LPN shifts; CMAs can also work CNA shifts
  const visibleCredentials =
    nurseProfile.credential_type === 'RN' ? ['RN', 'LPN', 'LPN_IV'] :
    nurseProfile.credential_type === 'LPN_IV' ? ['LPN_IV', 'LPN'] :
    nurseProfile.credential_type === 'CMA' ? ['CMA', 'CNA'] :
    [nurseProfile.credential_type]

  // Real facility shifts — skip entirely if all facilities are DNR'd
  const { data: realShiftRows } = allowedFacilityIds.length > 0
    ? await admin
        .from('shifts')
        .select('id, facility_id, credential_required, shift_date, start_time, end_time, priority_tier, status, notes, facilities(name, address_line1, city, state, facility_notes)')
        .eq('status', 'open')
        .in('credential_required', visibleCredentials)
        .eq('is_placeholder', false)
        .in('facility_id', allowedFacilityIds)
        .gte('shift_date', today)
        .order('shift_date', { ascending: true })
        .order('start_time', { ascending: true })
    : { data: [] }

  // Placeholder shifts for the nurse's agencies
  const { data: placeholderShiftRows } = agencyIds.length > 0 ? await admin
    .from('shifts')
    .select('id, placeholder_facility_id, credential_required, shift_date, start_time, end_time, priority_tier, status, notes, placeholder_facilities(name, address_line1, city, state, facility_notes)')
    .eq('status', 'open')
    .in('credential_required', visibleCredentials)
    .eq('is_placeholder', true)
    .in('agency_id', agencyIds)
    .gte('shift_date', today)
    .order('shift_date', { ascending: true })
    .order('start_time', { ascending: true })
  : { data: [] }

  const shifts: ShiftCardData[] = [
    ...(realShiftRows ?? []).map(s => {
      const fac = s.facilities as { name: string; address_line1: string; city: string; state: string; facility_notes: string | null } | null
      return {
        id: s.id,
        facility_id: s.facility_id,
        placeholder_facility_id: null,
        facility_name: fac?.name ?? null,
        facility_address: fac?.address_line1 ?? null,
        facility_city: fac?.city ?? null,
        facility_state: fac?.state ?? null,
        facility_notes: fac?.facility_notes ?? null,
        credential_required: s.credential_required,
        shift_date: s.shift_date,
        start_time: s.start_time,
        end_time: s.end_time,
        priority_tier: s.priority_tier,
        status: s.status,
        notes: s.notes ?? null,
      }
    }),
    ...(placeholderShiftRows ?? []).map(s => {
      const fac = s.placeholder_facilities as { name: string; address_line1: string; city: string; state: string; facility_notes: string | null } | null
      return {
        id: s.id,
        facility_id: null,
        placeholder_facility_id: s.placeholder_facility_id ?? null,
        facility_name: fac?.name ?? null,
        facility_address: fac?.address_line1 ?? null,
        facility_city: fac?.city ?? null,
        facility_state: fac?.state ?? null,
        facility_notes: fac?.facility_notes ?? null,
        credential_required: s.credential_required,
        shift_date: s.shift_date,
        start_time: s.start_time,
        end_time: s.end_time,
        priority_tier: s.priority_tier,
        status: s.status,
        notes: s.notes ?? null,
      }
    }),
  ].sort((a, b) => a.shift_date.localeCompare(b.shift_date) || a.start_time.localeCompare(b.start_time))

  // Get nurse's existing active claims to mark them, and rejected claims to hide those shifts
  const { data: existingClaims } = await admin
    .from('shift_claims')
    .select('shift_id, status')
    .eq('nurse_profile_id', nurseProfile.id)
    .in('status', ['pending', 'confirmed', 'rejected'])

  const alreadyClaimedIds = new Set(
    (existingClaims ?? []).filter(c => c.status !== 'rejected').map(c => c.shift_id)
  )
  const rejectedShiftIds = new Set(
    (existingClaims ?? []).filter(c => c.status === 'rejected').map(c => c.shift_id)
  )

  const visibleShifts = shifts.filter(s => !rejectedShiftIds.has(s.id))

  // Load cached drive times from DB — avoids recalculating on every login
  const { data: cachedDriveTimes } = await admin
    .from('nurse_drive_times')
    .select('facility_id, minutes')
    .eq('nurse_profile_id', nurseProfile.id)

  const initialDriveTimes: Record<string, number | null> = {}
  for (const row of cachedDriveTimes ?? []) {
    initialDriveTimes[row.facility_id] = row.minutes
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-[28px]" style={{ color: '#0D1B2A' }}>Available Shifts</h1>
          <p className="text-[13px] mt-1" style={{ color: '#5B6B80' }}>
            Showing shifts matching your{' '}
            <span className="font-semibold" style={{ color: '#0D9488' }}>{nurseProfile.credential_type}</span>{' '}
            credentials
          </p>
        </div>
        <Link href="/nurse/schedule"
          className="text-[13px] font-medium transition-colors"
          style={{ color: '#0D9488' }}>
          My Schedule →
        </Link>
      </div>

      {agencies.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500 text-sm">No active agency relationships found.</p>
          <p className="text-gray-400 text-xs mt-1">Contact your agency to be added to their roster.</p>
        </div>
      ) : (
        <NurseShiftList
          shifts={visibleShifts}
          agencies={agencies}
          nurseProfileId={nurseProfile.id}
          alreadyClaimedIds={alreadyClaimedIds}
          initialDriveTimes={initialDriveTimes}
          nurseOrigin={
            nurseProfile.home_address_lat && nurseProfile.home_address_lng
              ? `${nurseProfile.home_address_lat},${nurseProfile.home_address_lng}`
              : nurseProfile.home_address ?? undefined
          }
        />
      )}
    </div>
  )
}
