/**
 * Resend email client — fetch-based, no npm package required.
 * Gracefully skips if credentials are not configured.
 * Add to .env.local:
 *   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *   RESEND_FROM_ADDRESS=ShiftBridge <notifications@yourdomain.com>
 */

interface EmailParams {
  to: string
  subject: string
  html: string
  replyTo?: string
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_ADDRESS

  if (!apiKey || !from) {
    console.warn('[resend] Email skipped — credentials not configured (RESEND_API_KEY / RESEND_FROM_ADDRESS)')
    return false
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: process.env.RESEND_DEV_OVERRIDE_EMAIL ?? params.to,
        subject: params.subject,
        html: params.html,
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
      }),
    })

    if (!res.ok) {
      console.error('[resend] Email failed:', await res.text())
      return false
    }

    return true
  } catch (err) {
    console.error('[resend] Email error:', err)
    return false
  }
}
