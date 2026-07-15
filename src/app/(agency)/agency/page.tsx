import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AgencyIndexPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: agencyAdmin } = await supabase
    .from('agency_admins')
    .select('agency_id')
    .eq('profile_id', user.id)
    .single()

  if (!agencyAdmin?.agency_id) redirect('/login')

  redirect(`/agency/${agencyAdmin.agency_id}`)
}
