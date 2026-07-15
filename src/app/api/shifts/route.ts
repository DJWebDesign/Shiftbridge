import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDemoUser } from '@/lib/demo/context'

const VALID_CREDENTIALS = new Set(['CNA', 'CMA', 'LPN', 'LPN_IV', 'RN'])

export async function POST(request: NextRequest) {
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

  const body = await request.json()
  const { facility_id, credential_required, shift_date, start_time, end_time, priority_tier, quantity, notes } = body

  if (facility_id !== facilityAdmin.facility_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!VALID_CREDENTIALS.has(credential_required)) {
    return NextResponse.json({ error: 'Invalid credential type' }, { status: 400 })
  }
  if (!shift_date || !start_time || !end_time) {
    return NextResponse.json({ error: 'shift_date, start_time, and end_time are required' }, { status: 400 })
  }

  const qty = Number(quantity)
  if (!Number.isInteger(qty) || qty < 1 || qty > 10) {
    return NextResponse.json({ error: 'Quantity must be 1–10' }, { status: 400 })
  }

  const tier = Number(priority_tier)
  if (![1, 2, 3].includes(tier)) {
    return NextResponse.json({ error: 'Tier must be 1, 2, or 3' }, { status: 400 })
  }

  const admin = createAdminClient()
  const notesTrimmed = typeof notes === 'string' && notes.trim() ? notes.trim().slice(0, 500) : null
  const rows = Array.from({ length: qty }, () => ({
    facility_id,
    credential_required,
    shift_date,
    start_time,
    end_time,
    priority_tier: tier,
    posted_by: user.id,
    status: 'open',
    is_placeholder: false,
    notes: notesTrimmed,
  }))

  const { data: created, error } = await admin
    .from('shifts')
    .insert(rows)
    .select()

  if (error) {
    console.error('[shifts POST] error:', error)
    return NextResponse.json({ error: 'Failed to create shifts' }, { status: 500 })
  }

  return NextResponse.json({ shifts: created })
}
