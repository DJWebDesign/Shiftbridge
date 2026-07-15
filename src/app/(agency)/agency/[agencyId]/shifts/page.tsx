import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDemoUser } from '@/lib/demo/context'
import AgencyShiftsClient, { type Shift } from './AgencyShiftsClient'

export default async function AgencyShiftsPage({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const role = user?.app_metadata?.role
  if (!user || (role !== 'agency_admin' && !isDemoUser(user))) redirect('/login')

  const admin = createAdminClient()

  // Verify ownership — demo users carry agencyId in app_metadata
  if (isDemoUser(user)) {
    if (user.app_metadata?.agency_id !== agencyId) redirect('/login')
  } else {
    const { data: agencyAdmin } = await supabase
      .from('agency_admins').select('agency_id').eq('profile_id', user.id).single()
    if (!agencyAdmin || agencyAdmin.agency_id !== agencyId) redirect('/login')
  }

  const now = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth()
  const firstDay  = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDay   = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`

  // Fetch connected facilities + placeholder facilities
  const [{ data: connections }, { data: placeholders }] = await Promise.all([
    admin
      .from('agency_facility_connections')
      .select('facility_id, facilities(id, name)')
      .eq('agency_id', agencyId)
      .eq('status', 'active'),
    admin
      .from('placeholder_facilities')
      .select('id, name')
      .eq('agency_id', agencyId)
      .order('name'),
  ])

  const connectedFacilities: { id: string; name: string }[] = []
  const facilityNames: Record<string, string> = {}

  for (const conn of connections ?? []) {
    const fac = conn.facilities as { id: string; name: string } | null
    if (fac) { connectedFacilities.push(fac); facilityNames[fac.id] = fac.name }
  }
  const placeholderFacilities = (placeholders ?? []) as { id: string; name: string }[]
  for (const pf of placeholderFacilities) { facilityNames[pf.id] = pf.name }

  const facilityIds     = connectedFacilities.map(f => f.id)
  const placeholderIds  = placeholderFacilities.map(f => f.id)

  // Fetch all shifts this month for connected + placeholder facilities
  const shiftQueries: PromiseLike<{ data: Shift[] | null }>[] = []

  if (facilityIds.length > 0) {
    shiftQueries.push(
      admin.from('shifts')
        .select('id,shift_date,start_time,end_time,credential_required,priority_tier,status,is_placeholder,facility_id,placeholder_facility_id')
        .in('facility_id', facilityIds)
        .gte('shift_date', firstDay)
        .lte('shift_date', lastDay)
        .then(r => ({ data: r.data ?? [] }))
    )
  }
  if (placeholderIds.length > 0) {
    shiftQueries.push(
      admin.from('shifts')
        .select('id,shift_date,start_time,end_time,credential_required,priority_tier,status,is_placeholder,facility_id,placeholder_facility_id')
        .in('placeholder_facility_id', placeholderIds)
        .gte('shift_date', firstDay)
        .lte('shift_date', lastDay)
        .then(r => ({ data: r.data ?? [] }))
    )
  }

  const results = await Promise.all(shiftQueries)
  const allShifts = results.flatMap(r => r.data ?? [])
  const seen = new Set<string>()
  const initialShifts = allShifts.filter(s => {
    if (seen.has(s.id)) return false
    seen.add(s.id); return true
  })

  const hasAnything = connectedFacilities.length > 0 || placeholderFacilities.length > 0

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-serif text-[28px]" style={{ color: '#0D1B2A' }}>Shifts</h1>
        <p className="text-[13px] mt-1" style={{ color: '#5B6B80' }}>
          All shifts across your connected and placeholder facilities.
        </p>
      </div>

      {!hasAnything ? (
        <div className="rounded-xl px-5 py-4 text-[14px]"
          style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#B45309' }}>
          No facilities connected yet. Add placeholder facilities under{' '}
          <Link href={`/agency/${agencyId}/facilities`} className="underline font-semibold">Facilities</Link>{' '}
          to start posting shifts.
        </div>
      ) : (
        <AgencyShiftsClient
          agencyId={agencyId}
          initialShifts={initialShifts}
          initialYear={year}
          initialMonth={month}
          connectedFacilities={connectedFacilities}
          placeholderFacilities={placeholderFacilities}
          facilityNames={facilityNames}
        />
      )}
    </div>
  )
}
