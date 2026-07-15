import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeAddress } from '@/lib/utils/address'
import { isDemoUser } from '@/lib/demo/context'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ placeholderId: string }> }
) {
  const { placeholderId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'agency_admin' && !isDemoUser(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { agencyId, name, facility_type, address_line1, address_line2, city, state, zip, coordinator_email, facility_notes, lat, lng } = body

  if (!agencyId || !name || !facility_type || !address_line1 || !city || !state || !zip) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify ownership
  const { data: existing } = await admin
    .from('placeholder_facilities')
    .select('id, agency_id')
    .eq('id', placeholderId)
    .single()

  if (!existing || existing.agency_id !== agencyId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await admin
    .from('placeholder_facilities')
    .update({
      name:              name.trim(),
      facility_type,
      address_line1:     address_line1.trim(),
      address_line2:     address_line2?.trim() || null,
      city:              city.trim(),
      state:             state.trim().toUpperCase(),
      zip:               zip.trim(),
      coordinator_email: coordinator_email?.trim() || null,
      facility_notes:    facility_notes?.trim() || null,
      address_normalized: normalizeAddress({ address_line1, city, state, zip }),
      ...(lat != null ? { lat } : {}),
      ...(lng != null ? { lng } : {}),
    })
    .eq('id', placeholderId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ placeholderId: string }> }
) {
  const { placeholderId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'agency_admin' && !isDemoUser(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: agencyAdmin } = await supabase
    .from('agency_admins')
    .select('agency_id')
    .eq('profile_id', user.id)
    .single()

  if (!agencyAdmin) {
    return NextResponse.json({ error: 'Agency not found' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('placeholder_facilities')
    .select('id, agency_id, connection_status')
    .eq('id', placeholderId)
    .single()

  if (!existing || existing.agency_id !== agencyAdmin.agency_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (existing.connection_status === 'connected') {
    return NextResponse.json(
      { error: 'Cannot delete a connected placeholder. The real facility connection remains active.' },
      { status: 409 }
    )
  }

  // Delete shifts first (no cascade FK), then the placeholder
  await admin.from('shifts').delete().eq('placeholder_facility_id', placeholderId)
  await admin.from('connection_requests').delete().eq('placeholder_id', placeholderId)

  const { error } = await admin
    .from('placeholder_facilities')
    .delete()
    .eq('id', placeholderId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
