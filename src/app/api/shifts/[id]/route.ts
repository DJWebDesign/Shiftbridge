import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDemoUser } from '@/lib/demo/context'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'facility_admin' && !isDemoUser(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: facilityAdmin } = await supabase
    .from('facility_admins')
    .select('facility_id')
    .eq('profile_id', user.id)
    .single()

  if (!facilityAdmin) {
    return NextResponse.json({ error: 'Facility not found' }, { status: 403 })
  }

  const { data: shift } = await supabase
    .from('shifts')
    .select('id, status, facility_id')
    .eq('id', id)
    .single()

  if (!shift || shift.facility_id !== facilityAdmin.facility_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (shift.status !== 'open') {
    return NextResponse.json({ error: 'Tier can only be changed on open shifts' }, { status: 409 })
  }

  const body = await request.json()
  const tier = Number(body.priority_tier)

  if (![1, 2, 3].includes(tier)) {
    return NextResponse.json({ error: 'Tier must be 1, 2, or 3' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: updated, error } = await admin
    .from('shifts')
    .update({ priority_tier: tier, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[shifts PATCH] error:', error)
    return NextResponse.json({ error: 'Failed to update shift' }, { status: 500 })
  }

  return NextResponse.json({ shift: updated })
}
