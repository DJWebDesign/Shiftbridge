import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AgencyShiftCalendarView from '@/components/calendar/AgencyShiftCalendarView'

const FACILITY_TYPE_LABELS: Record<string, string> = {
  long_term_care:  'Long-Term Care',
  assisted_living: 'Assisted Living',
  hospital:        'Hospital',
  rehabilitation:  'Rehabilitation',
  memory_care:     'Memory Care',
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.07em] mb-1" style={{ color: '#94A3B8' }}>{label}</p>
      <p className="text-[14px] font-medium" style={{ color: '#0D1B2A' }}>{value || '—'}</p>
    </div>
  )
}

export default async function ConnectedFacilityPage({
  params,
}: {
  params: Promise<{ agencyId: string; facilityId: string }>
}) {
  const { agencyId, facilityId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'agency_admin') redirect('/login')

  const admin = createAdminClient()

  // Verify this facility is connected to this agency
  const { data: conn } = await admin
    .from('agency_facility_connections')
    .select('bill_rate, status')
    .eq('agency_id', agencyId)
    .eq('facility_id', facilityId)
    .single()

  if (!conn) notFound()

  // Fetch facility details
  const { data: facility } = await admin
    .from('facilities')
    .select('id, name, facility_type, address_line1, address_line2, city, state, zip, status')
    .eq('id', facilityId)
    .single()

  if (!facility) notFound()

  // Initial month shifts for this facility only
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-indexed
  const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0]

  const { data: initialShifts } = await admin
    .from('shifts')
    .select('*')
    .eq('facility_id', facilityId)
    .gte('shift_date', firstDay)
    .lte('shift_date', lastDay)
    .order('shift_date')

  const facilityNames: Record<string, string> = { [facility.id]: facility.name }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back + header */}
      <div>
        <Link
          href={`/agency/${agencyId}/facilities`}
          className="text-[13px] font-medium inline-flex items-center gap-1 mb-3"
          style={{ color: '#5B6B80' }}
        >
          ← Facilities
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-serif text-[28px]" style={{ color: '#0D1B2A' }}>{facility.name}</h1>
            <p className="text-[13px] mt-1" style={{ color: '#5B6B80' }}>
              {FACILITY_TYPE_LABELS[facility.facility_type] ?? facility.facility_type}
            </p>
          </div>
          <span
            className="text-[12px] font-bold px-3 py-1 rounded-full mt-1"
            style={{
              background: conn.status === 'active' ? '#DCFCE7' : '#F1F5F9',
              color: conn.status === 'active' ? '#15803D' : '#5B6B80',
            }}
          >
            {conn.status}
          </span>
        </div>
      </div>

      {/* Facility info card */}
      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #E4EAF0' }}>
        <h2 className="text-[13px] font-semibold mb-4" style={{ color: '#0D1B2A' }}>Facility Details</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
          <Field label="Address" value={`${facility.address_line1}${facility.address_line2 ? ', ' + facility.address_line2 : ''}`} />
          <Field label="City" value={facility.city} />
          <Field label="State / ZIP" value={`${facility.state} ${facility.zip}`} />
          <Field label="Type" value={FACILITY_TYPE_LABELS[facility.facility_type] ?? facility.facility_type} />
          <Field label="Bill Rate" value={conn.bill_rate ? `$${Number(conn.bill_rate).toFixed(2)}/hr` : 'Not set'} />
        </div>
      </div>

      {/* Shift calendar — filtered to this facility */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E4EAF0' }}>
        <div className="px-6 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <h2 className="text-[13px] font-semibold" style={{ color: '#0D1B2A' }}>Shifts</h2>
          <p className="text-[12px] mt-0.5" style={{ color: '#94A3B8' }}>Click a day to view or post shifts</p>
        </div>
        <div className="p-4">
          <AgencyShiftCalendarView
            agencyId={agencyId}
            initialShifts={(initialShifts ?? []) as any}
            initialYear={year}
            initialMonth={month}
            placeholderFacilities={[]}
            connectedFacilities={[{ id: facility.id, name: facility.name }]}
            facilityNames={facilityNames}
            filterFacilityId={facilityId}
          />
        </div>
      </div>
    </div>
  )
}
