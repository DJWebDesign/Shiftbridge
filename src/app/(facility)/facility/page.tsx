import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function FacilityIndexPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: facilityAdmin } = await supabase
    .from('facility_admins')
    .select('facility_id')
    .eq('profile_id', user.id)
    .single()

  if (!facilityAdmin?.facility_id) redirect('/login')

  redirect(`/facility/${facilityAdmin.facility_id}`)
}
