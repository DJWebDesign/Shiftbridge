import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchNotifications } from '@/lib/notifications/dispatch'
import { isDemoUser } from '@/lib/demo/context'

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const role = user?.app_metadata?.role
  if (!user || (!['facility_admin', 'agency_admin'].includes(role) && !isDemoUser(user))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { shift_id, reason, final: isFinal } = await request.json() as {
    shift_id: string
    reason?: string
    final?: boolean
  }
  if (!shift_id) {
    return NextResponse.json({ error: 'shift_id is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: shift } = await admin
    .from('shifts')
    .select('id, status, facility_id, placeholder_facility_id, agency_id, shift_date, start_time, is_placeholder')
    .eq('id', shift_id)
    .single()

  if (!shift) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Verify ownership based on role
  if (role === 'facility_admin') {
    const { data: facilityAdmin } = await supabase
      .from('facility_admins')
      .select('facility_id')
      .eq('profile_id', user.id)
      .single()

    if (!facilityAdmin || shift.facility_id !== facilityAdmin.facility_id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
  } else {
    // agency_admin: can only cancel placeholder shifts belonging to their agency
    if (!shift.is_placeholder) {
      return NextResponse.json({ error: 'Agency admins can only cancel placeholder shifts' }, { status: 403 })
    }
    const { data: agencyAdmin } = await supabase
      .from('agency_admins')
      .select('agency_id')
      .eq('profile_id', user.id)
      .single()

    if (!agencyAdmin || shift.agency_id !== agencyAdmin.agency_id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
  }

  if (!['open', 'claimed', 'confirmed'].includes(shift.status)) {
    return NextResponse.json({ error: 'Shift cannot be canceled in its current state' }, { status: 409 })
  }

  // Determine late-cancel: <12 hours before shift start
  const shiftStart = new Date(`${shift.shift_date}T${shift.start_time}`)
  const hoursUntil = (shiftStart.getTime() - Date.now()) / (1000 * 60 * 60)
  const isLateCancal = hoursUntil < 12

  const now = new Date().toISOString()

  // isFinal=true (calendar cancel): mark as 'canceled' permanently
  // isFinal=false (claims queue): reopen so the slot can be re-filled
  const newStatus = isFinal ? 'canceled' : 'open'

  const { data: updated, error: shiftError } = await admin
    .from('shifts')
    .update({
      status: newStatus,
      canceled_by: user.id,
      canceled_at: now,
      cancel_reason: reason ?? null,
      is_late_cancel: isLateCancal,
      updated_at: now,
    })
    .eq('id', shift_id)
    .select()
    .single()

  if (shiftError) {
    console.error('[shifts/cancel] shift update error:', shiftError)
    return NextResponse.json({ error: 'Failed to cancel shift' }, { status: 500 })
  }

  // Capture the confirmed nurse before withdrawing (for notification)
  const { data: confirmedClaim } = await admin
    .from('shift_claims')
    .select('nurse_profile_id')
    .eq('shift_id', shift_id)
    .eq('status', 'confirmed')
    .single()

  // Withdraw all active claims so nurses know the booking is cleared
  await admin
    .from('shift_claims')
    .update({ status: 'withdrawn' })
    .eq('shift_id', shift_id)
    .in('status', ['pending', 'confirmed'])

  // Notify the confirmed nurse if there was one (SMS + in-app)
  if (confirmedClaim?.nurse_profile_id) {
    try {
      const { data: nurseInfo } = await admin
        .from('nurse_profiles')
        .select('profile_id, phone')
        .eq('id', confirmedClaim.nurse_profile_id)
        .single()

      if (nurseInfo?.profile_id) {
        const msg = `Your confirmed ${shift.shift_date ? fmtDate(shift.shift_date) : 'upcoming'} shift has been canceled${isLateCancal ? ' (late cancellation)' : ''}.`
        await dispatchNotifications([
          ...(nurseInfo.phone ? [{ profile_id: nurseInfo.profile_id, recipient_phone: nurseInfo.phone, channel: 'sms' as const, event_type: 'shift_canceled', message: msg, payload: { shift_id } }] : []),
          { profile_id: nurseInfo.profile_id, channel: 'in_app' as const, event_type: 'shift_canceled', message: msg, payload: { shift_id } },
        ])
      }
    } catch (err) {
      console.error('[cancel notification]', err)
    }
  }

  return NextResponse.json({ shift: updated, is_late_cancel: isLateCancal })
}
