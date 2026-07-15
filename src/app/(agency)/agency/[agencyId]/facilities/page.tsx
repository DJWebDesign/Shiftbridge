import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDemoUser } from '@/lib/demo/context'
import FacilitiesClient from './FacilitiesClient'
import AgencyPendingConnectionRequests from './AgencyPendingConnectionRequests'

const FACILITY_TYPE_LABELS: Record<string, string> = {
  long_term_care: 'Long-Term Care',
  assisted_living: 'Assisted Living',
  hospital: 'Hospital',
  rehabilitation: 'Rehabilitation',
  memory_care: 'Memory Care',
}

const CONNECTION_STATUS_STYLES: Record<string, string> = {
  unmatched:       'bg-gray-100 text-gray-600',
  match_detected:  'bg-amber-100 text-amber-700',
  request_pending: 'bg-teal-100 text-teal-700',
  connected:       'bg-green-100 text-green-700',
  declined:        'bg-red-100 text-red-700',
}

const CONNECTION_STATUS_LABELS: Record<string, string> = {
  unmatched:       'Unmatched',
  match_detected:  'Match Detected',
  request_pending: 'Request Pending',
  connected:       'Connected',
  declined:        'Declined',
}

export default async function FacilitiesPage({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const role = user?.app_metadata?.role
  if (!user || (role !== 'agency_admin' && !isDemoUser(user))) redirect('/login')

  if (isDemoUser(user)) {
    if (user.app_metadata?.agency_id !== agencyId) redirect('/login')
  } else {
    const { data: agencyAdmin } = await supabase
      .from('agency_admins')
      .select('agency_id')
      .eq('profile_id', user.id)
      .single()
    if (!agencyAdmin || agencyAdmin.agency_id !== agencyId) redirect('/login')
  }

  const admin = createAdminClient()

  const [{ data: placeholders }, { data: connections }, { data: rawFacilityRequests }] = await Promise.all([
    supabase
      .from('placeholder_facilities')
      .select('*')
      .eq('agency_id', agencyId)
      .order('name'),
    supabase
      .from('agency_facility_connections')
      .select('id, facility_id, bill_rate, status, facilities(id, name, facility_type, city, state)')
      .eq('agency_id', agencyId)
      .order('created_at'),
    // Facility-initiated pending requests — agency needs to respond
    admin
      .from('connection_requests')
      .select('id, facility_id, placeholder_id, requested_at, message, facilities(name), placeholder_facilities(name)')
      .eq('agency_id', agencyId)
      .eq('status', 'pending')
      .eq('initiated_by_role', 'facility')
      .order('requested_at', { ascending: false }),
  ])

  // Fetch names for any matched (but not yet connected) real facilities
  const matchedIds = (placeholders ?? [])
    .filter(pf => pf.matched_facility_id)
    .map(pf => pf.matched_facility_id as string)

  const matchedFacilityNames: Record<string, string> = {}
  if (matchedIds.length > 0) {
    const { data: matchedFacs } = await admin
      .from('facilities')
      .select('id, name')
      .in('id', matchedIds)
    for (const f of matchedFacs ?? []) {
      matchedFacilityNames[f.id] = f.name
    }
  }

  // Build facility-initiated request list with open shift counts
  const facilityRequests = await Promise.all(
    (rawFacilityRequests ?? []).map(async (req) => {
      const { count } = await admin
        .from('shifts')
        .select('id', { count: 'exact', head: true })
        .eq('placeholder_facility_id', req.placeholder_id)
        .neq('status', 'canceled')
        .neq('status', 'confirmed')

      const facilityName = (req.facilities as { name: string } | null)?.name ?? 'Unknown Facility'
      const placeholderName = (req.placeholder_facilities as { name: string } | null)?.name ?? 'Unknown'

      return {
        id: req.id,
        facilityId: req.facility_id,
        facilityName,
        placeholderName,
        pendingShiftCount: count ?? 0,
        requestedAt: req.requested_at,
        message: req.message,
      }
    })
  )

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Facilities</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your placeholder facilities and connected real facilities.
        </p>
      </div>

      {/* Facility-initiated connection requests that need agency response */}
      {facilityRequests.length > 0 && (
        <AgencyPendingConnectionRequests requests={facilityRequests} />
      )}

      {/* Connected real facilities */}
      {(connections ?? []).length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Connected Facilities
          </h2>
          <div className="space-y-2">
            {(connections ?? []).map(conn => {
              const fac = conn.facilities as { id: string; name: string; facility_type: string; city: string; state: string } | null
              if (!fac) return null
              return (
                <Link
                  key={conn.id}
                  href={`/agency/${agencyId}/facilities/${fac.id}`}
                  className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between hover:border-teal-300 hover:shadow-sm transition-all group"
                >
                  <div>
                    <p className="font-medium text-sm group-hover:text-teal-700 transition-colors" style={{ color: '#0D1B2A' }}>{fac.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#5B6B80' }}>
                      {FACILITY_TYPE_LABELS[fac.facility_type] ?? fac.facility_type} · {fac.city}, {fac.state}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {conn.bill_rate && (
                      <span className="text-xs" style={{ color: '#5B6B80' }}>${conn.bill_rate}/hr</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${conn.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {conn.status}
                    </span>
                    <span className="text-xs font-medium" style={{ color: '#0D9488' }}>View →</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Placeholder facilities */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Placeholder Facilities
          </h2>
        </div>

        <FacilitiesClient
          agencyId={agencyId}
          basePath={isDemoUser(user) ? `/demo/agency/${agencyId}` : undefined}
          initialPlaceholders={(placeholders ?? []) as Parameters<typeof FacilitiesClient>[0]['initialPlaceholders']}
          matchedFacilityNames={matchedFacilityNames}
          facilityTypeLabels={FACILITY_TYPE_LABELS}
          connectionStatusStyles={CONNECTION_STATUS_STYLES}
          connectionStatusLabels={CONNECTION_STATUS_LABELS}
        />
      </section>
    </div>
  )
}
