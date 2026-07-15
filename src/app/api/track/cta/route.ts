import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_EVENTS = ['coordinator_confirm', 'coordinator_decline', 'outreach_email']

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const event = searchParams.get('event')
  const redirect = searchParams.get('redirect')
  const tid = searchParams.get('tid')   // token string (coordinator events)
  const fid = searchParams.get('fid')   // facilityId (outreach email events)

  // Always redirect — tracking failure must never block the user
  const safeRedirect = redirect ?? '/'

  if (!event || !ALLOWED_EVENTS.includes(event)) {
    return NextResponse.redirect(new URL(safeRedirect, request.url))
  }

  try {
    const admin = createAdminClient()

    let tokenId: string | null = null
    let facilityId: string | null = null

    if (tid) {
      const { data } = await admin
        .from('placeholder_confirm_tokens')
        .select('id')
        .eq('token', tid)
        .single()
      tokenId = data?.id ?? null
    }

    if (fid) {
      // Validate it's a real facility
      const { data } = await admin
        .from('facilities')
        .select('id')
        .eq('id', fid)
        .single()
      facilityId = data?.id ?? null
    }

    await admin.from('cta_events').insert({
      event_type: event,
      facility_id: facilityId,
      token_id: tokenId,
    })
  } catch (err) {
    // Silent — never block the redirect
    console.error('[track/cta]', err)
  }

  return NextResponse.redirect(new URL(safeRedirect, request.url))
}
