import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PendingConnectionRequests from './PendingConnectionRequests'
import FacilityDashboardClient, { type AgencyOverview, type FacilityFillRateRow } from './FacilityDashboardClient'
import RepeatNurseTable, { type RepeatNurseRow } from '@/components/facility/RepeatNurseTable'
import FacilityMatchPromptSection from './FacilityMatchPromptSection'

function hoursWorked(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const startMins = sh * 60 + sm
  const endMins = eh * 60 + em
  const diff = endMins >= startMins ? endMins - startMins : (24 * 60 - startMins) + endMins
  return Math.round((diff / 60) * 100) / 100
}

export default async function FacilityDashboardPage({ params }: { params: Promise<{ facilityId: string }> }) {
  const { facilityId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const now = new Date()
  const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevFirstDay = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-01`
  const prevLastDay = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

  const [
    { data: facility },
    { data: shiftConfigs },
    { data: rawRequests },
    { data: connections },
    { data: matchedPlaceholders },
  ] = await Promise.all([
    supabase.from('facilities').select('name, facility_type, city, state').eq('id', facilityId).single(),
    supabase.from('facility_shift_configs').select('id').eq('facility_id', facilityId).limit(1),
    // Agency-initiated pending requests (facility responds)
    admin
      .from('connection_requests')
      .select('id, agency_id, placeholder_id, requested_at, message, agencies(name), placeholder_facilities(name)')
      .eq('facility_id', facilityId)
      .eq('status', 'pending')
      .eq('initiated_by_role', 'agency')
      .order('requested_at', { ascending: false }),
    admin
      .from('agency_facility_connections')
      .select('agency_id, bill_rate, agencies(name)')
      .eq('facility_id', facilityId)
      .eq('status', 'active'),
    // Placeholders that match this facility but aren't yet connected
    // (facility can initiate a request from here)
    admin
      .from('placeholder_facilities')
      .select('id, name, agency_id, connection_status, agencies(name)')
      .eq('matched_facility_id', facilityId)
      .not('connection_status', 'eq', 'connected'),
  ])

  const hasShiftConfig = (shiftConfigs ?? []).length > 0
  const facilityName = facility?.name ?? 'Your Facility'

  // Count pending placeholder shifts per agency-initiated request
  const pendingRequests = await Promise.all(
    (rawRequests ?? []).map(async (req) => {
      const { count } = await admin
        .from('shifts')
        .select('id', { count: 'exact', head: true })
        .eq('placeholder_facility_id', req.placeholder_id)
        .neq('status', 'canceled')
        .neq('status', 'confirmed')   // confirmed shifts are migrated, not deleted

      const agencyName = (req.agencies as { name: string } | null)?.name ?? 'Unknown Agency'
      const placeholderName = (req.placeholder_facilities as { name: string } | null)?.name ?? 'Unknown'

      return {
        id: req.id,
        agencyId: req.agency_id,
        agencyName,
        placeholderName,
        facilityName,
        pendingShiftCount: count ?? 0,
        requestedAt: req.requested_at,
        message: req.message,
      }
    })
  )

  // Matched placeholders for facility-side initiation
  type MatchedPlaceholder = {
    id: string
    name: string
    agency_id: string
    connection_status: string
    agencies: { name: string } | null
  }
  const matches = (matchedPlaceholders as unknown as MatchedPlaceholder[] ?? []).map(pf => ({
    id: pf.id,
    name: pf.name,
    agencyId: pf.agency_id,
    agencyName: pf.agencies?.name ?? 'Unknown Agency',
    connectionStatus: pf.connection_status,
  }))

  // Fetch confirmed shifts this month grouped by agency
  type ConnRow = {
    agency_id: string
    bill_rate: number | null
    agencies: { name: string } | null
  }
  const connRows = (connections as unknown as ConnRow[] ?? [])
  const agencyIds = connRows.map(c => c.agency_id)

  let agencyOverviews: AgencyOverview[] = []

  if (agencyIds.length > 0) {
    const { data: confirmedShifts } = await admin
      .from('shifts')
      .select('start_time, end_time, shift_claims(status, agency_id)')
      .eq('facility_id', facilityId)
      .eq('status', 'confirmed')
      .gte('shift_date', firstDay)
      .lte('shift_date', lastDay)

    type ShiftWithClaims = {
      start_time: string
      end_time: string
      shift_claims: Array<{ status: string; agency_id: string | null }>
    }

    const shifts2 = (confirmedShifts as unknown as ShiftWithClaims[] ?? [])

    const agencyMap: Record<string, { shifts: number; hours: number }> = {}
    for (const s of shifts2) {
      const confirmedClaim = s.shift_claims.find(c => c.status === 'confirmed')
      const aId = confirmedClaim?.agency_id
      if (!aId) continue
      if (!agencyMap[aId]) agencyMap[aId] = { shifts: 0, hours: 0 }
      agencyMap[aId].shifts++
      agencyMap[aId].hours += hoursWorked(s.start_time, s.end_time)
    }

    agencyOverviews = connRows.map(conn => {
      const stats = agencyMap[conn.agency_id] ?? { shifts: 0, hours: 0 }
      const bill = conn.bill_rate
      const estCost = bill && stats.hours > 0 ? Math.round(stats.hours * bill * 100) / 100 : null
      return {
        agencyId: conn.agency_id,
        agencyName: conn.agencies?.name ?? 'Unknown',
        confirmedShifts: stats.shifts,
        billRate: bill,
        estimatedCost: estCost,
        totalHours: Math.round(stats.hours * 10) / 10,
      }
    })
  }

  const { count: pendingClaimsCount } = await admin
    .from('shift_claims')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .in(
      'shift_id',
      await admin
        .from('shifts')
        .select('id')
        .eq('facility_id', facilityId)
        .eq('status', 'claimed')
        .then(r => (r.data ?? []).map((s: { id: string }) => s.id))
    )

  // Fill rate: current month all shifts + previous month for comparison
  const [
    { data: currMonthShifts },
    { data: prevMonthShifts },
    { data: rawRepeatClaims },
  ] = await Promise.all([
    admin
      .from('shifts')
      .select('credential_required, status')
      .eq('facility_id', facilityId)
      .gte('shift_date', firstDay)
      .lte('shift_date', lastDay),
    admin
      .from('shifts')
      .select('credential_required, status')
      .eq('facility_id', facilityId)
      .gte('shift_date', prevFirstDay)
      .lte('shift_date', prevLastDay),
    // Repeat nurses: all confirmed claims ever at this facility
    admin
      .from('shift_claims')
      .select('nurse_profile_id, confirmed_at, nurse_profiles(credential_type, profiles(full_name)), shifts!inner(facility_id, shift_date)')
      .eq('status', 'confirmed')
      .eq('shifts.facility_id', facilityId),
  ])

  // Build fill rate data
  const CREDS = ['CNA', 'CMA', 'LPN', 'LPN_IV', 'RN']
  function computeFillMap(shifts: Array<{ credential_required: string; status: string }>) {
    const map: Record<string, { confirmed: number; total: number }> = {}
    for (const cred of CREDS) map[cred] = { confirmed: 0, total: 0 }
    for (const s of shifts ?? []) {
      const cred = s.credential_required
      if (!map[cred]) map[cred] = { confirmed: 0, total: 0 }
      if (s.status !== 'canceled') map[cred].total++
      if (s.status === 'confirmed') map[cred].confirmed++
    }
    return map
  }
  const currMap = computeFillMap(currMonthShifts ?? [])
  const prevMap = computeFillMap(prevMonthShifts ?? [])
  const facilityFillRateData: FacilityFillRateRow[] = CREDS
    .map(cred => ({
      credential: cred,
      currentFilled: currMap[cred]?.confirmed ?? 0,
      currentTotal: currMap[cred]?.total ?? 0,
      prevFilled: prevMap[cred]?.confirmed ?? 0,
      prevTotal: prevMap[cred]?.total ?? 0,
    }))
    .filter(r => r.currentTotal > 0 || r.prevTotal > 0)

  // Build repeat nurses
  type RepeatClaimRow = {
    nurse_profile_id: string
    confirmed_at: string | null
    nurse_profiles: { credential_type: string; profiles: { full_name: string } | null } | null
    shifts: { facility_id: string; shift_date: string } | null
  }
  const repeatMap: Record<string, { full_name: string; credential_type: string; count: number; last_date: string }> = {}
  for (const c of (rawRepeatClaims as unknown as RepeatClaimRow[] ?? [])) {
    const id = c.nurse_profile_id
    if (!id) continue
    const name = c.nurse_profiles?.profiles?.full_name ?? 'Unknown'
    const cred = c.nurse_profiles?.credential_type ?? ''
    const shiftDate = (c.shifts as unknown as { shift_date: string } | null)?.shift_date ?? ''
    if (!repeatMap[id]) {
      repeatMap[id] = { full_name: name, credential_type: cred, count: 0, last_date: shiftDate }
    }
    repeatMap[id].count++
    if (shiftDate > repeatMap[id].last_date) repeatMap[id].last_date = shiftDate
  }
  const repeatNurses: RepeatNurseRow[] = Object.entries(repeatMap)
    .map(([nurse_profile_id, data]) => ({ nurse_profile_id, ...data, shift_count: data.count, last_shift_date: data.last_date }))
    .sort((a, b) => b.shift_count - a.shift_count || b.last_shift_date.localeCompare(a.last_shift_date))
    .slice(0, 20)

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{facilityName}</h1>
        {facility && (
          <p className="text-sm text-gray-500 mt-1">
            {facility.city}, {facility.state} &middot; {facility.facility_type.replace(/_/g, ' ')}
          </p>
        )}
      </div>

      {!hasShiftConfig && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-amber-500 text-xl leading-none mt-0.5">⚠</span>
          <div>
            <p className="text-sm font-medium text-amber-800">Shift configuration required</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Before you can post shifts, you need to define your named shift slots per credential type.
            </p>
            <Link
              href={`/facility/${facilityId}/settings`}
              className="inline-block mt-2 text-sm font-medium text-amber-800 underline hover:text-amber-900"
            >
              Go to Settings to configure shifts →
            </Link>
          </div>
        </div>
      )}

      {/* Facility-side match prompts — agency already managing shifts */}
      {matches.length > 0 && (
        <div className="mb-6">
          <FacilityMatchPromptSection matches={matches} />
        </div>
      )}

      {/* Agency-initiated pending connection requests */}
      {pendingRequests.length > 0 && (
        <div className="mb-6">
          <PendingConnectionRequests requests={pendingRequests} />
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Link
          href={`/facility/${facilityId}/shifts`}
          className="bg-white rounded-xl border border-gray-200 p-5 hover:border-teal-300 hover:shadow-sm transition group"
        >
          <div className="text-2xl mb-2">📅</div>
          <div className="font-semibold text-gray-900 group-hover:text-brand">Shifts</div>
          <div className="text-sm text-gray-500 mt-0.5">Post and manage shift slots</div>
        </Link>

        <Link
          href={`/facility/${facilityId}/claims`}
          className="bg-white rounded-xl border border-gray-200 p-5 hover:border-teal-300 hover:shadow-sm transition group"
        >
          <div className="text-2xl mb-2">✅</div>
          <div className="font-semibold text-gray-900 group-hover:text-brand">Claims</div>
          <div className="text-sm text-gray-500 mt-0.5">
            {(pendingClaimsCount ?? 0) > 0
              ? <span className="text-amber-600 font-medium">{pendingClaimsCount} pending review</span>
              : 'Review nurse claims'}
          </div>
        </Link>

        <Link
          href={`/facility/${facilityId}/settings`}
          className="bg-white rounded-xl border border-gray-200 p-5 hover:border-teal-300 hover:shadow-sm transition group"
        >
          <div className="text-2xl mb-2">⚙️</div>
          <div className="font-semibold text-gray-900 group-hover:text-brand">Settings</div>
          <div className="text-sm text-gray-500 mt-0.5">Configure shift slots and more</div>
        </Link>
      </div>

      {/* Agency Overview + Fill Rate */}
      <FacilityDashboardClient
        facilityId={facilityId}
        agencyOverviews={agencyOverviews}
        fillRateData={facilityFillRateData}
      />

      {/* Repeat Nurses */}
      {repeatNurses.length > 0 && (
        <div className="mt-6">
          <RepeatNurseTable rows={repeatNurses} />
        </div>
      )}
    </div>
  )
}
