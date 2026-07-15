import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/resend/client'

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export interface CoordinatorEmailShift {
  id: string
  shift_date: string
  start_time: string
  end_time: string
  credential_required: string
  placeholder_facility_id: string | null
  agency_id: string | null
}

/**
 * Sends the coordinator confirm/decline email for a claimed placeholder shift.
 * Creates a single-use placeholder_confirm_token and emails the confirm and
 * decline links to the coordinator, if the placeholder facility has one on file.
 *
 * Called from the claim route (approval mode off) and the agency-approve route
 * (approval mode on — the claim route skips the email in that case).
 *
 * Never throws — email failure must not fail the claim/approve mutation.
 */
export async function sendCoordinatorConfirmEmail(
  admin: ReturnType<typeof createAdminClient>,
  shift: CoordinatorEmailShift,
  nurseProfileId: string,
  nurseName: string,
): Promise<void> {
  if (!shift.placeholder_facility_id) return

  try {
    const [{ data: placeholder }, { data: agencyRow }] = await Promise.all([
      admin
        .from('placeholder_facilities')
        .select('name, coordinator_email')
        .eq('id', shift.placeholder_facility_id)
        .single(),
      shift.agency_id
        ? admin.from('agencies').select('name, display_name, contact_email').eq('id', shift.agency_id).single()
        : Promise.resolve({ data: null }),
    ])

    if (!placeholder?.coordinator_email) return

    // Generate a confirm token
    const { data: tokenRow, error: tokenError } = await admin
      .from('placeholder_confirm_tokens')
      .insert({
        shift_id: shift.id,
        email: placeholder.coordinator_email,
      })
      .select('token')
      .single()

    if (tokenError || !tokenRow?.token) {
      console.error('[coordinator email] token insert failed:', tokenError)
      return
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const confirmUrl = `${baseUrl}/confirm/${tokenRow.token}`
    const declineUrl = `${baseUrl}/decline/${tokenRow.token}`

    const facilityName = placeholder.name
    const shiftDateFmt = fmtDate(shift.shift_date)

    // Fetch nurse credential info for the email
    const { data: nurseCreds } = await admin
      .from('nurse_profiles')
      .select('license_number, license_state, license_status, credential_type, phone, cpr_expiration, tb_test_date')
      .eq('id', nurseProfileId)
      .single()

    const licenseInfo = nurseCreds
      ? `${nurseCreds.license_number} (${nurseCreds.license_state}) — ${nurseCreds.license_status}`
      : '—'
    const nursePhone = nurseCreds?.phone ?? '—'
    const cprExp = nurseCreds?.cpr_expiration
      ? new Date(nurseCreds.cpr_expiration).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '—'
    const tbDate = nurseCreds?.tb_test_date
      ? new Date(new Date(nurseCreds.tb_test_date).getTime() + 365 * 24 * 60 * 60 * 1000)
          .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '—'

    await sendEmail({
      to: placeholder.coordinator_email,
      subject: `Shift Claim — ${nurseName} · ${shift.credential_required} · ${shiftDateFmt}`,
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;">
          <h2 style="font-size:18px;color:#111827;margin-bottom:8px;">Shift Claim Notification</h2>
          <p style="color:#374151;margin-bottom:20px;">
            <strong>${nurseName}</strong> has claimed a shift at <strong>${facilityName}</strong>:
          </p>

          <p style="font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Shift Details</p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#f9fafb;border-radius:8px;overflow:hidden;">
            <tr><td style="padding:8px 12px;color:#6b7280;font-size:14px;">Date</td><td style="padding:8px 12px;font-size:14px;font-weight:600;">${shiftDateFmt}</td></tr>
            <tr style="background:#fff;"><td style="padding:8px 12px;color:#6b7280;font-size:14px;">Time</td><td style="padding:8px 12px;font-size:14px;">${shift.start_time.slice(0,5)} – ${shift.end_time.slice(0,5)}</td></tr>
            <tr><td style="padding:8px 12px;color:#6b7280;font-size:14px;">Credential</td><td style="padding:8px 12px;font-size:14px;">${shift.credential_required}</td></tr>
          </table>

          <p style="font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Nurse Information</p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#f9fafb;border-radius:8px;overflow:hidden;">
            <tr><td style="padding:8px 12px;color:#6b7280;font-size:14px;">Name</td><td style="padding:8px 12px;font-size:14px;font-weight:600;">${nurseName}</td></tr>
            <tr style="background:#fff;"><td style="padding:8px 12px;color:#6b7280;font-size:14px;">License</td><td style="padding:8px 12px;font-size:14px;">${licenseInfo}</td></tr>
            <tr><td style="padding:8px 12px;color:#6b7280;font-size:14px;">Phone</td><td style="padding:8px 12px;font-size:14px;">${nursePhone}</td></tr>
            <tr style="background:#fff;"><td style="padding:8px 12px;color:#6b7280;font-size:14px;">CPR Exp.</td><td style="padding:8px 12px;font-size:14px;">${cprExp}</td></tr>
            <tr><td style="padding:8px 12px;color:#6b7280;font-size:14px;">TB Valid Until</td><td style="padding:8px 12px;font-size:14px;">${tbDate}</td></tr>
          </table>

          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <a href="${confirmUrl}" style="display:inline-block;background:#0D9488;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;">
              Confirm This Shift
            </a>
            <a href="${declineUrl}" style="display:inline-block;background:#fff;color:#dc2626;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;border:1.5px solid #fca5a5;">
              Decline
            </a>
          </div>
          ${agencyRow ? `<p style="color:#6b7280;font-size:12px;margin-top:16px;">
            Sent by <strong>${agencyRow.display_name ?? agencyRow.name}</strong>${agencyRow.contact_email ? ` · <a href="mailto:${agencyRow.contact_email}" style="color:#0D9488;">${agencyRow.contact_email}</a>` : ''}
          </p>` : ''}
          <p style="color:#9ca3af;font-size:12px;margin-top:8px;">
            These links are single-use and expire in 7 days. Powered by ShiftBridge.
          </p>
        </div>
      `,
    })
  } catch (err) {
    console.error('[coordinator email]', err)
  }
}
