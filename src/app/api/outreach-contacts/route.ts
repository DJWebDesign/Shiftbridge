import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function verifyFacilityOwnership(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, facilityId: string): Promise<boolean> {
  const { data } = await supabase
    .from('facility_admins')
    .select('facility_id')
    .eq('profile_id', userId)
    .single()
  return data?.facility_id === facilityId
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'facility_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const facilityId = request.nextUrl.searchParams.get('facilityId')
  if (!facilityId) {
    return NextResponse.json({ error: 'facilityId is required' }, { status: 400 })
  }

  if (!await verifyFacilityOwnership(supabase, user.id, facilityId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const admin = createAdminClient()
  const { data: contacts, error } = await admin
    .from('facility_outreach_contacts')
    .select('id, email, label, last_used_at, platform_outreach_sent_at')
    .eq('facility_id', facilityId)
    .order('last_used_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[outreach-contacts GET]', error)
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 })
  }

  return NextResponse.json({ contacts: contacts ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'facility_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { facilityId, email, label } = await request.json() as {
    facilityId: string
    email: string
    label?: string
  }

  if (!facilityId || !email) {
    return NextResponse.json({ error: 'facilityId and email are required' }, { status: 400 })
  }

  if (!await verifyFacilityOwnership(supabase, user.id, facilityId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data: contact, error } = await admin
    .from('facility_outreach_contacts')
    .upsert(
      {
        facility_id: facilityId,
        email: email.toLowerCase().trim(),
        ...(label ? { label } : {}),
        last_used_at: now,
      },
      { onConflict: 'facility_id,email', ignoreDuplicates: false }
    )
    .select()
    .single()

  if (error) {
    console.error('[outreach-contacts POST]', error)
    return NextResponse.json({ error: 'Failed to save contact' }, { status: 500 })
  }

  return NextResponse.json({ contact })
}
