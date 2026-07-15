import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDemoUser } from '@/lib/demo/context'

const VALID_CREDENTIAL_TYPES = new Set(['CNA', 'CMA', 'LPN', 'LPN_IV', 'RN'])

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
  const { facilityId, configs } = body as {
    facilityId: string
    configs: Array<{
      credential_type: string
      shift_name: string
      start_time: string
      end_time: string
    }>
  }

  if (facilityId !== facilityAdmin.facility_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!Array.isArray(configs)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  for (const row of configs) {
    if (!VALID_CREDENTIAL_TYPES.has(row.credential_type)) {
      return NextResponse.json({ error: `Invalid credential type: ${row.credential_type}` }, { status: 400 })
    }
    if (!row.shift_name?.trim()) {
      return NextResponse.json({ error: 'Shift name is required' }, { status: 400 })
    }
    if (!row.start_time || !row.end_time) {
      return NextResponse.json({ error: 'Start and end times are required' }, { status: 400 })
    }
  }

  const admin = createAdminClient()

  // Delete existing configs for this facility, then insert fresh set
  const { error: deleteError } = await admin
    .from('facility_shift_configs')
    .delete()
    .eq('facility_id', facilityId)

  if (deleteError) {
    console.error('[shift-configs] delete error:', deleteError)
    return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 })
  }

  if (configs.length > 0) {
    const rows = configs.map(c => ({
      facility_id: facilityId,
      credential_type: c.credential_type,
      shift_name: c.shift_name.trim(),
      start_time: c.start_time,
      end_time: c.end_time,
    }))

    const { error: insertError } = await admin
      .from('facility_shift_configs')
      .insert(rows)

    if (insertError) {
      console.error('[shift-configs] insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
