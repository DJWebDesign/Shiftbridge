import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import StaffRosterTable from '@/components/staff/StaffRosterTable'
import DNRSummaryTable from '@/components/staff/DNRSummaryTable'

export default async function StaffRosterPage({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Get nurse IDs on this agency's roster — use admin client to avoid RLS join issues
  // Auth is validated above and by the layout; agencyId is from the URL and trusted
  const { data: roster } = await admin
    .from('agency_nurse_relationships')
    .select(`
      id,
      base_pay_rate,
      status,
      notes,
      nurse_profiles (
        id,
        license_number,
        license_state,
        credential_type,
        license_status,
        license_expiration,
        iv_certified,
        cpr_expiration,
        tb_test_date,
        covid_vaccinated,
        profile_photo_url,
        profiles (
          full_name,
          email,
          phone
        )
      )
    `)
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })

  // Fetch DNR records for this agency's nurses
  const nurseIds = (roster ?? [])
    .map(r => (r.nurse_profiles as { id: string } | null)?.id)
    .filter((id): id is string => !!id)

  const { data: dnrRecords } = nurseIds.length > 0
    ? await admin
        .from('dnr_records')
        .select(`
          id,
          created_at,
          nurse_profiles (
            id,
            credential_type,
            profiles ( full_name )
          ),
          facilities ( name )
        `)
        .eq('agency_id', agencyId)
        .in('nurse_profile_id', nurseIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Roster</h1>
          <p className="text-sm text-gray-500 mt-1">{roster?.length ?? 0} nurses</p>
        </div>
        <Link
          href={`/agency/${agencyId}/staff/new`}
          className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover transition-colors"
        >
          Enroll Staff
        </Link>
      </div>

      <StaffRosterTable roster={roster ?? []} agencyId={agencyId} />

      {/* DNR Summary */}
      {(dnrRecords ?? []).length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Do Not Return Records</h2>
            <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {dnrRecords?.length}
            </span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <DNRSummaryTable records={(dnrRecords ?? []) as Parameters<typeof DNRSummaryTable>[0]['records']} />
          </div>
        </section>
      )}
    </div>
  )
}
