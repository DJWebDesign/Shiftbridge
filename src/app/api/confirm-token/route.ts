import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchNotifications } from '@/lib/notifications/dispatch'

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { token } = body as { token: string }

  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Look up the token
  const { data: tokenRow, error: tokenErr } = await admin
    .from('placeholder_confirm_tokens')
    .select('id, shift_id, email, used_at, expires_at')
    .eq('token', token)
    .single()

  if (tokenErr || !tokenRow) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  }

  // Already used?
  if (tokenRow.used_at) {
    return NextResponse.json({ error: 'already_used' }, { status: 409 })
  }

  // Expired?
  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Token has expired' }, { status: 410 })
  }

  // Get the shift
  const { data: shift } = await admin
    .from('shifts')
    .select('id, status, agency_id, placeholder_facility_id, credential_required, shift_date, start_time, end_time')
    .eq('id', tokenRow.shift_id)
    .single()

  if (!shift) {
    return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  }

  if (shift.status === 'confirmed') {
    // Idempotent — already confirmed
    await admin
      .from('placeholder_confirm_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenRow.id)
    return NextResponse.json({ status: 'already_confirmed', shift })
  }

  if (shift.status === 'canceled') {
    return NextResponse.json({ error: 'Shift has been canceled' }, { status: 409 })
  }

  // Find the pending claim for this shift (most recent pending or claimed)
  const { data: claims } = await admin
    .from('shift_claims')
    .select('id, nurse_profile_id, agency_id')
    .eq('shift_id', tokenRow.shift_id)
    .eq('status', 'pending')
    .order('claimed_at')

  const winningClaim = claims?.[0]

  // Mark token as used
  await admin
    .from('placeholder_confirm_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenRow.id)

  if (winningClaim) {
    // Confirm the winning claim
    await admin
      .from('shift_claims')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('id', winningClaim.id)

    // Reject other pending claims
    if (claims && claims.length > 1) {
      const otherIds = claims.slice(1).map(c => c.id)
      await admin
        .from('shift_claims')
        .update({ status: 'rejected' })
        .in('id', otherIds)
    }
  }

  // Update shift status to confirmed
  await admin
    .from('shifts')
    .update({ status: 'confirmed', updated_at: new Date().toISOString() })
    .eq('id', tokenRow.shift_id)

  // Notify nurse (in-app) if there's a confirmed claim
  if (winningClaim) {
    const { data: nurseProfile } = await admin
      .from('nurse_profiles')
      .select('profile_id')
      .eq('id', winningClaim.nurse_profile_id)
      .single()

    if (nurseProfile?.profile_id) {
      await dispatchNotifications([{
        profile_id: nurseProfile.profile_id,
        channel: 'in_app',
        event_type: 'shift_confirmed',
        message: `Your ${shift.credential_required} shift on ${fmtDate(shift.shift_date)} has been confirmed.`,
        payload: { shift_id: shift.id },
      }])
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
      const { data: placeholder } = shift.placeholder_facility_id
        ? await admin
            .from('placeholder_facilities')
            .select('name')
            .eq('id', shift.placeholder_facility_id)
            .single()
        : { data: null }

      await dispatchNotifications([{
        profile_id: agencyAdminRow.profile_id,
        channel: 'in_app',
        event_type: 'shift_confirmed',
        message: `Coordinator confirmed the ${shift.credential_required} shift at ${placeholder?.name ?? 'a facility'} on ${fmtDate(shift.shift_date)}.`,
        payload: { shift_id: shift.id },
      }])
    }
  }

  return NextResponse.json({ status: 'confirmed', shift })
}
