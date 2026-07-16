import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AgencyDashboardClient, {
  type ShiftSummary,
  type CredentialAlert,
  type OpenShiftNeed,
  type StaffSummary,
  type FillRateRow,
  type PendingApprovalClaim,
  type PossibleConnection,
} from './AgencyDashboardClient'

function hoursWorked(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const startMins = sh * 60 + sm
  const endMins = eh * 60 + em
  const diff = endMins >= startMins ? endMins - startMins : (24 * 60 - startMins) + endMins
  return Math.round((diff / 60) * 100) / 100
}

export default async function AgencyDashboard({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const firstDay = `${month}-01`
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  const today = now.toISOString().split('T')[0]

  const in30 = new Date(now)
  in30.setDate(in30.getDate() + 30)
  const in30Str = in30.toISOString().split('T')[0]

  const in90 = new Date(now)
  in90.setDate(in90.getDate() + 90)
  const in90Str = in90.toISOString().split('T')[0]

  // TB test alert: flag nurses whose test will be 1 year old within 30 days (done 335+ days ago)
  const tbAlertCutoff = new Date(now)
  tbAlertCutoff.setDate(tbAlertCutoff.getDate() - 335)
  const tbAlertStr = tbAlertCutoff.toISOString().split('T')[0]

  // TB 90-day pipeline: test done 275+ days ago (expires within 90 days)
  const tbPipelineCutoff = new Date(now)
  tbPipelineCutoff.setDate(tbPipelineCutoff.getDate() - 275)
  const tbPipelineStr = tbPipelineCutoff.toISOString().split('T')[0]

  // Previous month date range for fill rate comparison
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevFirstDay = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-01`
  const prevLastDay = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

  // Parallel fetches
  const [
    { data: agency },
    { data: relationships },
    { data: connections },
  ] = await Promise.all([
    supabase.from('agencies').select('name, status').eq('id', agencyId).single(),
    admin
      .from('agency_nurse_relationships')
      .select('nurse_profile_id, base_pay_rate')
      .eq('agency_id', agencyId)
      .eq('status', 'active'),
    admin
      .from('agency_facility_connections')
      .select('facility_id')
      .eq('agency_id', agencyId)
      .eq('status', 'active'),
  ])

  const nurseIds = (relationships ?? []).map(r => r.nurse_profile_id).filter(Boolean) as string[]
  const facilityIds = (connections ?? []).map(c => c.facility_id).filter(Boolean) as string[]

  // Pay rate map for financial snapshot
  const payRateMap: Record<string, number> = {}
  for (const rel of relationships ?? []) {
    if (rel.nurse_profile_id && rel.base_pay_rate) {
      payRateMap[rel.nurse_profile_id] = rel.base_pay_rate
    }
  }

  // Fetch shifts for connected facilities this month
  const shiftsPromise = facilityIds.length > 0
    ? admin
        .from('shifts')
        .select(`
          id, shift_date, start_time, end_time, credential_required, priority_tier, status,
          is_late_cancel, facility_id, placeholder_facility_id, is_placeholder,
          facilities(name), placeholder_facilities(name),
          shift_claims(status, nurse_profile_id, nurse_profiles(profiles(full_name)))
        `)
        .in('facility_id', facilityIds)
        .gte('shift_date', firstDay)
        .lte('shift_date', lastDay)
        .order('shift_date', { ascending: true })
    : Promise.resolve({ data: [] })

  // Fetch this agency's own placeholder shifts this month (not tied to a connected
  // facility_id -- these never matched the query above, so confirmed/pending/canceled
  // placeholder shifts were invisible on this dashboard until now)
  const placeholderShiftsPromise = admin
    .from('shifts')
    .select(`
      id, shift_date, start_time, end_time, credential_required, priority_tier, status,
      is_late_cancel, facility_id, placeholder_facility_id, is_placeholder,
      facilities(name), placeholder_facilities(name),
      shift_claims(status, nurse_profile_id, nurse_profiles(profiles(full_name)))
    `)
    .eq('agency_id', agencyId)
    .eq('is_placeholder', true)
    .gte('shift_date', firstDay)
    .lte('shift_date', lastDay)
    .order('shift_date', { ascending: true })

  // Fetch credential pipeline: nurses with credentials expiring within 90 days
  const alertsPromise = nurseIds.length > 0
    ? admin
        .from('nurse_profiles')
        .select('id, credential_type, license_expiration, cpr_expiration, tb_test_date, profiles(full_name)')
        .in('id', nurseIds)
        .or(`license_expiration.lte.${in90Str},cpr_expiration.lte.${in90Str},tb_test_date.lte.${tbPipelineStr}`)
    : Promise.resolve({ data: [] })

  // Fetch open placeholder shifts (unfilled, future, for this agency)
  const openNeedsPromise = admin
    .from('shifts')
    .select('id, shift_date, start_time, end_time, credential_required, priority_tier, placeholder_facilities(name)')
    .eq('agency_id', agencyId)
    .eq('is_placeholder', true)
    .eq('status', 'open')
    .gte('shift_date', today)
    .order('priority_tier', { ascending: false })
    .order('shift_date', { ascending: true })
    .limit(20)

  // Fetch DNR records for agency nurses
  const dnrPromise = nurseIds.length > 0
    ? admin
        .from('dnr_records')
        .select('nurse_profile_id')
        .in('nurse_profile_id', nurseIds)
    : Promise.resolve({ data: [] })

  // Fetch nurse profiles with full names for staff summaries
  const nurseProfilesPromise = nurseIds.length > 0
    ? admin
        .from('nurse_profiles')
        .select('id, credential_type, profiles(full_name)')
        .in('id', nurseIds)
    : Promise.resolve({ data: [] })

  // Fetch all claims for staff this month (for hours worked, cancel rate, reliability)
  // We filter by month in JS below since .gte on joined table columns is unreliable in Supabase JS
  const staffClaimsPromise = nurseIds.length > 0
    ? admin
        .from('shift_claims')
        .select('nurse_profile_id, status, shifts(shift_date, start_time, end_time, status, is_late_cancel)')
        .in('nurse_profile_id', nurseIds)
    : Promise.resolve({ data: [] })

  // Previous month shifts for fill rate comparison
  const prevMonthShiftsPromise = facilityIds.length > 0
    ? admin
        .from('shifts')
        .select('id, credential_required, status')
        .in('facility_id', facilityIds)
        .gte('shift_date', prevFirstDay)
        .lte('shift_date', prevLastDay)
    : Promise.resolve({ data: [] })

  // Previous month placeholder shifts for fill rate comparison
  const prevMonthPlaceholderShiftsPromise = admin
    .from('shifts')
    .select('id, credential_required, status')
    .eq('agency_id', agencyId)
    .eq('is_placeholder', true)
    .gte('shift_date', prevFirstDay)
    .lte('shift_date', prevLastDay)

  // Placeholder facilities with a detected address match, awaiting a connection request
  const possibleConnectionsPromise = admin
    .from('placeholder_facilities')
    .select('id, name, matched_facility_id')
    .eq('agency_id', agencyId)
    .eq('connection_status', 'match_detected')

  // Pending agency-review claims (for the approval queue)
  const pendingApprovalPromise = nurseIds.length > 0
    ? admin
        .from('shift_claims')
        .select('id, shift_id, nurse_profile_id, nurse_profiles(credential_type, profiles(full_name)), shifts(shift_date, start_time, end_time, credential_required, facility_id, placeholder_facility_id, facilities(name), placeholder_facilities(name))')
        .eq('agency_id', agencyId)
        .eq('status', 'agency_review')
        .in('nurse_profile_id', nurseIds)
        .order('created_at', { ascending: true })
    : Promise.resolve({ data: [] })

  const [
    { data: rawShifts },
    { data: rawPlaceholderShifts },
    { data: rawAlerts },
    { data: rawOpenNeeds },
    { data: dnrRecords },
    { data: nurseProfileRows },
    { data: staffClaims },
    { data: prevMonthShifts },
    { data: prevMonthPlaceholderShifts },
    { data: rawPendingApproval },
    { data: rawPossibleConnections },
  ] = await Promise.all([
    shiftsPromise,
    placeholderShiftsPromise,
    alertsPromise,
    openNeedsPromise,
    dnrPromise,
    nurseProfilesPromise,
    staffClaimsPromise,
    prevMonthShiftsPromise,
    prevMonthPlaceholderShiftsPromise,
    pendingApprovalPromise,
    possibleConnectionsPromise,
  ])

  // Resolve matched facility names for possible connections (agency has no RLS
  // access to facilities it isn't connected to yet, so this must use the admin client)
  const matchedFacilityIds = (rawPossibleConnections ?? [])
    .map(p => p.matched_facility_id)
    .filter(Boolean) as string[]
  const matchedFacilityNameMap: Record<string, string> = {}
  if (matchedFacilityIds.length > 0) {
    const { data: matchedFacs } = await admin
      .from('facilities')
      .select('id, name')
      .in('id', matchedFacilityIds)
    for (const f of matchedFacs ?? []) {
      matchedFacilityNameMap[f.id] = f.name
    }
  }
  const possibleConnections: PossibleConnection[] = (rawPossibleConnections ?? [])
    .filter(p => p.matched_facility_id && matchedFacilityNameMap[p.matched_facility_id])
    .map(p => ({
      id: p.id,
      name: p.name,
      matched_facility_id: p.matched_facility_id as string,
      matched_facility_name: matchedFacilityNameMap[p.matched_facility_id as string],
    }))

  // Process shifts into categories
  type RawShift = {
    id: string
    shift_date: string
    start_time: string
    end_time: string
    credential_required: string
    priority_tier: number
    status: string
    is_late_cancel: boolean | null
    facility_id: string | null
    placeholder_facility_id: string | null
    is_placeholder: boolean
    facilities: { name: string } | null
    placeholder_facilities: { name: string } | null
    shift_claims: Array<{
      status: string
      nurse_profile_id: string
      nurse_profiles: { profiles: { full_name: string } | null } | null
    }>
  }

  function toSummary(s: RawShift): ShiftSummary {
    const confirmed = s.shift_claims.find(c => c.status === 'confirmed')
    const pending = s.shift_claims.find(c => c.status === 'pending')
    const claim = confirmed ?? pending
    return {
      id: s.id,
      shift_date: s.shift_date,
      start_time: s.start_time,
      end_time: s.end_time,
      credential_required: s.credential_required,
      priority_tier: s.priority_tier,
      status: s.status,
      is_late_cancel: s.is_late_cancel,
      facility_name: s.facilities?.name ?? s.placeholder_facilities?.name ?? null,
      nurse_name: claim?.nurse_profiles?.profiles?.full_name ?? null,
      claim_status: claim?.status ?? null,
      is_placeholder: s.is_placeholder,
    }
  }

  const allShifts = [
    ...(rawShifts as unknown as RawShift[] ?? []),
    ...(rawPlaceholderShifts as unknown as RawShift[] ?? []),
  ]
  const agencyNurseIdSet = new Set(nurseIds)

  // Only count shifts where the confirmed/pending claim belongs to one of this agency's nurses
  const confirmedShifts = allShifts
    .filter(s => s.status === 'confirmed' && s.shift_claims.some(c => c.status === 'confirmed' && agencyNurseIdSet.has(c.nurse_profile_id)))
    .map(toSummary)
  const pendingShifts = allShifts
    .filter(s => s.status === 'claimed' && s.shift_claims.some(c => c.status === 'pending' && agencyNurseIdSet.has(c.nurse_profile_id)))
    .map(toSummary)
  const canceledShifts = allShifts.filter(s => s.status === 'canceled').map(toSummary)

  // Financial snapshot: sum confirmed hours × nurse pay rate (agency nurses only)
  let totalHours = 0
  let totalPay = 0
  for (const s of confirmedShifts) {
    const hrs = hoursWorked(s.start_time, s.end_time)
    totalHours += hrs
    const rawShift = allShifts.find(r => r.id === s.id)
    const confirmedClaim = rawShift?.shift_claims.find(c => c.status === 'confirmed' && agencyNurseIdSet.has(c.nurse_profile_id))
    const nurseId = confirmedClaim?.nurse_profile_id
    if (nurseId && payRateMap[nurseId]) {
      totalPay += hrs * payRateMap[nurseId]
    }
  }

  // Credential alerts — compute tb_expiration from tb_test_date + 1 year
  function addOneYear(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number)
    return `${y + 1}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  function daysUntilDate(dateStr: string): number {
    const [y, m, d] = dateStr.split('-').map(Number)
    const then = new Date(y, m - 1, d)
    const today2 = new Date()
    today2.setHours(0, 0, 0, 0)
    return Math.round((then.getTime() - today2.getTime()) / (1000 * 60 * 60 * 24))
  }

  const allAlerts: CredentialAlert[] = ((rawAlerts as unknown as Array<{
    id: string
    credential_type: string
    license_expiration: string | null
    cpr_expiration: string | null
    tb_test_date: string | null
    profiles: { full_name: string } | null
  }>) ?? []).map(a => ({
    id: a.id,
    full_name: a.profiles?.full_name ?? 'Unknown',
    credential_type: a.credential_type,
    license_expiration: a.license_expiration,
    cpr_expiration: a.cpr_expiration,
    tb_expiration: a.tb_test_date ? addOneYear(a.tb_test_date) : null,
  }))

  // Split into ≤30 days (urgent) and 31–90 days (pipeline)
  function alertIsUrgent(a: CredentialAlert): boolean {
    const dates = [a.license_expiration, a.cpr_expiration, a.tb_expiration].filter(Boolean) as string[]
    return dates.some(d => daysUntilDate(d) <= 30)
  }
  const credentialAlerts30 = allAlerts.filter(alertIsUrgent)
  const credentialAlerts90 = allAlerts.filter(a => !alertIsUrgent(a))

  // Open shift needs
  const openNeeds: OpenShiftNeed[] = ((rawOpenNeeds as unknown as Array<{
    id: string
    shift_date: string
    start_time: string
    end_time: string
    credential_required: string
    priority_tier: number
    placeholder_facilities: { name: string } | null
  }>) ?? []).map(s => ({
    id: s.id,
    shift_date: s.shift_date,
    start_time: s.start_time,
    credential_required: s.credential_required,
    priority_tier: s.priority_tier,
    facility_name: s.placeholder_facilities?.name ?? null,
    hours_open: hoursWorked(s.start_time, s.end_time),
  }))

  // DNR set
  const dnrNurseIds = new Set(((dnrRecords ?? []) as Array<{ nurse_profile_id: string }>).map(r => r.nurse_profile_id))

  // Filter staff claims to this month only (can't filter joined table columns in Supabase JS)
  type StaffClaimRow = {
    nurse_profile_id: string
    status: string
    shifts: { shift_date: string; start_time: string; end_time: string; status: string; is_late_cancel: boolean | null } | null
  }

  const staffClaims2 = (staffClaims as unknown as StaffClaimRow[] ?? [])
    .filter(c => c.shifts?.shift_date && c.shifts.shift_date >= firstDay && c.shifts.shift_date <= lastDay)

  const staffSummaries: StaffSummary[] = ((nurseProfileRows as unknown as Array<{
    id: string
    credential_type: string
    profiles: { full_name: string } | null
  }>) ?? []).map(np => {
    const myClaims = staffClaims2.filter(c => c.nurse_profile_id === np.id)
    const confirmedClaims = myClaims.filter(c => c.status === 'confirmed')
    const withdrawnClaims = myClaims.filter(c => c.status === 'withdrawn')
    const lateCancelClaims = withdrawnClaims.filter(c => c.shifts?.is_late_cancel === true)
    const totalActionable = confirmedClaims.length + withdrawnClaims.length
    const hrsWorked = confirmedClaims.reduce((acc, c) => {
      if (!c.shifts) return acc
      return acc + hoursWorked(c.shifts.start_time, c.shifts.end_time)
    }, 0)
    return {
      id: np.id,
      full_name: np.profiles?.full_name ?? 'Unknown',
      credential_type: np.credential_type,
      shifts_worked: confirmedClaims.length,
      shifts_canceled: withdrawnClaims.length,
      hours_worked: Math.round(hrsWorked * 10) / 10,
      has_dnr: dnrNurseIds.has(np.id),
      cancel_rate: totalActionable > 0 ? Math.round((withdrawnClaims.length / totalActionable) * 100) : 0,
      late_cancel_rate: withdrawnClaims.length > 0 ? Math.round((lateCancelClaims.length / withdrawnClaims.length) * 100) : 0,
    }
  }).filter(s => s.shifts_worked > 0 || s.shifts_canceled > 0 || s.has_dnr)

  // Pending approval claims
  type RawPendingApproval = {
    id: string
    shift_id: string
    nurse_profile_id: string
    nurse_profiles: { credential_type: string; profiles: { full_name: string } | null } | null
    shifts: {
      shift_date: string
      start_time: string
      end_time: string
      credential_required: string
      facility_id: string | null
      placeholder_facility_id: string | null
      facilities: { name: string } | null
      placeholder_facilities: { name: string } | null
    } | null
  }
  const pendingApprovalClaims: PendingApprovalClaim[] = ((rawPendingApproval as unknown as RawPendingApproval[]) ?? []).map(c => ({
    id: c.id,
    shift_id: c.shift_id,
    nurse_profile_id: c.nurse_profile_id,
    nurse_name: c.nurse_profiles?.profiles?.full_name ?? 'Unknown',
    credential: c.nurse_profiles?.credential_type ?? c.shifts?.credential_required ?? '—',
    shift_date: c.shifts?.shift_date ?? '',
    start_time: c.shifts?.start_time ?? '',
    end_time: c.shifts?.end_time ?? '',
    facility_name: c.shifts?.facilities?.name ?? c.shifts?.placeholder_facilities?.name ?? 'Unknown Facility',
  }))

  // Fill rate by credential type — current month vs previous month
  const CREDS = ['CNA', 'CMA', 'LPN', 'LPN_IV', 'RN']
  function computeFillRate(shifts: Array<{ credential_required: string; status: string }>) {
    const map: Record<string, { confirmed: number; total: number }> = {}
    for (const cred of CREDS) map[cred] = { confirmed: 0, total: 0 }
    for (const s of shifts) {
      const cred = s.credential_required
      if (!map[cred]) map[cred] = { confirmed: 0, total: 0 }
      if (s.status !== 'canceled') map[cred].total++
      if (s.status === 'confirmed') map[cred].confirmed++
    }
    return map
  }
  const currentFillMap = computeFillRate(allShifts as Array<{ credential_required: string; status: string }>)
  const prevMonthAllShifts = [
    ...(prevMonthShifts ?? []),
    ...(prevMonthPlaceholderShifts ?? []),
  ]
  const prevFillMap = computeFillRate(prevMonthAllShifts as Array<{ credential_required: string; status: string }>)
  const fillRateData: FillRateRow[] = CREDS
    .map(cred => ({
      credential: cred,
      currentFilled: currentFillMap[cred]?.confirmed ?? 0,
      currentTotal: currentFillMap[cred]?.total ?? 0,
      prevFilled: prevFillMap[cred]?.confirmed ?? 0,
      prevTotal: prevFillMap[cred]?.total ?? 0,
    }))
    .filter(r => r.currentTotal > 0 || r.prevTotal > 0)

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{agency?.name ?? 'Agency Dashboard'}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/agency/${agencyId}/staff/new`}
            className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover"
          >
            Enroll Staff
          </Link>
          <Link
            href={`/agency/${agencyId}/settings`}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
          >
            Settings
          </Link>
        </div>
      </div>

      {/* Nav stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Link href={`/agency/${agencyId}/staff`} className="card p-4 hover:border-teal-300 hover:shadow-sm transition group">
          <p className="text-xs text-ink-3 uppercase tracking-wide">Active Staff</p>
          <p className="text-2xl font-bold text-ink mt-1 tabular-nums">{nurseIds.length}</p>
          <p className="text-xs text-brand group-hover:underline mt-0.5">View roster →</p>
        </Link>
        <Link href={`/agency/${agencyId}/facilities`} className="card p-4 hover:border-teal-300 hover:shadow-sm transition group">
          <p className="text-xs text-ink-3 uppercase tracking-wide">Connected Facilities</p>
          <p className="text-2xl font-bold text-ink mt-1 tabular-nums">{facilityIds.length}</p>
          <p className="text-xs text-brand group-hover:underline mt-0.5">Manage →</p>
        </Link>
        <Link href={`/agency/${agencyId}/shifts`} className="card p-4 hover:border-teal-300 hover:shadow-sm transition group">
          <p className="text-xs text-ink-3 uppercase tracking-wide">Open Needs</p>
          <p className={`text-2xl font-bold mt-1 tabular-nums ${openNeeds.length > 0 ? 'text-red-600' : 'text-ink'}`}>{openNeeds.length}</p>
          <p className="text-xs text-brand group-hover:underline mt-0.5">View shifts →</p>
        </Link>
      </div>

      <AgencyDashboardClient
        agencyId={agencyId}
        month={month}
        confirmedShifts={confirmedShifts}
        pendingShifts={pendingShifts}
        canceledShifts={canceledShifts}
        credentialAlerts30={credentialAlerts30}
        credentialAlerts90={credentialAlerts90}
        openNeeds={openNeeds}
        financial={{ totalHours, totalPay: Math.round(totalPay * 100) / 100 }}
        staffSummaries={staffSummaries}
        fillRateData={fillRateData}
        pendingApprovalClaims={pendingApprovalClaims}
        possibleConnections={possibleConnections}
      />
    </div>
  )
}
