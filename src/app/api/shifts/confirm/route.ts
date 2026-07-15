import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchNotifications, type NotificationItem } from '@/lib/notifications/dispatch'
import { isDemoUser } from '@/lib/demo/context'

function fmtDate(d: string | undefined): string {
  if (!d) return 'the scheduled date'
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

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

  const { claim_id } = await request.json() as { claim_id: string }
  if (!claim_id) {
    return NextResponse.json({ error: 'claim_id is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Get the claim and its shift
  const { data: claim } = await admin
    .from('shift_claims')
    .select('id, status, shift_id, nurse_profile_id, agency_id')
    .eq('id', claim_id)
    .single()

  if (!claim) {
    return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
  }

  // Verify the shift belongs to this facility
  const { data: shift } = await admin
    .from('shifts')
    .select('id, status, facility_id, shift_date, credential_required')
    .eq('id', claim.shift_id)
    .single()

  if (!shift || shift.facility_id !== facilityAdmin.facility_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Idempotency: already confirmed
  if (claim.status === 'confirmed') {
    return NextResponse.json({ claim })
  }

  if (claim.status !== 'pending') {
    return NextResponse.json({ error: 'Claim is not in pending status' }, { status: 409 })
  }

  if (!['claimed', 'confirmed'].includes(shift.status)) {
    return NextResponse.json({ error: 'Shift cannot be confirmed in its current state' }, { status: 409 })
  }

  const now = new Date().toISOString()

  // Confirm the winning claim
  const { data: confirmed, error: confirmError } = await admin
    .from('shift_claims')
    .update({ status: 'confirmed', confirmed_at: now, confirmed_by: user.id })
    .eq('id', claim_id)
    .select()
    .single()

  if (confirmError) {
    console.error('[shifts/confirm] confirm error:', confirmError)
    return NextResponse.json({ error: 'Failed to confirm claim' }, { status: 500 })
  }

  // Reject all other pending claims for this shift
  await admin
    .from('shift_claims')
    .update({ status: 'rejected' })
    .eq('shift_id', claim.shift_id)
    .eq('status', 'pending')
    .neq('id', claim_id)

  // Mark shift as confirmed
  await admin
    .from('shifts')
    .update({ status: 'confirmed', updated_at: now })
    .eq('id', claim.shift_id)

  // Notify winning nurse (SMS + in-app) and rejected nurses (in-app)
  try {
    const [{ data: winNurse }, { data: facility }, { data: rejectedClaims }] = await Promise.all([
      admin.from('nurse_profiles').select('profile_id, phone').eq('id', claim.nurse_profile_id).single(),
      shift.facility_id
        ? admin.from('facilities').select('name').eq('id', shift.facility_id).single()
        : Promise.resolve({ data: null }),
      admin.from('shift_claims').select('nurse_profile_id').eq('shift_id', claim.shift_id).eq('status', 'rejected').neq('nurse_profile_id', claim.nurse_profile_id),
    ])

    const items: NotificationItem[] = []
    const confirmMsg = `Your ${shift.credential_required} claim on ${fmtDate(shift.shift_date)} at ${(facility as { name: string } | null)?.name ?? 'the facility'} has been confirmed!`

    if (winNurse?.profile_id) {
      if (winNurse.phone) {
        items.push({ profile_id: winNurse.profile_id, recipient_phone: winNurse.phone, channel: 'sms', event_type: 'shift_confirmed', message: confirmMsg, payload: { shift_id: claim.shift_id } })
      }
      items.push({ profile_id: winNurse.profile_id, channel: 'in_app', event_type: 'shift_confirmed', message: confirmMsg, payload: { shift_id: claim.shift_id } })
    }

    if (rejectedClaims && rejectedClaims.length > 0) {
      const rejectedNurseIds = rejectedClaims.map(r => r.nurse_profile_id)
      const { data: rejectedProfiles } = await admin.from('nurse_profiles').select('id, profile_id').in('id', rejectedNurseIds)
      for (const np of rejectedProfiles ?? []) {
        items.push({ profile_id: np.profile_id, channel: 'in_app', event_type: 'shift_filled', message: `The ${shift.credential_required} shift on ${fmtDate(shift.shift_date)} has been filled by another nurse.`, payload: { shift_id: claim.shift_id } })
      }
    }

    if (items.length > 0) await dispatchNotifications(items)
  } catch (err) {
    console.error('[confirm notification]', err)
  }

  return NextResponse.json({ claim: confirmed })
}
