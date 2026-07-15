import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDemoUser } from '@/lib/demo/context'

function hoursWorked(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const startMins = sh * 60 + sm
  const endMins = eh * 60 + em
  const diff = endMins >= startMins ? endMins - startMins : (24 * 60 - startMins) + endMins
  return Math.round((diff / 60) * 100) / 100
}

function escapeCsv(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = user.app_metadata?.role
  if (role !== 'agency_admin' && role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const agencyId = searchParams.get('agencyId')
  const month = searchParams.get('month')  // yyyy-mm

  if (!agencyId || !month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'agencyId and month (yyyy-mm) are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify agency admin belongs to this agency (skip for super_admin)
  if (role === 'agency_admin') {
    const { data: agencyAdmin } = await admin
      .from('agency_admins')
      .select('id')
      .eq('agency_id', agencyId)
      .eq('profile_id', user.id)
      .single()

    if (!agencyAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const firstDay = `${month}-01`
  const [year, mon] = month.split('-').map(Number)
  const lastDay = new Date(year, mon, 0).toISOString().split('T')[0]

  // Fetch connected facility IDs for this agency
  const { data: connections } = await admin
    .from('agency_facility_connections')
    .select('facility_id')
    .eq('agency_id', agencyId)
    .eq('status', 'active')

  const facilityIds = (connections ?? []).map(c => c.facility_id)

  // Fetch shifts for those facilities this month
  const { data: shifts } = await admin
    .from('shifts')
    .select(`
      id, shift_date, start_time, end_time, credential_required, priority_tier, status,
      is_late_cancel, cancel_reason,
      facilities(name, city, state),
      shift_claims(
        status, confirmed_at,
        nurse_profile_id,
        nurse_profiles(
          license_number, credential_type,
          profiles(full_name)
        ),
        agency_id
      )
    `)
    .in('facility_id', facilityIds.length > 0 ? facilityIds : ['00000000-0000-0000-0000-000000000000'])
    .gte('shift_date', firstDay)
    .lte('shift_date', lastDay)
    .order('shift_date', { ascending: true })
    .order('start_time', { ascending: true })

  // Also fetch nurse pay rates for this agency for financial calculation
  const { data: nurseRels } = await admin
    .from('agency_nurse_relationships')
    .select('nurse_profile_id, base_pay_rate')
    .eq('agency_id', agencyId)
    .eq('status', 'active')

  const payRateMap: Record<string, number> = {}
  for (const rel of nurseRels ?? []) {
    if (rel.nurse_profile_id && rel.base_pay_rate) {
      payRateMap[rel.nurse_profile_id] = rel.base_pay_rate
    }
  }

  // Build CSV rows
  const headers = [
    'Date', 'Facility', 'City', 'State',
    'Credential', 'Shift Start', 'Shift End', 'Hours',
    'Tier', 'Status', 'Nurse Name', 'License #',
    'Base Pay Rate', 'Total Pay', 'Late Cancel',
  ]

  type ShiftRow = NonNullable<typeof shifts>[number]
  type ClaimRow = NonNullable<ShiftRow['shift_claims']>[number]

  function getConfirmedClaim(shift: ShiftRow): ClaimRow | null {
    const claims = (shift.shift_claims ?? []) as ClaimRow[]
    return claims.find(c => c.status === 'confirmed') ?? null
  }

  const rows = (shifts ?? []).map(shift => {
    const fac = shift.facilities as { name: string; city: string; state: string } | null
    const confirmedClaim = getConfirmedClaim(shift)
    const nurseProfile = confirmedClaim
      ? (confirmedClaim.nurse_profiles as {
          license_number: string | null
          credential_type: string
          profiles: { full_name: string } | null
        } | null)
      : null

    const nurseName = nurseProfile?.profiles?.full_name ?? ''
    const licenseNum = nurseProfile?.license_number ?? ''
    const nurseProfileId = confirmedClaim?.nurse_profile_id ?? null
    const basePayRate = nurseProfileId ? (payRateMap[nurseProfileId] ?? null) : null
    const hours = hoursWorked(shift.start_time, shift.end_time)
    const totalPay = basePayRate !== null ? Math.round(basePayRate * hours * 100) / 100 : null

    return [
      shift.shift_date,
      fac?.name ?? '',
      fac?.city ?? '',
      fac?.state ?? '',
      shift.credential_required,
      shift.start_time.substring(0, 5),
      shift.end_time.substring(0, 5),
      hours,
      shift.priority_tier,
      shift.status,
      nurseName,
      licenseNum,
      basePayRate !== null ? basePayRate.toFixed(2) : '',
      totalPay !== null ? totalPay.toFixed(2) : '',
      shift.is_late_cancel ? 'Yes' : '',
    ]
  })

  const csvLines = [
    headers.map(escapeCsv).join(','),
    ...rows.map(row => row.map(escapeCsv).join(',')),
  ]

  const csv = csvLines.join('\r\n')
  const filename = `shifts-${agencyId}-${month}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
