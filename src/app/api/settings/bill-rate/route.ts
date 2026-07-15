import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDemoUser } from '@/lib/demo/context'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (user.app_metadata?.role !== 'facility_admin' && !isDemoUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { facilityId, agencyId, billRate } = await req.json() as {
    facilityId: string
    agencyId: string
    billRate: number
  }

  if (!facilityId || !agencyId || typeof billRate !== 'number') {
    return NextResponse.json({ error: 'facilityId, agencyId, and billRate are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify the facility belongs to this user
  const { data: facilityAdmin } = await admin
    .from('facility_admins')
    .select('id')
    .eq('facility_id', facilityId)
    .eq('profile_id', user.id)
    .single()

  if (!facilityAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await admin
    .from('agency_facility_connections')
    .update({ bill_rate: billRate })
    .eq('facility_id', facilityId)
    .eq('agency_id', agencyId)
    .eq('status', 'active')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
