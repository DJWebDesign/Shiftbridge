import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchNotifications } from '@/lib/notifications/dispatch'
import { sendCoordinatorConfirmEmail } from '@/lib/notifications/coordinator-email'
import { isDemoUser } from '@/lib/demo/context'

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function timesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return s1 < e2 && s2 < e1
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

  const body = await request.json()
  const { claim_id } = body

  if (!claim_id) {
    return NextResponse.json({ error: 'claim_id is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch claim and verify it belongs to this agency and is in agency_review
  const { data: claim } = await admin
    .from('shift_claims')
    .select('id, shift_id, nurse_profile_id, agency_id, status')
    .eq('id', claim_id)
    .single()

  if (!claim) {
    return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
  }

  if (claim.agency_id !== agencyAdmin.agency_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (claim.status !== 'agency_review') {
    return NextResponse.json({ error: 'Claim is not awaiting agency review' }, { status: 409 })
  }

  // Fetch the shift to re-run double-booking check
  const { data: shift } = await admin
    .from('shifts')
    .select('id, status, facility_id, placeholder_facility_id, agency_id, shift_date, start_time, end_time, credential_required, is_placeholder')
    .eq('id', claim.shift_id)
    .single()

  if (!shift || !['open', 'claimed'].includes(shift.status)) {
    return NextResponse.json({ error: 'Shift is no longer available' }, { status: 409 })
  }

  // Re-run double-booking check (nurse may have confirmed another shift since claiming)
  const { data: confirmedClaims } = await admin
    .from('shift_claims')
    .select('shift_id')
    .eq('nurse_profile_id', claim.nurse_profile_id)
    .eq('status', 'confirmed')

  if (confirmedClaims && confirmedClaims.length > 0) {
    const confirmedShiftIds = confirmedClaims.map(c => c.shift_id)
    const { data: confirmedShifts } = await admin
      .from('shifts')
      .select('id, shift_date, start_time, end_time')
      .in('id', confirmedShiftIds)
      .eq('shift_date', shift.shift_date)

    const hasOverlap = (confirmedShifts ?? []).some(s =>
      timesOverlap(shift.start_time, shift.end_time, s.start_time, s.end_time)
    )

    if (hasOverlap) {
      return NextResponse.json(
        { error: 'Double booking: this nurse already has a confirmed shift that overlaps this time.' },
        { status: 409 }
      )
    }
  }

  // Approve: update claim to 'pending', transition shift to 'claimed'
  const { error: claimError } = await admin
    .from('shift_claims')
    .update({
      status: 'pending',
      agency_approved_at: new Date().toISOString(),
      agency_approved_by: user.id,
    })
    .eq('id', claim_id)

  if (claimError) {
    console.error('[agency-approve] update claim error:', claimError)
    return NextResponse.json({ error: 'Failed to approve claim' }, { status: 500 })
  }

  if (shift.status === 'open') {
    await admin
      .from('shifts')
      .update({ status: 'claimed', updated_at: new Date().toISOString() })
      .eq('id', claim.shift_id)
  }

  // Notify facility admin about the claim
  try {
    const { data: nurseProfileRow } = await admin
      .from('nurse_profiles')
      .select('profile_id')
      .eq('id', claim.nurse_profile_id)
      .single()

    const { data: nurseProfile } = nurseProfileRow?.profile_id
      ? await admin.from('profiles').select('full_name').eq('id', nurseProfileRow.profile_id).single()
      : { data: null }

    const nurseName = nurseProfile?.full_name ?? 'A nurse'

    if (shift.facility_id) {
      const { data: facAdmin } = await admin
        .from('facility_admins')
        .select('profile_id')
        .eq('facility_id', shift.facility_id)
        .single()

      if (facAdmin?.profile_id) {
        await dispatchNotifications([{
          profile_id: facAdmin.profile_id,
          channel: 'in_app',
          event_type: 'shift_claimed',
          message: `${nurseName} has claimed your ${shift.credential_required} shift on ${fmtDate(shift.shift_date)}.`,
          payload: { shift_id: claim.shift_id, nurse_profile_id: claim.nurse_profile_id },
        }])
      }
    } else if (shift.is_placeholder && shift.placeholder_facility_id) {
      // Placeholder shift — the coordinator email was skipped at claim time
      // because the claim went to agency review; send it now that the agency
      // has approved.
      await sendCoordinatorConfirmEmail(admin, shift, claim.nurse_profile_id, nurseName)
    }
  } catch (err) {
    console.error('[agency-approve] notification error:', err)
  }

  return NextResponse.json({ ok: true })
}
