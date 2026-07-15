import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchNotifications } from '@/lib/notifications/dispatch'
import { sendEmail } from '@/lib/resend/client'
import { isDemoUser } from '@/lib/demo/context'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = user.app_metadata?.role
  if (role !== 'facility_admin' && role !== 'agency_admin' && !isDemoUser(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { request_id } = body as { request_id: string }

  if (!request_id) {
    return NextResponse.json({ error: 'request_id is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: connRequest } = await admin
    .from('connection_requests')
    .select('id, agency_id, facility_id, placeholder_id, status, initiated_by_role')
    .eq('id', request_id)
    .single()

  if (!connRequest) {
    return NextResponse.json({ error: 'Connection request not found' }, { status: 404 })
  }

  // Verify caller is the responding party (non-initiator)
  if (role === 'facility_admin') {
    const { data: fa } = await supabase
      .from('facility_admins')
      .select('facility_id')
      .eq('profile_id', user.id)
      .single()
    if (!fa || fa.facility_id !== connRequest.facility_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (connRequest.initiated_by_role === 'facility') {
      return NextResponse.json({ error: 'Forbidden — you initiated this request' }, { status: 403 })
    }
  } else {
    const { data: aa } = await supabase
      .from('agency_admins')
      .select('agency_id')
      .eq('profile_id', user.id)
      .single()
    if (!aa || aa.agency_id !== connRequest.agency_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (connRequest.initiated_by_role === 'agency') {
      return NextResponse.json({ error: 'Forbidden — you initiated this request' }, { status: 403 })
    }
  }

  if (connRequest.status !== 'pending') {
    return NextResponse.json({ error: `Request is already ${connRequest.status}` }, { status: 409 })
  }

  // Mark request declined
  await admin
    .from('connection_requests')
    .update({
      status:       'declined',
      responded_by: user.id,
      responded_at: new Date().toISOString(),
    })
    .eq('id', request_id)

  // Mark placeholder as declined (agency can resend a new request)
  await admin
    .from('placeholder_facilities')
    .update({ connection_status: 'declined', updated_at: new Date().toISOString() })
    .eq('id', connRequest.placeholder_id)

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const [{ data: facilityRow }, { data: agencyRow }] = await Promise.all([
    admin.from('facilities').select('name').eq('id', connRequest.facility_id).single(),
    admin.from('agencies').select('name').eq('id', connRequest.agency_id).single(),
  ])

  const facilityName = facilityRow?.name ?? 'The facility'
  const agencyName   = agencyRow?.name   ?? 'The agency'

  if (connRequest.initiated_by_role === 'agency') {
    // Agency initiated → notify agency admin of decline
    const { data: agencyAdminRow } = await admin
      .from('agency_admins')
      .select('profile_id, profiles(email, full_name)')
      .eq('agency_id', connRequest.agency_id)
      .single()

    const agencyAdminProfile = agencyAdminRow?.profiles as { email: string; full_name: string } | null

    if (agencyAdminRow?.profile_id) {
      await dispatchNotifications([{
        profile_id: agencyAdminRow.profile_id,
        channel: 'in_app',
        event_type: 'connection_declined',
        message: `${facilityName} declined your connection request. You can send a new request if this was a mistake.`,
        payload: { facility_id: connRequest.facility_id, placeholder_id: connRequest.placeholder_id },
      }])
    }

    if (agencyAdminProfile?.email) {
      await sendEmail({
        to: agencyAdminProfile.email,
        subject: `Connection Declined — ${facilityName} — ShiftBridge`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
            <h2 style="font-size:18px;color:#111827;margin-bottom:8px;">Connection Declined</h2>
            <p style="color:#374151;margin-bottom:16px;">
              <strong>${facilityName}</strong> has declined your connection request on ShiftBridge.
              Your placeholder facility is still active — you can send a new request in the future.
            </p>
            <a href="${baseUrl}/agency" style="display:inline-block;background:#0D9488;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;">
              View Facilities
            </a>
            <p style="color:#9ca3af;font-size:12px;margin-top:20px;">Powered by ShiftBridge.</p>
          </div>
        `,
      })
    }
  } else {
    // Facility initiated → notify facility admin of decline
    const { data: facilityAdminRow } = await admin
      .from('facility_admins')
      .select('profile_id, profiles(email, full_name)')
      .eq('facility_id', connRequest.facility_id)
      .single()

    const facilityAdminProfile = facilityAdminRow?.profiles as { email: string; full_name: string } | null

    if (facilityAdminRow?.profile_id) {
      await dispatchNotifications([{
        profile_id: facilityAdminRow.profile_id,
        channel: 'in_app',
        event_type: 'connection_declined',
        message: `${agencyName} declined your connection request. You can send a new request in the future.`,
        payload: { agency_id: connRequest.agency_id, placeholder_id: connRequest.placeholder_id },
      }])
    }

    if (facilityAdminProfile?.email) {
      await sendEmail({
        to: facilityAdminProfile.email,
        subject: `Connection Declined — ${agencyName} — ShiftBridge`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
            <h2 style="font-size:18px;color:#111827;margin-bottom:8px;">Connection Declined</h2>
            <p style="color:#374151;margin-bottom:16px;">
              <strong>${agencyName}</strong> has declined your connection request on ShiftBridge.
              You can send a new request in the future.
            </p>
            <a href="${baseUrl}/facility" style="display:inline-block;background:#0D9488;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;">
              View Dashboard
            </a>
            <p style="color:#9ca3af;font-size:12px;margin-top:20px;">Powered by ShiftBridge.</p>
          </div>
        `,
      })
    }
  }

  return NextResponse.json({ status: 'declined' })
}
