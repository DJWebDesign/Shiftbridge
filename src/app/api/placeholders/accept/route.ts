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
    // Facility can respond only when agency initiated
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
    // Agency can respond only when facility initiated
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

  // Call the accept_connection RPC
  const { data: result, error: rpcError } = await (admin as unknown as {
    rpc: (fn: string, args: Record<string, string>) => Promise<{
      data: Array<{
        r_agency_id:       string
        r_placeholder_id:  string
        r_facility_id:     string
        r_deleted_shifts:  number
        r_migrated_shifts: number
      }> | null
      error: unknown
    }>
  }).rpc('accept_connection', {
    p_request_id:   request_id,
    p_responded_by: user.id,
  })

  if (rpcError) {
    console.error('[placeholders/accept] RPC error:', rpcError)
    return NextResponse.json({ error: 'Failed to accept connection' }, { status: 500 })
  }

  const row = result?.[0]

  // Determine who to notify: the party that initiated (not the responder)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const [{ data: facilityRow }, { data: agencyRow }] = await Promise.all([
    admin.from('facilities').select('name').eq('id', connRequest.facility_id).single(),
    admin.from('agencies').select('name').eq('id', connRequest.agency_id).single(),
  ])

  const facilityName = facilityRow?.name ?? 'The facility'
  const agencyName   = agencyRow?.name   ?? 'The agency'

  if (connRequest.initiated_by_role === 'agency') {
    // Agency initiated → notify agency admin that facility accepted
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
        event_type: 'connection_accepted',
        message: `${facilityName} accepted your connection request. You are now connected.${row?.r_migrated_shifts ? ` ${row.r_migrated_shifts} confirmed shift${row.r_migrated_shifts !== 1 ? 's were' : ' was'} migrated.` : ''}`,
        payload: {
          facility_id:     connRequest.facility_id,
          placeholder_id:  row?.r_placeholder_id,
          deleted_shifts:  row?.r_deleted_shifts ?? 0,
          migrated_shifts: row?.r_migrated_shifts ?? 0,
        },
      }])
    }

    if (agencyAdminProfile?.email) {
      await sendEmail({
        to: agencyAdminProfile.email,
        subject: `Connection Accepted — ${facilityName} — ShiftBridge`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
            <h2 style="font-size:18px;color:#111827;margin-bottom:8px;">Connection Accepted</h2>
            <p style="color:#374151;margin-bottom:16px;">
              <strong>${facilityName}</strong> has accepted your connection request on ShiftBridge.
              You are now connected and can post shifts directly on their calendar.
            </p>
            ${row?.r_migrated_shifts ? `<p style="color:#374151;margin-bottom:16px;"><strong>${row.r_migrated_shifts}</strong> confirmed placeholder shift${row.r_migrated_shifts !== 1 ? 's were' : ' was'} automatically migrated to ${facilityName}'s live calendar.</p>` : ''}
            ${row?.r_deleted_shifts ? `<p style="color:#6b7280;font-size:14px;margin-bottom:16px;">${row.r_deleted_shifts} open placeholder shift${row.r_deleted_shifts !== 1 ? 's were' : ' was'} removed.</p>` : ''}
            <a href="${baseUrl}/agency" style="display:inline-block;background:#0D9488;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;">
              View Dashboard
            </a>
            <p style="color:#9ca3af;font-size:12px;margin-top:20px;">Powered by ShiftBridge.</p>
          </div>
        `,
      })
    }
  } else {
    // Facility initiated → notify facility admin that agency accepted
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
        event_type: 'connection_accepted',
        message: `${agencyName} accepted your connection request. You are now connected.`,
        payload: {
          agency_id:       connRequest.agency_id,
          placeholder_id:  row?.r_placeholder_id,
          migrated_shifts: row?.r_migrated_shifts ?? 0,
        },
      }])
    }

    if (facilityAdminProfile?.email) {
      await sendEmail({
        to: facilityAdminProfile.email,
        subject: `Connection Accepted — ${agencyName} — ShiftBridge`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
            <h2 style="font-size:18px;color:#111827;margin-bottom:8px;">Connection Accepted</h2>
            <p style="color:#374151;margin-bottom:16px;">
              <strong>${agencyName}</strong> has accepted your connection request on ShiftBridge.
              They can now post shifts directly on your facility calendar.
            </p>
            ${row?.r_migrated_shifts ? `<p style="color:#374151;margin-bottom:16px;"><strong>${row.r_migrated_shifts}</strong> confirmed placeholder shift${row.r_migrated_shifts !== 1 ? 's were' : ' was'} automatically migrated to your live calendar.</p>` : ''}
            <a href="${baseUrl}/facility" style="display:inline-block;background:#0D9488;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;">
              View Dashboard
            </a>
            <p style="color:#9ca3af;font-size:12px;margin-top:20px;">Powered by ShiftBridge.</p>
          </div>
        `,
      })
    }
  }

  return NextResponse.json({
    status: 'accepted',
    deleted_shifts:  row?.r_deleted_shifts  ?? 0,
    migrated_shifts: row?.r_migrated_shifts ?? 0,
  })
}
