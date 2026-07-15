import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import StaffRosterTable from '@/components/staff/StaffRosterTable'

export default async function FacilityStaffPage({ params }: { params: Promise<{ facilityId: string }> }) {
  const { facilityId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Find the house agency for this facility
  const { data: houseAgency } = await admin
    .from('agencies')
    .select('id')
    .eq('house_for_facility_id', facilityId)
    .single()

  const roster = houseAgency
    ? (await admin
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
        .eq('agency_id', houseAgency.id)
        .order('created_at', { ascending: false })
      ).data
    : []

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Roster</h1>
          <p className="text-sm text-gray-500 mt-1">{roster?.length ?? 0} staff members</p>
        </div>
        <Link
          href={`/facility/${facilityId}/staff/new`}
          className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover transition-colors"
        >
          Enroll Staff
        </Link>
      </div>

      {roster && roster.length > 0 ? (
        <StaffRosterTable
          roster={roster as Parameters<typeof StaffRosterTable>[0]['roster']}
          agencyId={houseAgency!.id}
          facilityId={facilityId}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-sm">No staff enrolled yet.</p>
          <p className="text-gray-400 text-xs mt-1">
            Use the &quot;Enroll Staff&quot; button to add your first staff member.
          </p>
        </div>
      )}
    </div>
  )
}
