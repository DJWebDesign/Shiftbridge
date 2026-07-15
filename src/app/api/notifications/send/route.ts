import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { dispatchNotifications, type NotificationItem } from '@/lib/notifications/dispatch'

/**
 * POST /api/notifications/send
 * Internal endpoint for triggering notifications from server-side jobs or
 * other contexts that can't call dispatchNotifications directly.
 * Requires super_admin or service-role caller.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { notifications } = body as { notifications: NotificationItem[] }

  if (!Array.isArray(notifications) || notifications.length === 0) {
    return NextResponse.json({ error: 'notifications array is required' }, { status: 400 })
  }

  await dispatchNotifications(notifications)

  return NextResponse.json({ ok: true, count: notifications.length })
}
