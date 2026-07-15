import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchNotifications } from '@/lib/notifications/dispatch'
import { isDemoUser } from '@/lib/demo/context'

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

  const { error } = await admin
    .from('shift_claims')
    .update({ status: 'rejected' })
    .eq('id', claim_id)

  if (error) {
    console.error('[agency-reject] error:', error)
    return NextResponse.json({ error: 'Failed to reject claim' }, { status: 500 })
  }

  // Notify nurse in-app
  try {
    const { data: nurseProfileRow } = await admin
      .from('nurse_profiles')
      .select('profile_id')
      .eq('id', claim.nurse_profile_id)
      .single()

    const { data: shift } = await admin
      .from('shifts')
      .select('shift_date, credential_required, start_time')
      .eq('id', claim.shift_id)
      .single()

    if (nurseProfileRow?.profile_id && shift) {
      const [y, m, day] = shift.shift_date.split('-').map(Number)
      const dateFmt = new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      await dispatchNotifications([{
        profile_id: nurseProfileRow.profile_id,
        channel: 'in_app',
        event_type: 'shift_canceled',
        message: `Your claim for the ${shift.credential_required} shift on ${dateFmt} was not approved by your agency.`,
        payload: { shift_id: claim.shift_id },
      }])
    }
  } catch (err) {
    console.error('[agency-reject] notification error:', err)
  }

  return NextResponse.json({ ok: true })
}
