import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const admin = createAdminClient()

  // Verify the contact belongs to this facility before deleting
  const { data: contact } = await admin
    .from('facility_outreach_contacts')
    .select('id, facility_id')
    .eq('id', id)
    .single()

  if (!contact || contact.facility_id !== facilityAdmin.facility_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await admin
    .from('facility_outreach_contacts')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[outreach-contacts DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
