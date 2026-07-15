import { createAdminClient } from '@/lib/supabase/admin'
import AdminDashboardClient, { type AccountRow, type ConnectionRow, type DemoSessionRow } from './AdminDashboardClient'

export default async function AdminDashboard() {
  const admin = createAdminClient()

  const now = new Date()
  const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  // Parallel platform stats + data fetches
  const [
    { count: totalAgencies },
    { count: totalFacilities },
    { count: totalNurses },
    { count: shiftsThisMonth },
    { count: confirmedThisMonth },
    { data: rawProfiles },
    { data: rawConnections },
  ] = await Promise.all([
    admin.from('agencies').select('id', { count: 'exact', head: true }),
    admin.from('facilities').select('id', { count: 'exact', head: true }),
    admin.from('nurse_profiles').select('id', { count: 'exact', head: true }),
    admin.from('shifts').select('id', { count: 'exact', head: true })
      .gte('shift_date', firstDay),
    admin.from('shifts').select('id', { count: 'exact', head: true })
      .eq('status', 'confirmed')
      .gte('shift_date', firstDay),
    // Profiles with agency/facility context
    admin
      .from('profiles')
      .select('id, full_name, email, role, is_active, created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    // Agency-facility connections
    admin
      .from('agency_facility_connections')
      .select('agency_id, facility_id, status, accepted_at, agencies(name), facilities(name)')
      .order('accepted_at', { ascending: false })
      .limit(500),
  ])

  // Fetch agency admin and facility admin mappings to get entity names
  const [{ data: agencyAdmins }, { data: facilityAdmins }, { data: nurseRelData }, { data: rawDemoSessions }] = await Promise.all([
    admin.from('agency_admins').select('profile_id, agencies(name)'),
    admin.from('facility_admins').select('profile_id, facilities(name)'),
    admin.from('agency_nurse_relationships').select('nurse_profile_id, agencies(name)').eq('status', 'active').limit(500),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('demo_sessions').select('id, created_at, expires_at, agency_id, facility_id').order('created_at', { ascending: false }).limit(100),
  ])

  // Build entity name map
  const entityMap: Record<string, string> = {}
  for (const aa of agencyAdmins ?? []) {
    const name = (aa.agencies as { name: string } | null)?.name
    if (name) entityMap[aa.profile_id] = name
  }
  for (const fa of facilityAdmins ?? []) {
    const name = (fa.facilities as { name: string } | null)?.name
    if (name) entityMap[fa.profile_id] = name
  }
  // For nurses, pick their first agency name
  for (const rel of nurseRelData ?? []) {
    const name = (rel.agencies as { name: string } | null)?.name
    if (name && !entityMap[rel.nurse_profile_id]) entityMap[rel.nurse_profile_id] = name
  }

  type RawProfile = {
    id: string
    full_name: string
    email: string
    role: string
    is_active: boolean
    created_at: string
  }

  const accounts: AccountRow[] = ((rawProfiles as unknown as RawProfile[]) ?? []).map(p => ({
    id: p.id,
    full_name: p.full_name,
    email: p.email,
    role: p.role,
    is_active: p.is_active,
    created_at: p.created_at,
    entity_name: entityMap[p.id] ?? null,
  }))

  type RawConn = {
    agency_id: string
    facility_id: string
    status: string
    accepted_at: string | null
    agencies: { name: string } | null
    facilities: { name: string } | null
  }

  const connections: ConnectionRow[] = ((rawConnections as unknown as RawConn[]) ?? []).map(c => ({
    agencyId: c.agency_id,
    agencyName: c.agencies?.name ?? 'Unknown',
    facilityId: c.facility_id,
    facilityName: c.facilities?.name ?? 'Unknown',
    status: c.status,
    connectedAt: c.accepted_at,
  }))

  const demoSessions: DemoSessionRow[] = ((rawDemoSessions ?? []) as DemoSessionRow[])
  const activeDemoCount = demoSessions.filter(s => new Date(s.expires_at) > now).length

  const stats = [
    { label: 'Agencies', value: totalAgencies ?? 0, color: 'text-blue-700' },
    { label: 'Facilities', value: totalFacilities ?? 0, color: 'text-teal-700' },
    { label: 'Nurses', value: totalNurses ?? 0, color: 'text-green-700' },
    { label: 'Shifts This Month', value: shiftsThisMonth ?? 0, color: 'text-gray-900' },
    { label: 'Confirmed This Month', value: confirmedThisMonth ?? 0, color: 'text-green-700' },
    { label: 'Connections', value: connections.filter(c => c.status === 'active').length, color: 'text-purple-700' },
  ]

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Super Admin</h1>
        <p className="text-sm text-gray-500 mt-1">Platform overview &mdash; {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide leading-tight">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <AdminDashboardClient accounts={accounts} connections={connections} demoSessions={demoSessions} activeDemoCount={activeDemoCount} />
    </div>
  )
}
