import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDemoUser } from '@/lib/demo/context'
import PlaceholderFacilityDetailClient from './PlaceholderFacilityDetailClient'

export default async function PlaceholderFacilityPage({
  params,
}: {
  params: Promise<{ agencyId: string; placeholderId: string }>
}) {
  const { agencyId, placeholderId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || (user.app_metadata?.role !== 'agency_admin' && !isDemoUser(user))) redirect('/login')

  const admin = createAdminClient()

  const { data: pf } = await admin
    .from('placeholder_facilities')
    .select('*')
    .eq('id', placeholderId)
    .eq('agency_id', agencyId)
    .single()

  if (!pf) notFound()

  // Initial month shifts for this placeholder
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0]

  const { data: initialShifts } = await admin
    .from('shifts')
    .select('*')
    .eq('placeholder_facility_id', placeholderId)
    .gte('shift_date', firstDay)
    .lte('shift_date', lastDay)
    .order('shift_date')

  return (
    <PlaceholderFacilityDetailClient
      agencyId={agencyId}
      placeholder={pf as any}
      initialShifts={(initialShifts ?? []) as any}
      initialYear={year}
      initialMonth={month}
    />
  )
}
