import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'facility_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const facilityId = searchParams.get('facilityId')
  const from       = searchParams.get('from')
  const to         = searchParams.get('to')

  if (!facilityId || !from || !to) {
    return NextResponse.json({ error: 'facilityId, from, and to are required' }, { status: 400 })
  }

  // Verify caller owns this facility
  const { data: fa } = await supabase
    .from('facility_admins')
    .select('facility_id')
    .eq('profile_id', user.id)
    .single()

  if (!fa || fa.facility_id !== facilityId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data: shifts, error } = await admin
    .from('shifts')
    .select('*')
    .eq('facility_id', facilityId)
    .gte('shift_date', from)
    .lte('shift_date', to)
    .order('shift_date')
    .order('start_time')

  if (error) {
    console.error('[shifts/by-facility]', error)
    return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 })
  }

  return NextResponse.json({ shifts: shifts ?? [] })
}
