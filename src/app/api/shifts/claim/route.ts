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

  if (!user || user.app_metadata?.role !== 'nurse' && !isDemoUser(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { shift_id, agency_id } = body as { shift_id: string; agency_id: string }

  if (!shift_id || !agency_id) {
    return NextResponse.json({ error: 'shift_id and agency_id are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Get nurse profile
  const { data: nurseProfile } = await admin
    .from('nurse_profiles')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!nurseProfile) {
    return NextResponse.json({ error: 'Nurse profile not found' }, { status: 403 })
  }

  const nurseProfileId = nurseProfile.id

  // Verify nurse belongs to this agency and fetch agency's approval setting
  const [{ data: relationship }, { data: agencySettings }] = await Promise.all([
    admin
      .from('agency_nurse_relationships')
      .select('id')
      .eq('nurse_profile_id', nurseProfileId)
      .eq('agency_id', agency_id)
      .eq('status', 'active')
      .single(),
    admin
      .from('agencies')
      .select('require_claim_approval')
      .eq('id', agency_id)
      .single(),
  ])

  if (!relationship) {
    return NextResponse.json({ error: 'Not a member of this agency' }, { status: 403 })
  }

  const requireApproval = agencySettings?.require_claim_approval ?? false

  // Get the shift
  const { data: shift } = await admin
    .from('shifts')
    .select('id, status, facility_id, placeholder_facility_id, agency_id, shift_date, start_time, end_time, credential_required, is_placeholder')
    .eq('id', shift_id)
    .single()

  if (!shift) {
    return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  }

  if (!['open', 'claimed'].includes(shift.status)) {
    return NextResponse.json({ error: 'Shift is no longer available' }, { status: 409 })
  }

  // Double-booking check: look for any confirmed claims on the same date
  const { data: confirmedClaims } = await admin
    .from('shift_claims')
    .select('shift_id')
    .eq('nurse_profile_id', nurseProfileId)
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
        { error: 'Double booking: you already have a confirmed shift that overlaps this time.' },
        { status: 409 }
      )
    }
  }

  // Check for duplicate claim
  const { data: existingClaim } = await admin
    .from('shift_claims')
    .select('id, status')
    .eq('shift_id', shift_id)
    .eq('nurse_profile_id', nurseProfileId)
    .single()

  let isReactivation = false

  const claimStatus = requireApproval ? 'agency_review' : 'pending'

  if (existingClaim) {
    if (existingClaim.status === 'withdrawn') {
      // Re-activate withdrawn claim
      const { error } = await admin
        .from('shift_claims')
        .update({ status: claimStatus, claimed_at: new Date().toISOString() })
        .eq('id', existingClaim.id)

      if (error) return NextResponse.json({ error: 'Failed to re-submit claim' }, { status: 500 })
      isReactivation = true
    } else {
      return NextResponse.json({ error: 'Already claimed this shift' }, { status: 409 })
    }
  }

  // Insert the claim (only if not a reactivation)
  let claim = existingClaim
  if (!isReactivation) {
    const { data: inserted, error: claimError } = await admin
      .from('shift_claims')
      .insert({
        shift_id,
        nurse_profile_id: nurseProfileId,
        agency_id,
        status: claimStatus,
      })
      .select()
      .single()

    if (claimError) {
      console.error('[shifts/claim] insert error:', claimError)
      return NextResponse.json({ error: 'Failed to submit claim' }, { status: 500 })
    }
    claim = inserted
  }

  // Only transition shift to 'claimed' if agency approval is NOT required
  if (!requireApproval && shift.status === 'open') {
    await admin
      .from('shifts')
      .update({ status: 'claimed', updated_at: new Date().toISOString() })
      .eq('id', shift_id)
  }

  // Notify facility admin (in-app) or coordinator (email) depending on shift type
  // If agency_review is required, only notify agency admin — skip facility entirely
  try {
    const { data: nurseProf } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const nurseName = nurseProf?.full_name ?? 'A nurse'

    if (requireApproval) {
      // Notify agency admin to review the claim
      const { data: agencyAdminRow } = await admin
        .from('agency_admins')
        .select('profile_id')
        .eq('agency_id', agency_id)
        .single()

      if (agencyAdminRow?.profile_id) {
        await dispatchNotifications([{
          profile_id: agencyAdminRow.profile_id,
          channel: 'in_app',
          event_type: 'new_claim',
          message: `${nurseName} claimed a ${shift.credential_required} shift on ${fmtDate(shift.shift_date)} — awaiting your approval.`,
          payload: { shift_id, nurse_profile_id: nurseProfileId, claim_id: claim?.id },
        }])
      }
    } else if (shift.facility_id) {
      // Real facility — notify facility admin in-app
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
          payload: { shift_id, nurse_profile_id: nurseProfileId },
        }])
      }
    } else if (shift.is_placeholder && shift.placeholder_facility_id) {
      // Placeholder shift — send coordinator email if configured, plus notify agency admin
      const { data: placeholder } = await admin
        .from('placeholder_facilities')
        .select('name')
        .eq('id', shift.placeholder_facility_id)
        .single()

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
            event_type: 'shift_claimed',
            message: `${nurseName} has claimed a ${shift.credential_required} shift at ${placeholder?.name ?? 'a facility'} on ${fmtDate(shift.shift_date)}.`,
            payload: { shift_id, nurse_profile_id: nurseProfileId },
          }])
        }
      }

      // Send coordinator email with one-click confirm/decline links
      await sendCoordinatorConfirmEmail(admin, shift, nurseProfileId, nurseName)
    }
  } catch (err) {
    console.error('[claim notification]', err)
  }

  return NextResponse.json({ claim })
}
