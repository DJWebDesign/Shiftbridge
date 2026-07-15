import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchNotifications } from '@/lib/notifications/dispatch'

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { token, reopen = true } = body as { token: string; reopen?: boolean }

  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: tokenRow, error: tokenErr } = await admin
    .from('placeholder_confirm_tokens')
    .select('id, shift_id, email, used_at, expires_at')
    .eq('token', token)
    .single()

  if (tokenErr || !tokenRow) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  }

  if (tokenRow.used_at) {
    return NextResponse.json({ error: 'already_used' }, { status: 409 })
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Token has expired' }, { status: 410 })
  }

  const { data: shift } = await admin
    .from('shifts')
    .select('id, status, agency_id, placeholder_facility_id, credential_required, shift_date, start_time, end_time')
    .eq('id', tokenRow.shift_id)
    .single()

  if (!shift) {
    return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  }

  if (shift.status === 'canceled') {
    return NextResponse.json({ error: 'Shift has been canceled' }, { status: 409 })
  }

  const shiftDateFmt = fmtDate(shift.shift_date)

  const { data: placeholder } = shift.placeholder_facility_id
    ? await admin
        .from('placeholder_facilities')
        .select('name')
        .eq('id', shift.placeholder_facility_id)
        .single()
    : { data: null }

  const facilityName = placeholder?.name ?? 'a facility'

  // Mark token as used
  await admin
    .from('placeholder_confirm_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenRow.id)

  if (shift.status === 'confirmed') {
    // Coordinator is overriding an agency-confirmed shift — withdraw the confirmed claim
    const { data: confirmedClaim } = await admin
      .from('shift_claims')
      .select('id, nurse_profile_id')
      .eq('shift_id', tokenRow.shift_id)
      .eq('status', 'confirmed')
      .single()

    if (confirmedClaim) {
      await admin
        .from('shift_claims')
        .update({ status: 'withdrawn' })
        .eq('id', confirmedClaim.id)

      // Notify the nurse their confirmed shift was canceled
      const { data: nurseProfile } = await admin
        .from('nurse_profiles')
        .select('profile_id')
        .eq('id', confirmedClaim.nurse_profile_id)
        .single()

      if (nurseProfile?.profile_id) {
        await dispatchNotifications([{
          profile_id: nurseProfile.profile_id,
          channel: 'in_app',
          event_type: 'shift_canceled',
          message: `Your confirmed ${shift.credential_required} shift on ${shiftDateFmt} at ${facilityName} was canceled by the facility.`,
          payload: { shift_id: shift.id },
        }])
      }
    }

    // Reopen or permanently close the shift
    await admin
      .from('shifts')
      .update({ status: reopen ? 'open' : 'canceled', updated_at: new Date().toISOString() })
      .eq('id', tokenRow.shift_id)

    // Notify agency admin — coordinator overrode their confirmation
    if (shift.agency_id) {
      const { data: agencyAdminRow } = await admin
        .from('agency_admins')
        .select('profile_id')
        .eq('agency_id', shift.agency_id)
        .single()

      if (agencyAdminRow?.profile_id) {
        await dispatchNotifications([{
          profile_id: agencyAdminRow.profile_id,
          channel: 'in_app',
          event_type: 'shift_canceled',
          message: `Facility coordinator overrode the confirmed ${shift.credential_required} shift at ${facilityName} on ${shiftDateFmt} and declined it. ${reopen ? 'Shift is now open for reassignment.' : 'Shift has been closed.'}`,
          payload: { shift_id: shift.id },
        }])
      }
    }

    return NextResponse.json({ status: 'declined', shift })
  }

  // shift is 'claimed' or 'open' — reject pending claims
  const { data: claims } = await admin
    .from('shift_claims')
    .select('id, nurse_profile_id')
    .eq('shift_id', tokenRow.shift_id)
    .eq('status', 'pending')

  if (claims && claims.length > 0) {
    await admin
      .from('shift_claims')
      .update({ status: 'rejected' })
      .in('id', claims.map(c => c.id))
  }

  // Reopen or permanently close the shift
  await admin
    .from('shifts')
    .update({ status: reopen ? 'open' : 'canceled', updated_at: new Date().toISOString() })
    .eq('id', tokenRow.shift_id)

  // Notify each rejected nurse in-app
  if (claims && claims.length > 0) {
    for (const claim of claims) {
      const { data: nurseProfile } = await admin
        .from('nurse_profiles')
        .select('profile_id')
        .eq('id', claim.nurse_profile_id)
        .single()

      if (nurseProfile?.profile_id) {
        await dispatchNotifications([{
          profile_id: nurseProfile.profile_id,
          channel: 'in_app',
          event_type: 'shift_canceled',
          message: `Your ${shift.credential_required} shift on ${shiftDateFmt} at ${facilityName} was not confirmed by the facility.`,
          payload: { shift_id: shift.id },
        }])
      }
    }
  }

  // Notify agency admin in-app
  if (shift.agency_id) {
    const { data: agencyAdminRow } = await admin
      .from('agency_admins')
      .select('profile_id')
      .eq('agency_id', shift.agency_id)
      .single()

    if (agencyAdminRow?.profile_id) {
      await dispatchNotifications([{
        profile_id: agencyAdminRow.profile_id,
        channel: 'in_app',
        event_type: 'shift_canceled',
        message: `Coordinator declined the ${shift.credential_required} shift at ${facilityName} on ${shiftDateFmt}. ${reopen ? 'Shift is now open for reassignment.' : 'Shift has been closed — facility has coverage.'}`,
        payload: { shift_id: shift.id },
      }])
    }
  }

  return NextResponse.json({ status: 'declined', shift })
}
