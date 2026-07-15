import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchNotifications } from '@/lib/notifications/dispatch'
import { isDemoUser } from '@/lib/demo/context'

export async function DELETE(request: NextRequest) {
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

  const { nurse_profile_id } = await request.json() as { nurse_profile_id: string }

  if (!nurse_profile_id) {
    return NextResponse.json({ error: 'nurse_profile_id is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { error } = await admin
    .from('dnr_records')
    .delete()
    .eq('facility_id', facilityAdmin.facility_id)
    .eq('nurse_profile_id', nurse_profile_id)

  if (error) {
    console.error('[dnr] delete error:', error)
    return NextResponse.json({ error: 'Failed to remove DNR record' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
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

  const { nurse_profile_id, agency_id } = await request.json() as {
    nurse_profile_id: string
    agency_id: string
  }

  if (!nurse_profile_id || !agency_id) {
    return NextResponse.json({ error: 'nurse_profile_id and agency_id are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify the nurse has at least one confirmed claim at this facility
  const { data: confirmedClaim } = await admin
    .from('shift_claims')
    .select('id, shifts!inner(facility_id)')
    .eq('nurse_profile_id', nurse_profile_id)
    .eq('status', 'confirmed')
    .eq('shifts.facility_id', facilityAdmin.facility_id)
    .limit(1)
    .single()

  if (!confirmedClaim) {
    return NextResponse.json(
      { error: 'DNR can only be issued for nurses who have worked a confirmed shift at this facility' },
      { status: 403 }
    )
  }

  // Insert DNR record (UNIQUE constraint prevents duplicates)
  const { data: dnr, error } = await admin
    .from('dnr_records')
    .insert({
      facility_id: facilityAdmin.facility_id,
      nurse_profile_id,
      agency_id,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      // Unique violation — already on DNR
      return NextResponse.json({ error: 'Nurse is already on the DNR list for this facility' }, { status: 409 })
    }
    console.error('[dnr] insert error:', error)
    return NextResponse.json({ error: 'Failed to add DNR record' }, { status: 500 })
  }

  // Cancel any future confirmed/pending shifts for this nurse at this facility
  const today = new Date().toISOString().split('T')[0]
  let canceledShiftCount = 0

  try {
    // Step 1: get all active claims for this nurse (two-query pattern — avoid unreliable join filters)
    const { data: activeClaims } = await admin
      .from('shift_claims')
      .select('id, shift_id, status')
      .eq('nurse_profile_id', nurse_profile_id)
      .in('status', ['confirmed', 'pending'])

    if (activeClaims && activeClaims.length > 0) {
      const claimShiftIds = activeClaims.map(c => c.shift_id)

      // Step 2: get shifts that are at this facility AND in the future
      const { data: futureShifts } = await admin
        .from('shifts')
        .select('id, shift_date, start_time, end_time, credential_required')
        .in('id', claimShiftIds)
        .eq('facility_id', facilityAdmin.facility_id)
        .gte('shift_date', today)

      if (futureShifts && futureShifts.length > 0) {
        const futureShiftIds = new Set(futureShifts.map(s => s.id))
        const affectedClaims = activeClaims.filter(c => futureShiftIds.has(c.shift_id))
        const confirmedClaims = affectedClaims.filter(c => c.status === 'confirmed')

        // Withdraw all affected claims
        if (affectedClaims.length > 0) {
          await admin
            .from('shift_claims')
            .update({ status: 'withdrawn' })
            .in('id', affectedClaims.map(c => c.id))
        }

        // Reopen confirmed shifts so the facility can fill them
        if (confirmedClaims.length > 0) {
          const confirmedShiftIds = confirmedClaims.map(c => c.shift_id)
          await admin
            .from('shifts')
            .update({ status: 'open', updated_at: new Date().toISOString() })
            .in('id', confirmedShiftIds)

          canceledShiftCount = confirmedShiftIds.length

          // Notify the nurse about each canceled shift
          const { data: nurseProfile } = await admin
            .from('nurse_profiles')
            .select('profile_id')
            .eq('id', nurse_profile_id)
            .single()

          if (nurseProfile?.profile_id) {
            const { data: facilityRow } = await admin
              .from('facilities')
              .select('name')
              .eq('id', facilityAdmin.facility_id)
              .single()
            const facilityName = (facilityRow as { name: string } | null)?.name ?? 'a facility'

            const notifications = confirmedClaims.map(c => {
              const shift = futureShifts.find(s => s.id === c.shift_id)!
              const [y, m, d] = shift.shift_date.split('-').map(Number)
              const dateFmt = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
              return {
                profile_id: nurseProfile.profile_id,
                channel: 'in_app' as const,
                event_type: 'shift_canceled',
                message: `Your ${shift.credential_required} shift at ${facilityName} on ${dateFmt} has been canceled.`,
                payload: { shift_id: shift.id, facility_id: facilityAdmin.facility_id },
              }
            })
            await dispatchNotifications(notifications)
          }
        }
      }
    }
  } catch (err) {
    console.error('[dnr] future shift cancellation error:', err)
  }

  // Notify agency admin (in-app)
  try {
    const [{ data: agencyAdmin }, { data: facility }, { data: nurseProf }] = await Promise.all([
      admin.from('agency_admins').select('profile_id').eq('agency_id', agency_id).single(),
      admin.from('facilities').select('name').eq('id', facilityAdmin.facility_id).single(),
      admin.from('nurse_profiles').select('profile_id, profiles(full_name)').eq('id', nurse_profile_id).single(),
    ])
    if (agencyAdmin?.profile_id) {
      const nurseName = (nurseProf?.profiles as { full_name: string } | null)?.full_name ?? 'A nurse'
      const facilityName = (facility as { name: string } | null)?.name ?? 'a facility'
      const shiftNote = canceledShiftCount > 0
        ? ` ${canceledShiftCount} upcoming confirmed shift${canceledShiftCount !== 1 ? 's have' : ' has'} been reopened.`
        : ''
      await dispatchNotifications([{
        profile_id: agencyAdmin.profile_id,
        channel: 'in_app',
        event_type: 'dnr_issued',
        message: `${nurseName} has been placed on the DNR list at ${facilityName}.${shiftNote}`,
        payload: { nurse_profile_id, facility_id: facilityAdmin.facility_id, canceled_shifts: canceledShiftCount },
      }])
    }
  } catch (err) {
    console.error('[dnr notification]', err)
  }

  return NextResponse.json({ dnr, canceled_shifts: canceledShiftCount })
}
