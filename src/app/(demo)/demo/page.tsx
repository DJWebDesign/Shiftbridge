import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DemoIndex() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'demo') redirect('/login')
  const agencyId: string = user.app_metadata?.agency_id ?? ''
  redirect(`/demo/agency/${agencyId}`)
}
