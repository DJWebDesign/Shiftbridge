import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchNotifications } from '@/lib/notifications/dispatch'
import { sendEmail } from '@/lib/resend/client'
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
  const { placeholder_id, message } = body as { placeholder_id: string; message?: string }

  if (!placeholder_id) {
    return NextResponse.json({ error: 'placeholder_id is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify placeholder belongs to this agency and has a matched facility
  const { data: placeholder } = await admin
    .from('placeholder_facilities')
    .select('id, agency_id, name, matched_facility_id, connection_status')
    .eq('id', placeholder_id)
    .single()

  if (!placeholder || placeholder.agency_id !== agencyAdmin.agency_id) {
    return NextResponse.json({ error: 'Placeholder facility not found' }, { status: 404 })
  }

  if (!placeholder.matched_facility_id) {
    return NextResponse.json({ error: 'No matched facility — cannot send connection request' }, { status: 400 })
  }

  if (placeholder.connection_status === 'connected') {
    return NextResponse.json({ error: 'Already connected' }, { status: 409 })
  }

  if (placeholder.connection_status === 'request_pending') {
    return NextResponse.json({ error: 'Connection request already pending' }, { status: 409 })
  }

  // Check for existing pending request
  const { data: existing } = await admin
    .from('connection_requests')
    .select('id, status')
    .eq('agency_id', agencyAdmin.agency_id)
    .eq('facility_id', placeholder.matched_facility_id)
    .eq('placeholder_id', placeholder_id)
    .eq('status', 'pending')
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Connection request already pending' }, { status: 409 })
  }

  // Get agency info for notification
  const { data: agency } = await admin
    .from('agencies')
    .select('name, display_name')
    .eq('id', agencyAdmin.agency_id)
    .single()

  // Create connection request
  const { data: connRequest, error: reqError } = await admin
    .from('connection_requests')
    .insert({
      agency_id:    agencyAdmin.agency_id,
      facility_id:  placeholder.matched_facility_id,
      placeholder_id,
      status:       'pending',
      requested_by: user.id,
      message:      message ?? null,
    })
    .select()
    .single()

  if (reqError) {
    console.error('[placeholders/connect] error:', reqError)
    return NextResponse.json({ error: 'Failed to create connection request' }, { status: 500 })
  }

  // Mark placeholder as request_pending
  await admin
    .from('placeholder_facilities')
    .update({ connection_status: 'request_pending', updated_at: new Date().toISOString() })
    .eq('id', placeholder_id)

  // Get facility admin to notify
  const { data: facilityAdmin } = await admin
    .from('facility_admins')
    .select('profile_id, profiles(email, full_name)')
    .eq('facility_id', placeholder.matched_facility_id)
    .single()

  const facilityAdminProfile = facilityAdmin?.profiles as { email: string; full_name: string } | null

  // Notify facility admin in-app
  if (facilityAdmin?.profile_id) {
    await dispatchNotifications([{
      profile_id: facilityAdmin.profile_id,
      channel: 'in_app',
      event_type: 'connection_requested',
      message: `${agency?.display_name ?? agency?.name ?? 'An agency'} wants to connect with your facility via ShiftBridge.`,
      payload: { connection_request_id: connRequest.id, agency_id: agencyAdmin.agency_id },
    }])
  }

  // Email the facility admin
  if (facilityAdminProfile?.email) {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const { data: facility } = await admin
      .from('facilities')
      .select('name')
      .eq('id', placeholder.matched_facility_id)
      .single()

    await sendEmail({
      to: facilityAdminProfile.email,
      subject: `Connection Request from ${agency?.display_name ?? agency?.name ?? 'a staffing agency'} — ShiftBridge`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
          <h2 style="font-size:18px;color:#111827;margin-bottom:8px;">Connection Request</h2>
          <p style="color:#374151;margin-bottom:16px;">
            <strong>${agency?.display_name ?? agency?.name ?? 'A staffing agency'}</strong> has requested to connect with
            <strong>${facility?.name ?? 'your facility'}</strong> on ShiftBridge.
          </p>
          ${message ? `<p style="color:#374151;background:#f9fafb;padding:12px;border-radius:8px;margin-bottom:16px;">"${message}"</p>` : ''}
          <p style="color:#6b7280;font-size:14px;margin-bottom:20px;">
            Log in to review and accept or decline this request.
          </p>
          <a href="${baseUrl}/facility" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;">
            Review Request
          </a>
          <p style="color:#9ca3af;font-size:12px;margin-top:20px;">Powered by ShiftBridge.</p>
        </div>
      `,
    })
  }

  return NextResponse.json({ request: connRequest }, { status: 201 })
}
