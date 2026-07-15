import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/webhooks/twilio
 * Receives delivery status callbacks from Twilio.
 * Configure in Twilio console: Status Callback URL → https://yourapp.com/api/webhooks/twilio
 * Maps Twilio MessageStatus to notification status in DB.
 */

function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  // Build the validation string: URL + sorted key/value pairs
  const sortedStr = Object.keys(params)
    .sort()
    .reduce((str, key) => str + key + params[key], url)

  const expected = createHmac('sha1', authToken).update(sortedStr, 'utf8').digest('base64')
  return expected === signature
}

const TWILIO_TO_DB_STATUS: Record<string, string> = {
  delivered: 'sent',
  sent:      'sent',
  failed:    'failed',
  undelivered: 'failed',
}

export async function POST(request: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!authToken) {
    return NextResponse.json({ error: 'Twilio not configured' }, { status: 503 })
  }

  const signature = request.headers.get('x-twilio-signature') ?? ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const webhookUrl = `${appUrl}/api/webhooks/twilio`

  const formData = await request.formData()
  const params: Record<string, string> = {}
  formData.forEach((value, key) => { params[key] = value.toString() })

  if (!validateTwilioSignature(authToken, signature, webhookUrl, params)) {
    console.warn('[twilio webhook] Invalid signature')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const messageSid = params['MessageSid']
  const twilioStatus = params['MessageStatus']

  if (!messageSid || !twilioStatus) {
    return new NextResponse(null, { status: 204 })
  }

  const dbStatus = TWILIO_TO_DB_STATUS[twilioStatus]
  if (!dbStatus) {
    // Intermediate status (queued, sending) — nothing to update yet
    return new NextResponse(null, { status: 204 })
  }

  // Find the notification by Twilio SID stored in payload
  const admin = createAdminClient()
  await admin
    .from('notifications')
    .update({ status: dbStatus })
    .eq('channel', 'sms')
    .contains('payload', { twilio_sid: messageSid })

  return new NextResponse(null, { status: 204 })
}
