import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface CompareShift {
  id: string
  shift_date: string
  start_time: string
  end_time: string
  credential_required: string
  status: string
  nurse_name: string | null
}

export interface CompareResult {
  placeholderShifts: CompareShift[]
  facilityShifts: CompareShift[]
  overlapDates: string[]          // YYYY-MM-DD dates with shifts on both sides
  placeholderName: string
  facilityName: string
  openCount: number               // open placeholder shifts that will be deleted
  confirmedCount: number          // confirmed placeholder shifts that will be migrated
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = user.app_metadata?.role
  if (role !== 'agency_admin' && role !== 'facility_admin' && role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const requestId = searchParams.get('request_id')

  if (!requestId) {
    return NextResponse.json({ error: 'request_id is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch the connection request — verify caller has access
  const { data: connRequest } = await admin
    .from('connection_requests')
    .select('id, agency_id, facility_id, placeholder_id, status')
    .eq('id', requestId)
    .single()

  if (!connRequest) {
    return NextResponse.json({ error: 'Connection request not found' }, { status: 404 })
  }

  // Verify the caller belongs to either the agency or the facility on this request
  if (role === 'agency_admin') {
    const { data: aa } = await supabase
      .from('agency_admins')
      .select('agency_id')
      .eq('profile_id', user.id)
      .single()
    if (!aa || aa.agency_id !== connRequest.agency_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (role === 'facility_admin') {
    const { data: fa } = await supabase
      .from('facility_admins')
      .select('facility_id')
      .eq('profile_id', user.id)
      .single()
    if (!fa || fa.facility_id !== connRequest.facility_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Date window: today - 30 days → today + 120 days
  const now = new Date()
  const fromDate = new Date(now)
  fromDate.setDate(fromDate.getDate() - 30)
  const toDate = new Date(now)
  toDate.setDate(toDate.getDate() + 120)
  const from = fromDate.toISOString().split('T')[0]
  const to   = toDate.toISOString().split('T')[0]

  // Fetch placeholder name and facility name in parallel
  const [
    { data: placeholder },
    { data: facility },
    { data: rawPlaceholderShifts },
    { data: rawFacilityShifts },
  ] = await Promise.all([
    admin.from('placeholder_facilities').select('name').eq('id', connRequest.placeholder_id).single(),
    admin.from('facilities').select('name').eq('id', connRequest.facility_id).single(),
    // All placeholder shifts in the window (regardless of status)
    admin
      .from('shifts')
      .select('id, shift_date, start_time, end_time, credential_required, status, shift_claims(status, nurse_profile_id, nurse_profiles(profiles(full_name)))')
      .eq('placeholder_facility_id', connRequest.placeholder_id)
      .gte('shift_date', from)
      .lte('shift_date', to)
      .order('shift_date')
      .order('start_time'),
    // All facility shifts in the window
    admin
      .from('shifts')
      .select('id, shift_date, start_time, end_time, credential_required, status, shift_claims(status, nurse_profile_id, nurse_profiles(profiles(full_name)))')
      .eq('facility_id', connRequest.facility_id)
      .gte('shift_date', from)
      .lte('shift_date', to)
      .order('shift_date')
      .order('start_time'),
  ])

  function extractNurseName(shift: Record<string, unknown>): string | null {
    const claims = shift.shift_claims as Array<Record<string, unknown>> | null
    if (!claims) return null
    const confirmed = claims.find(c => c.status === 'confirmed')
    if (!confirmed) return null
    const np = confirmed.nurse_profiles as Record<string, unknown> | null
    const profile = np?.profiles as Record<string, unknown> | null
    return (profile?.full_name as string) ?? null
  }

  const placeholderShifts: CompareShift[] = (rawPlaceholderShifts ?? []).map((s) => ({
    id: s.id as string,
    shift_date: s.shift_date as string,
    start_time: s.start_time as string,
    end_time: s.end_time as string,
    credential_required: s.credential_required as string,
    status: s.status as string,
    nurse_name: extractNurseName(s as Record<string, unknown>),
  }))

  const facilityShifts: CompareShift[] = (rawFacilityShifts ?? []).map((s) => ({
    id: s.id as string,
    shift_date: s.shift_date as string,
    start_time: s.start_time as string,
    end_time: s.end_time as string,
    credential_required: s.credential_required as string,
    status: s.status as string,
    nurse_name: extractNurseName(s as Record<string, unknown>),
  }))

  // Compute overlap dates
  const phDates = new Set(placeholderShifts.map(s => s.shift_date))
  const facDates = new Set(facilityShifts.map(s => s.shift_date))
  const overlapDates = [...phDates].filter(d => facDates.has(d)).sort()

  const openCount      = placeholderShifts.filter(s => s.status !== 'confirmed' && s.status !== 'canceled').length
  const confirmedCount = placeholderShifts.filter(s => s.status === 'confirmed').length

  const result: CompareResult = {
    placeholderShifts,
    facilityShifts,
    overlapDates,
    placeholderName: placeholder?.name ?? 'Placeholder',
    facilityName:    facility?.name ?? 'Facility',
    openCount,
    confirmedCount,
  }

  return NextResponse.json(result)
}
