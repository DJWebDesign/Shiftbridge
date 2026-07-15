/**
 * Twilio SMS client — fetch-based, no npm package required.
 * Gracefully skips if credentials are not configured.
 * Add to .env.local:
 *   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *   TWILIO_AUTH_TOKEN=your_auth_token
 *   TWILIO_FROM_NUMBER=+1xxxxxxxxxx
 */

export async function sendSms(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER

  if (!sid || !token || !from) {
    console.warn('[twilio] SMS skipped — credentials not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER)')
    return false
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`
    const auth = Buffer.from(`${sid}:${token}`).toString('base64')

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: from, To: to, Body: body }).toString(),
    })

    if (!res.ok) {
      const data = await res.json()
      console.error('[twilio] SMS failed:', data?.message ?? res.statusText)
      return false
    }

    return true
  } catch (err) {
    console.error('[twilio] SMS error:', err)
    return false
  }
}
