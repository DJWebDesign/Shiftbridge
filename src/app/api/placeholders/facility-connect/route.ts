import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchNotifications } from '@/lib/notifications/dispatch'
import { sendEmail } from '@/lib/resend/client'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'facility_admin') {
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

  const body = await request.json()
  const { placeholder_id, message } = body as { placeholder_id: string; message?: string }

  if (!placeholder_id) {
    return NextResponse.json({ error: 'placeholder_id is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify the placeholder matches this facility
  const { data: placeholder } = await admin
    .from('placeholder_facilities')
    .select('id, agency_id, name, matched_facility_id, connection_status')
    .eq('id', placeholder_id)
    .eq('matched_facility_id', facilityAdmin.facility_id)
    .single()

  if (!placeholder) {
    return NextResponse.json({ error: 'Placeholder facility not found or does not match your facility' }, { status: 404 })
  }

  if (placeholder.connection_status === 'connected') {
    return NextResponse.json({ error: 'Already connected' }, { status: 409 })
  }

  if (placeholder.connection_status === 'request_pending') {
    return NextResponse.json({ error: 'A connection request is already pending' }, { status: 409 })
  }

  // Check for an existing pending request between these two
  const { data: existing } = await admin
    .from('connection_requests')
    .select('id')
    .eq('agency_id', placeholder.agency_id)
    .eq('facility_id', facilityAdmin.facility_id)
    .eq('placeholder_id', placeholder_id)
    .eq('status', 'pending')
    .single()

  if (existing) {
    return NextResponse.json({ error: 'A connection request is already pending' }, { status: 409 })
  }

  // Get names for notifications
  const [{ data: facility }, { data: agency }] = await Promise.all([
    admin.from('facilities').select('name').eq('id', facilityAdmin.facility_id).single(),
    admin.from('agencies').select('name').eq('id', placeholder.agency_id).single(),
  ])

  // Create connection request — facility is initiating
  const { data: connRequest, error: reqError } = await admin
    .from('connection_requests')
    .insert({
      agency_id:          placeholder.agency_id,
      facility_id:        facilityAdmin.facility_id,
      placeholder_id,
      status:             'pending',
      requested_by:       user.id,
      initiated_by_role:  'facility',
      message:            message ?? null,
    })
    .select()
    .single()

  if (reqError) {
    console.error('[placeholders/facility-connect] error:', reqError)
    return NextResponse.json({ error: 'Failed to create connection request' }, { status: 500 })
  }

  // Mark placeholder as request_pending
  await admin
    .from('placeholder_facilities')
    .update({ connection_status: 'request_pending', updated_at: new Date().toISOString() })
    .eq('id', placeholder_id)

  // Notify agency admin in-app + email
  const { data: agencyAdminRow } = await admin
    .from('agency_admins')
    .select('profile_id, profiles(email, full_name)')
    .eq('agency_id', placeholder.agency_id)
    .single()

  const agencyAdminProfile = agencyAdminRow?.profiles as { email: string; full_name: string } | null

  if (agencyAdminRow?.profile_id) {
    await dispatchNotifications([{
      profile_id: agencyAdminRow.profile_id,
      channel: 'in_app',
      event_type: 'connection_requested',
      message: `${facility?.name ?? 'A facility'} wants to connect with your placeholder "${placeholder.name}" on ShiftBridge.`,
      payload: { connection_request_id: connRequest.id, facility_id: facilityAdmin.facility_id },
    }])
  }

  if (agencyAdminProfile?.email) {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    await sendEmail({
      to: agencyAdminProfile.email,
      subject: `Connection Request from ${facility?.name ?? 'a facility'} — ShiftBridge`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
          <h2 style="font-size:18px;color:#111827;margin-bottom:8px;">Connection Request</h2>
          <p style="color:#374151;margin-bottom:16px;">
            <strong>${facility?.name ?? 'A facility'}</strong> has requested to connect
            with your placeholder <strong>${placeholder.name}</strong> on ShiftBridge.
          </p>
          ${message ? `<p style="color:#374151;background:#f9fafb;padding:12px;border-radius:8px;margin-bottom:16px;">"${message}"</p>` : ''}
          <p style="color:#6b7280;font-size:14px;margin-bottom:20px;">
            Log in to review the calendar comparison and accept or decline this request.
          </p>
          <a href="${baseUrl}/agency" style="display:inline-block;background:#0D9488;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;">
            Review Request
          </a>
          <p style="color:#9ca3af;font-size:12px;margin-top:20px;">Powered by ShiftBridge.</p>
        </div>
      `,
    })
  }

  return NextResponse.json({ request: connRequest }, { status: 201 })
}
