import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import NursysLookupForm from '@/components/staff/NursysLookupForm'

export default async function FacilityEnrollStaffPage({ params }: { params: Promise<{ facilityId: string }> }) {
  const { facilityId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href={`/facility/${facilityId}/staff`}
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
        >
          ← Back to Staff Roster
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Enroll Staff</h1>
        <p className="text-sm text-gray-500 mt-1">
          Select a credential type and fill in the staff member's details.
        </p>
      </div>

      <NursysLookupForm facilityId={facilityId} />
    </div>
  )
}
