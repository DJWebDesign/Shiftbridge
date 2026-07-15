import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchNotifications, type NotificationItem } from '@/lib/notifications/dispatch'
import { isDemoUser } from '@/lib/demo/context'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (user.app_metadata?.role !== 'agency_admin' && !isDemoUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { agencyId, credentialType, message } = body as {
    agencyId: string
    credentialType: string | null  // null = all credentials
    message: string
  }

  if (!agencyId || !message?.trim()) {
    return NextResponse.json({ error: 'agencyId and message are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify requester belongs to this agency
  const { data: agencyAdmin } = await admin
    .from('agency_admins')
    .select('id')
    .eq('agency_id', agencyId)
    .eq('profile_id', user.id)
    .single()

  if (!agencyAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fetch active nurses for this agency with profile + credential info
  const { data: relationships } = await admin
    .from('agency_nurse_relationships')
    .select('nurse_profile_id, nurse_profiles(profile_id, credential_type, profiles(phone))')
    .eq('agency_id', agencyId)
    .eq('status', 'active')

  type NurseRel = {
    nurse_profile_id: string
    nurse_profiles: {
      profile_id: string
      credential_type: string
      profiles: { phone: string | null } | null
    } | null
  }

  const filtered = ((relationships ?? []) as unknown as NurseRel[]).filter(r => {
    if (!r.nurse_profiles) return false
    if (credentialType && r.nurse_profiles.credential_type !== credentialType) return false
    return true
  })

  // Build notification items — in-app + SMS for each nurse
  const items: NotificationItem[] = filtered.flatMap(r => {
    const phone = r.nurse_profiles?.profiles?.phone ?? null
    const profileId = r.nurse_profiles!.profile_id

    const notifs: NotificationItem[] = [
      {
        profile_id: profileId,
        channel: 'in_app',
        event_type: 'mass_text',
        message,
        payload: { agencyId, sentBy: user.id },
      },
    ]

    if (phone) {
      notifs.push({
        profile_id: profileId,
        recipient_phone: phone,
        channel: 'sms',
        event_type: 'mass_text',
        message,
        payload: { agencyId, sentBy: user.id },
      })
    }

    return notifs
  })

  if (items.length > 0) {
    await dispatchNotifications(items)
  }

  return NextResponse.json({
    totalTargeted: filtered.length,
    notificationsSent: items.length,
  })
}
