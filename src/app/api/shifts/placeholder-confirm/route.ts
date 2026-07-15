import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchNotifications, type NotificationItem } from '@/lib/notifications/dispatch'
import { isDemoUser } from '@/lib/demo/context'

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

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

  const body = await request.json() as { shift_id: string; action: 'confirm' | 'decline'; reopen?: boolean }
  const { shift_id, action, reopen = true } = body

  if (!shift_id || !action) {
    return NextResponse.json({ error: 'shift_id and action are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch shift and verify agency ownership
  const { data: shift } = await admin
    .from('shifts')
    .select('id, status, is_placeholder, agency_id, placeholder_facility_id, credential_required, shift_date, start_time, end_time')
    .eq('id', shift_id)
    .single()

  if (!shift) {
    return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  }

  if (!shift.is_placeholder || shift.agency_id !== agencyAdmin.agency_id) {
    return NextResponse.json({ error: 'Not authorized for this shift' }, { status: 403 })
  }

  if (!['claimed', 'confirmed'].includes(shift.status)) {
    return NextResponse.json({ error: 'No pending claim to action' }, { status: 409 })
  }

  const { data: placeholder } = shift.placeholder_facility_id
    ? await admin.from('placeholder_facilities').select('name').eq('id', shift.placeholder_facility_id).single()
    : { data: null }
  const facilityName = placeholder?.name ?? 'a facility'

  // Find pending claims
  const { data: pendingClaims } = await admin
    .from('shift_claims')
    .select('id, nurse_profile_id, agency_id')
    .eq('shift_id', shift_id)
    .eq('status', 'pending')
    .order('claimed_at')

  if (!pendingClaims || pendingClaims.length === 0) {
    return NextResponse.json({ error: 'No pending claims found' }, { status: 409 })
  }

  const shiftDateFmt = fmtDate(shift.shift_date)
  const now = new Date().toISOString()

  if (action === 'confirm') {
    const winning = pendingClaims[0]

    // Confirm the first pending claim
    await admin
      .from('shift_claims')
      .update({ status: 'confirmed', confirmed_at: now, confirmed_by: user.id })
      .eq('id', winning.id)

    // Reject the rest
    if (pendingClaims.length > 1) {
      await admin
        .from('shift_claims')
        .update({ status: 'rejected' })
        .in('id', pendingClaims.slice(1).map(c => c.id))
    }

    // Update shift status
    await admin
      .from('shifts')
      .update({ status: 'confirmed', updated_at: now })
      .eq('id', shift_id)

    // Notify winning nurse (SMS + in-app) and rejected nurses (in-app)
    try {
      const items: NotificationItem[] = []

      const { data: winNurse } = await admin
        .from('nurse_profiles')
        .select('profile_id, phone')
        .eq('id', winning.nurse_profile_id)
        .single()

      const confirmMsg = `Your ${shift.credential_required} shift on ${shiftDateFmt} at ${facilityName} has been confirmed!`
      if (winNurse?.profile_id) {
        if (winNurse.phone) {
          items.push({ profile_id: winNurse.profile_id, recipient_phone: winNurse.phone, channel: 'sms', event_type: 'shift_confirmed', message: confirmMsg, payload: { shift_id } })
        }
        items.push({ profile_id: winNurse.profile_id, channel: 'in_app', event_type: 'shift_confirmed', message: confirmMsg, payload: { shift_id } })
      }

      if (pendingClaims.length > 1) {
        const rejectedNurseIds = pendingClaims.slice(1).map(c => c.nurse_profile_id)
        const { data: rejProfiles } = await admin.from('nurse_profiles').select('id, profile_id').in('id', rejectedNurseIds)
        for (const np of rejProfiles ?? []) {
          items.push({ profile_id: np.profile_id, channel: 'in_app', event_type: 'shift_filled', message: `The ${shift.credential_required} shift on ${shiftDateFmt} has been filled by another nurse.`, payload: { shift_id } })
        }
      }

      if (items.length > 0) await dispatchNotifications(items)
    } catch (err) {
      console.error('[placeholder-confirm notify]', err)
    }

    return NextResponse.json({ status: 'confirmed' })
  }

  // action === 'decline'
  const claimIds = pendingClaims.map(c => c.id)
  await admin
    .from('shift_claims')
    .update({ status: 'rejected' })
    .in('id', claimIds)

  await admin
    .from('shifts')
    .update({ status: reopen ? 'open' : 'canceled', updated_at: now })
    .eq('id', shift_id)

  // Notify each rejected nurse in-app
  try {
    const items: NotificationItem[] = []
    for (const claim of pendingClaims) {
      const { data: np } = await admin.from('nurse_profiles').select('profile_id').eq('id', claim.nurse_profile_id).single()
      if (np?.profile_id) {
        items.push({
          profile_id: np.profile_id,
          channel: 'in_app',
          event_type: 'shift_canceled',
          message: `Your ${shift.credential_required} shift on ${shiftDateFmt} at ${facilityName} was not confirmed.${reopen ? '' : ' The shift has been closed.'}`,
          payload: { shift_id },
        })
      }
    }
    if (items.length > 0) await dispatchNotifications(items)
  } catch (err) {
    console.error('[placeholder-decline notify]', err)
  }

  return NextResponse.json({ status: reopen ? 'declined_open' : 'declined_canceled' })
}
