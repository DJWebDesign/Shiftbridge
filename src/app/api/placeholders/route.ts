import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeAddress } from '@/lib/utils/address'
import { dispatchNotifications } from '@/lib/notifications/dispatch'
import { isDemoUser } from '@/lib/demo/context'

const VALID_FACILITY_TYPES = new Set([
  'long_term_care', 'assisted_living', 'hospital', 'rehabilitation', 'memory_care',
])

export async function POST(request: NextRequest) {
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

  const body = await request.json()
  const { name, facility_type, address_line1, address_line2, city, state, zip, coordinator_email, lat, lng } = body

  if (!name || !facility_type || !address_line1 || !city || !state || !zip) {
    return NextResponse.json({ error: 'name, facility_type, address_line1, city, state, zip are required' }, { status: 400 })
  }

  if (!VALID_FACILITY_TYPES.has(facility_type)) {
    return NextResponse.json({ error: 'Invalid facility_type' }, { status: 400 })
  }

  const address_normalized = normalizeAddress({ address_line1, city, state, zip })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('placeholder_facilities')
    .insert({
      agency_id: agencyAdmin.agency_id,
      name,
      facility_type,
      address_line1,
      address_line2: address_line2 || null,
      city,
      state,
      zip,
      address_normalized,
      coordinator_email: coordinator_email || null,
      lat: lat ?? null,
      lng: lng ?? null,
      connection_status: 'unmatched',
    })
    .select()
    .single()

  if (error) {
    console.error('[placeholders POST] error:', error)
    return NextResponse.json({ error: 'Failed to create placeholder facility' }, { status: 500 })
  }

  // Check if a real facility already exists with matching address.
  // The DB trigger only fires on facilities INSERT (reverse direction), so we
  // handle the placeholder-created-after-facility case here in application code.
  // Match on address alone -- facility_type is entered independently by two
  // different people and often disagrees for the same building; a match is
  // only ever a suggestion (agency still sends a request, facility still accepts).
  try {
    const { data: match } = await admin
      .from('facilities')
      .select('id')
      .eq('address_normalized', address_normalized)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (match) {
      const { data: matchedFac } = await admin
        .from('facilities')
        .select('id, name')
        .eq('id', match.id)
        .single()

      await admin
        .from('placeholder_facilities')
        .update({
          connection_status: 'match_detected',
          matched_facility_id: match.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.id)

      // Notify the agency admin in-app
      const { data: agencyAdminRow } = await admin
        .from('agency_admins')
        .select('profile_id')
        .eq('agency_id', agencyAdmin.agency_id)
        .limit(1)
        .maybeSingle()

      if (agencyAdminRow?.profile_id) {
        await dispatchNotifications([{
          profile_id: agencyAdminRow.profile_id,
          channel: 'in_app',
          event_type: 'match_detected',
          message: `A real facility matching "${name}" is already on ShiftBridge. Send a connection request to link your account.`,
          payload: { placeholder_id: data.id, facility_id: match.id },
        }])
      }

      data.connection_status = 'match_detected'
      data.matched_facility_id = match.id
      ;(data as typeof data & { matched_facility_name?: string | null }).matched_facility_name = matchedFac?.name ?? null
    }
  } catch (matchErr) {
    // Never block the response on match-detection failure
    console.error('[placeholders POST] match detection error:', matchErr)
  }

  return NextResponse.json({ facility: data }, { status: 201 })
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'agency_admin' && !isDemoUser(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('placeholder_facilities')
    .select('*')
    .order('name')

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch facilities' }, { status: 500 })
  }

  return NextResponse.json({ facilities: data ?? [] })
}
