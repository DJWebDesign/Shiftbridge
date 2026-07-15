/**
 * Core notification dispatcher — call from API routes only.
 * Always writes to the notifications table (in-app works immediately).
 * SMS and email are sent only when their credentials are configured.
 * Never throws — log errors and continue so mutations always succeed.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms } from '@/lib/twilio/client'
import { sendEmail } from '@/lib/resend/client'

export type NotificationChannel = 'in_app' | 'sms' | 'email'

export interface NotificationItem {
  profile_id?: string          // auth user id — required for in_app
  recipient_phone?: string     // E.164 format — required for sms
  recipient_email?: string     // required for email
  channel: NotificationChannel
  event_type: string
  message: string
  payload?: Record<string, unknown>
  // For email only
  email_subject?: string
  email_html?: string
}

async function checkPreferences(
  admin: ReturnType<typeof createAdminClient>,
  profileIds: string[],
  eventType: string,
): Promise<Map<string, Set<string>>> {
  const unique = [...new Set(profileIds.filter(Boolean))]
  if (unique.length === 0) return new Map()

  const { data } = await admin
    .from('notification_preferences')
    .select('profile_id, preferences')
    .in('profile_id', unique)

  const result = new Map<string, Set<string>>()
  for (const row of data ?? []) {
    const prefs = row.preferences as Record<string, Record<string, boolean>> | null
    if (!prefs) continue
    const eventPrefs = prefs[eventType]
    if (!eventPrefs) continue
    const optedOut = new Set(Object.entries(eventPrefs).filter(([, v]) => v === false).map(([k]) => k))
    if (optedOut.size > 0 && row.profile_id) result.set(row.profile_id, optedOut)
  }
  return result
}

export async function dispatchNotifications(items: NotificationItem[]): Promise<void> {
  if (items.length === 0) return
  const admin = createAdminClient()

  // Check notification preferences and filter out opted-out channels
  const profileIds = items.map(i => i.profile_id ?? '').filter(Boolean)
  if (profileIds.length > 0) {
    // Group items by event_type for efficient lookup
    const eventTypes = [...new Set(items.map(i => i.event_type))]
    const optOutMaps = new Map<string, Map<string, Set<string>>>()
    await Promise.all(eventTypes.map(async evt => {
      const evtProfileIds = items.filter(i => i.event_type === evt && i.profile_id).map(i => i.profile_id!)
      optOutMaps.set(evt, await checkPreferences(admin, evtProfileIds, evt))
    }))
    items = items.filter(item => {
      if (!item.profile_id) return true
      const optedOut = optOutMaps.get(item.event_type)?.get(item.profile_id)
      return !optedOut?.has(item.channel)
    })
    if (items.length === 0) return
  }

  // Insert all as pending — this always runs regardless of external service availability
  const rows = items.map(item => ({
    profile_id: item.profile_id ?? null,
    recipient_phone: item.recipient_phone ?? null,
    recipient_email: item.recipient_email ?? null,
    channel: item.channel,
    event_type: item.event_type,
    message: item.message,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: (item.payload ?? {}) as any,
    status: 'pending',
  }))

  const { data: inserted, error: insertError } = await admin
    .from('notifications')
    .insert(rows)
    .select('id, channel, recipient_phone, recipient_email')

  if (insertError) {
    console.error('[notifications] insert error:', insertError)
    return
  }

  // Send external notifications and update status
  const updates: Array<Promise<void>> = (inserted ?? []).map(async (row, idx) => {
    const item = items[idx]
    let sent = false

    try {
      if (row.channel === 'sms' && row.recipient_phone) {
        sent = await sendSms(row.recipient_phone, item.message)
      } else if (row.channel === 'email' && row.recipient_email) {
        sent = await sendEmail({
          to: row.recipient_email,
          subject: item.email_subject ?? 'ShiftBridge Notification',
          html: item.email_html ?? `<p>${item.message}</p>`,
        })
      } else if (row.channel === 'in_app') {
        // In-app: already in DB, no external send needed
        sent = true
      }
    } catch (err) {
      console.error(`[notifications] send error (${row.channel}):`, err)
    }

    await admin
      .from('notifications')
      .update({
        status: sent ? 'sent' : 'failed',
        sent_at: sent ? new Date().toISOString() : null,
      })
      .eq('id', row.id)
  })

  await Promise.allSettled(updates)
}
