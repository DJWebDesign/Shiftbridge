import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/resend/client'

const CREDENTIAL_ORDER = ['CNA', 'CMA', 'LPN', 'LPN_IV', 'RN']
const CREDENTIAL_LABELS: Record<string, string> = {
  CNA: 'CNA', CMA: 'CMA', LPN: 'LPN', LPN_IV: 'LPN + IV', RN: 'RN',
}
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function fmtTime(t: string): string {
  const [h, min] = t.split(':').map(Number)
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 || 12
  return `${h12}:${String(min).padStart(2, '0')} ${ampm}`
}

function fmtFacilityType(type: string): string {
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function tierBadge(tier: number): string {
  if (tier >= 3) return '<span style="color:#DC2626;font-size:12px;font-weight:600;">★★ Urgent</span>'
  if (tier === 2) return '<span style="color:#D97706;font-size:12px;font-weight:600;">★ Priority</span>'
  return ''
}

type ShiftRow = {
  id: string
  shift_date: string
  start_time: string
  end_time: string
  credential_required: string
  priority_tier: number
  notes: string | null
}

type FacilityRow = {
  name: string
  facility_type: string
  address_line1: string
  address_line2: string | null
  city: string
  state: string
  zip: string
}

function buildEmailHtml(
  facility: FacilityRow,
  facilityId: string,
  shifts: ShiftRow[],
  month: string,
  siteUrl: string,
): string {
  const [y, m] = month.split('-').map(Number)
  const monthLabel = `${MONTH_NAMES[m - 1]} ${y}`

  const addressParts = [facility.address_line1]
  if (facility.address_line2) addressParts.push(facility.address_line2)
  addressParts.push(`${facility.city}, ${facility.state} ${facility.zip}`)
  const address = addressParts.join(', ')

  // Group shifts by credential
  const grouped: Record<string, ShiftRow[]> = {}
  for (const s of shifts) {
    if (!grouped[s.credential_required]) grouped[s.credential_required] = []
    grouped[s.credential_required].push(s)
  }

  let shiftSections = ''
  for (const cred of CREDENTIAL_ORDER) {
    const credShifts = grouped[cred]
    if (!credShifts?.length) continue

    const label = CREDENTIAL_LABELS[cred] ?? cred
    let rows = ''
    for (const s of credShifts) {
      const tier = s.priority_tier ?? 1
      const bg = tier >= 3 ? '#FFF5F5' : tier === 2 ? '#FFFBEB' : '#F9FAFB'
      rows += `
        <tr>
          <td style="padding:8px 12px;font-size:13px;color:#374151;background:${bg};border-radius:6px 0 0 6px;white-space:nowrap;">${fmtDate(s.shift_date)}</td>
          <td style="padding:8px 12px;font-size:13px;color:#374151;background:${bg};white-space:nowrap;">${fmtTime(s.start_time)} – ${fmtTime(s.end_time)}</td>
          <td style="padding:8px 12px;font-size:13px;background:${bg};text-align:right;border-radius:0 6px 6px 0;white-space:nowrap;">${tierBadge(tier)}</td>
        </tr>`
      if (s.notes) {
        rows += `
        <tr>
          <td colspan="3" style="padding:0 12px 8px 22px;font-size:12px;color:#6B7280;font-style:italic;background:${bg};">↳ ${s.notes}</td>
        </tr>`
      }
      rows += `<tr><td colspan="3" style="height:4px;"></td></tr>`
    }

    shiftSections += `
      <div style="margin-bottom:22px;">
        <div style="font-size:11.5px;font-weight:700;color:#0D9488;text-transform:uppercase;letter-spacing:.08em;border-left:3px solid #0D9488;padding-left:10px;margin-bottom:10px;">${label}</div>
        <table style="width:100%;border-collapse:separate;border-spacing:0 2px;">
          ${rows}
        </table>
      </div>`
  }

  const shiftCount = shifts.length
  const countLine = shiftCount === 0
    ? 'No open shifts are currently posted for this month.'
    : `${shiftCount} shift${shiftCount !== 1 ? 's' : ''} available to fill`

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 0;background:#F4F7FA;">
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

  <div style="background:#0D9488;padding:20px 32px;">
    <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">ShiftBridge</span>
  </div>

  <div style="padding:28px 32px 20px;">
    <h1 style="font-size:22px;font-weight:700;color:#0D1B2A;margin:0 0 6px;">${facility.name}</h1>
    <p style="font-size:14px;color:#6B7280;margin:0 0 3px;">${fmtFacilityType(facility.facility_type)}</p>
    <p style="font-size:14px;color:#6B7280;margin:0;">${address}</p>
  </div>

  <div style="height:1px;background:#E5E7EB;margin:0 32px;"></div>

  <div style="padding:24px 32px;">
    <h2 style="font-size:16px;font-weight:600;color:#0D1B2A;margin:0 0 4px;">Open Shift Needs — ${monthLabel}</h2>
    <p style="font-size:13px;color:#6B7280;margin:0 0 ${shiftCount > 0 ? '24' : '0'}px;">${countLine}</p>
    ${shiftSections}
  </div>

  <div style="padding:8px 32px 28px;text-align:center;">
    <a href="${siteUrl}/api/track/cta?event=outreach_email&fid=${facilityId}&redirect=${encodeURIComponent(siteUrl + '/signup')}" style="display:inline-block;background:#0D9488;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:8px;font-size:15px;font-weight:600;">
      Claim These Shifts on ShiftBridge →
    </a>
  </div>

  <div style="padding:20px 32px;background:#F9FAFB;border-top:1px solid #E5E7EB;">
    <p style="font-size:13px;color:#374151;margin:0 0 10px;">
      This message was sent by <strong>${facility.name}</strong> using ShiftBridge — a per diem
      nursing platform where agencies claim open shifts and facilities confirm in one click.
      Sign up free to manage these shifts directly.
    </p>
    <p style="font-size:12px;color:#9CA3AF;margin:0;">Powered by ShiftBridge.</p>
  </div>

</div>
</body>
</html>`
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const role = user?.app_metadata?.role
  if (!user || role !== 'facility_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { facilityId, recipientEmails, month } = await request.json() as {
    facilityId: string
    recipientEmails: string[]
    month: string
  }

  if (!facilityId || !month || !Array.isArray(recipientEmails) || recipientEmails.length === 0) {
    return NextResponse.json(
      { error: 'facilityId, month, and at least one recipientEmail are required' },
      { status: 400 },
    )
  }

  // Validate month format (YYYY-MM)
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 })
  }

  // Verify facility ownership
  const { data: facilityAdmin } = await supabase
    .from('facility_admins')
    .select('facility_id')
    .eq('profile_id', user.id)
    .single()

  if (!facilityAdmin || facilityAdmin.facility_id !== facilityId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const admin = createAdminClient()

  const [{ data: facility }, { data: shifts }] = await Promise.all([
    admin
      .from('facilities')
      .select('name, facility_type, address_line1, address_line2, city, state, zip')
      .eq('id', facilityId)
      .single(),
    (() => {
      const [y, m] = month.split('-').map(Number)
      const lastDay = new Date(y, m, 0).getDate()
      const from = `${month}-01`
      const to = `${month}-${String(lastDay).padStart(2, '0')}`
      return admin
        .from('shifts')
        .select('id, shift_date, start_time, end_time, credential_required, priority_tier, notes')
        .eq('facility_id', facilityId)
        .eq('status', 'open')
        .gte('shift_date', from)
        .lte('shift_date', to)
        .order('credential_required')
        .order('shift_date')
        .order('start_time')
    })(),
  ])

  if (!facility) {
    return NextResponse.json({ error: 'Facility not found' }, { status: 404 })
  }

  const [y, m] = month.split('-').map(Number)
  const monthLabel = `${MONTH_NAMES[m - 1]} ${y}`
  const subject = `${facility.name} — Open Shift Needs for ${monthLabel}`
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const html = buildEmailHtml(facility, facilityId, shifts ?? [], month, siteUrl)

  const results = await Promise.allSettled(
    recipientEmails.map(email => sendEmail({ to: email, subject, html }))
  )

  const sent = results.filter(r => r.status === 'fulfilled' && (r as PromiseFulfilledResult<boolean>).value === true).length
  const failed = results.length - sent

  return NextResponse.json({ sent, failed, total: results.length })
}
