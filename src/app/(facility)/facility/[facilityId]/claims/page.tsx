import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ShiftClaimQueue, { type ShiftQueueData, type ClaimInQueue } from '@/components/shifts/ShiftClaimQueue'
import type { NurseCredentials } from '@/components/shifts/CredentialCard'

export default async function FacilityClaimsPage({ params }: { params: Promise<{ facilityId: string }> }) {
  const { facilityId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Auth validated above — use admin client so shift_claims / nurse_profiles
  // don't fail silently due to RLS chain complexity (same pattern as /nurse page).
  const admin = createAdminClient()

  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Fetch existing DNR records for this facility so undo button shows on reload
  const { data: dnrRecords } = await admin
    .from('dnr_records')
    .select('nurse_profile_id')
    .eq('facility_id', facilityId)

  const dnrNurseIds = new Set((dnrRecords ?? []).map(d => d.nurse_profile_id))

  // Shifts with active claim activity (claimed = needs review; confirmed = recent history)
  const { data: shifts } = await admin
    .from('shifts')
    .select('id, shift_date, start_time, end_time, credential_required, priority_tier, status')
    .eq('facility_id', facilityId)
    .in('status', ['claimed', 'confirmed'])
    .gte('shift_date', thirtyDaysAgo)
    .order('shift_date', { ascending: true })
    .order('start_time', { ascending: true })

  const shiftIds = (shifts ?? []).map(s => s.id)

  // Get all relevant claims (pending for review + confirmed for history)
  const { data: claims } = shiftIds.length > 0
    ? await admin
        .from('shift_claims')
        .select('id, shift_id, status, claimed_at, nurse_profile_id, agency_id, agencies(name)')
        .in('shift_id', shiftIds)
        .in('status', ['pending', 'confirmed'])
        .order('claimed_at', { ascending: true })
    : { data: [] }

  // Collect unique nurse profile IDs
  const nurseProfileIds = [...new Set((claims ?? []).map(c => c.nurse_profile_id))]

  // Fetch nurse profiles — deliberately exclude address fields
  const { data: nurseProfiles } = nurseProfileIds.length > 0
    ? await admin
        .from('nurse_profiles')
        .select('id, profile_id, credential_type, license_number, license_state, license_status, license_expiration, iv_certified, cpr_expiration, tb_test_date, covid_vaccinated, profile_photo_url')
        .in('id', nurseProfileIds)
    : { data: [] }

  // Fetch profile names separately
  const profileIds = [...new Set((nurseProfiles ?? []).map(np => np.profile_id))]
  const { data: profiles } = profileIds.length > 0
    ? await admin
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', profileIds)
    : { data: [] }

  // Build lookup maps
  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  const nurseMap = Object.fromEntries((nurseProfiles ?? []).map(np => [np.id, np]))

  // Assemble ShiftQueueData
  const shiftQueues: ShiftQueueData[] = (shifts ?? []).map(shift => {
    const shiftClaims: ClaimInQueue[] = (claims ?? [])
      .filter(c => c.shift_id === shift.id)
      .map(c => {
        const np = nurseMap[c.nurse_profile_id]
        const prof = np ? profileMap[np.profile_id] : null
        const agencyName = (c.agencies as { name: string } | null)?.name ?? 'Unknown Agency'

        const nurse: NurseCredentials = {
          nurse_profile_id: c.nurse_profile_id,
          full_name: prof?.full_name ?? 'Unknown',
          avatar_url: prof?.avatar_url ?? null,
          credential_type: np?.credential_type ?? '',
          license_number: np?.license_number ?? '',
          license_state: np?.license_state ?? '',
          license_status: np?.license_status ?? '',
          license_expiration: np?.license_expiration ?? null,
          iv_certified: np?.iv_certified ?? false,
          cpr_expiration: np?.cpr_expiration ?? null,
          tb_test_date: np?.tb_test_date ?? null,
          covid_vaccinated: np?.covid_vaccinated ?? false,
          agency_name: agencyName,
        }

        return { id: c.id, status: c.status, claimed_at: c.claimed_at, agency_id: c.agency_id, nurse }
      })

    return {
      id: shift.id,
      shift_date: shift.shift_date,
      start_time: shift.start_time,
      end_time: shift.end_time,
      credential_required: shift.credential_required,
      priority_tier: shift.priority_tier,
      status: shift.status,
      claims: shiftClaims,
    }
  })

  const pendingReview = shiftQueues.filter(s => s.status === 'claimed')
  const confirmed = shiftQueues.filter(s => s.status === 'confirmed')

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Claims</h1>
        <p className="text-sm text-gray-500 mt-0.5">Review nurse claims and confirm shift assignments</p>
      </div>

      {/* Pending review */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Pending Review ({pendingReview.length})
        </h2>
        {pendingReview.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-500 text-sm">No shifts awaiting review.</p>
            <p className="text-gray-400 text-xs mt-1">Claims appear here when nurses apply for your posted shifts.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingReview.map(shift => (
              <ShiftClaimQueue
                key={shift.id}
                shift={shift}
                isPast={shift.shift_date < today}
                dnrNurseIds={dnrNurseIds}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recently confirmed */}
      {confirmed.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Recently Confirmed ({confirmed.length})
          </h2>
          <div className="space-y-3 opacity-80">
            {confirmed.map(shift => (
              <ShiftClaimQueue
                key={shift.id}
                shift={shift}
                isPast={shift.shift_date < today}
                dnrNurseIds={dnrNurseIds}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
