import { createAdminClient } from '@/lib/supabase/admin'
import ConfirmTokenClient from './ConfirmTokenClient'

interface NurseInfo {
  name: string
  credential: string
  license: string
  phone: string
  cprExp: string
  tbValid: string
}

interface TokenInfo {
  used_at: string | null
  expires_at: string
  shift: {
    id: string
    status: string
    credential_required: string
    shift_date: string
    start_time: string
    end_time: string
    placeholder_facility_id: string | null
  }
  facilityName: string
  nurse: NurseInfo | null
}

async function getTokenInfo(token: string): Promise<TokenInfo | null> {
  const admin = createAdminClient()
  const { data: tokenRow } = await admin
    .from('placeholder_confirm_tokens')
    .select('id, shift_id, used_at, expires_at')
    .eq('token', token)
    .single()

  if (!tokenRow) return null

  const { data: shift } = await admin
    .from('shifts')
    .select('id, status, credential_required, shift_date, start_time, end_time, placeholder_facility_id')
    .eq('id', tokenRow.shift_id)
    .single()

  if (!shift) return null

  let facilityName = 'Unknown Facility'
  if (shift.placeholder_facility_id) {
    const { data: placeholder } = await admin
      .from('placeholder_facilities')
      .select('name')
      .eq('id', shift.placeholder_facility_id)
      .single()
    if (placeholder) facilityName = placeholder.name
  }

  // Fetch nurse from pending claim
  let nurse: NurseInfo | null = null
  const { data: claim } = await admin
    .from('shift_claims')
    .select('nurse_profile_id')
    .eq('shift_id', tokenRow.shift_id)
    .eq('status', 'pending')
    .order('claimed_at')
    .limit(1)
    .single()

  if (claim?.nurse_profile_id) {
    const [{ data: np }, { data: pr }] = await Promise.all([
      admin
        .from('nurse_profiles')
        .select('license_number, license_state, license_status, credential_type, phone, cpr_expiration, tb_test_date')
        .eq('id', claim.nurse_profile_id)
        .single(),
      admin
        .from('nurse_profiles')
        .select('profile_id')
        .eq('id', claim.nurse_profile_id)
        .single(),
    ])

    let fullName = 'Unknown Nurse'
    if (pr?.profile_id) {
      const { data: profile } = await admin
        .from('profiles')
        .select('full_name')
        .eq('id', pr.profile_id)
        .single()
      if (profile?.full_name) fullName = profile.full_name
    }

    const cprExp = np?.cpr_expiration
      ? new Date(np.cpr_expiration).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '—'
    const tbValid = np?.tb_test_date
      ? new Date(new Date(np.tb_test_date).getTime() + 365 * 24 * 60 * 60 * 1000)
          .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '—'

    nurse = {
      name: fullName,
      credential: np?.credential_type ?? shift.credential_required,
      license: np ? `${np.license_number} (${np.license_state}) — ${np.license_status}` : '—',
      phone: np?.phone ?? '—',
      cprExp,
      tbValid,
    }
  }

  return { used_at: tokenRow.used_at, expires_at: tokenRow.expires_at, shift, facilityName, nurse }
}

export default async function ConfirmTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const info = await getTokenInfo(token)

  if (!info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-gray-500 text-sm">This confirmation link is not valid or has already been used.</p>
        </div>
      </div>
    )
  }

  const expired = new Date(info.expires_at) < new Date()
  const alreadyUsed = !!info.used_at
  const shiftConfirmed = info.shift.status === 'confirmed'
  // agencyConfirmed = shift was confirmed (by agency admin) but this token is still fresh
  const agencyConfirmed = shiftConfirmed && !alreadyUsed
  const canceled = info.shift.status === 'canceled'

  if (expired && !shiftConfirmed && !alreadyUsed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">⏰</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link Expired</h1>
          <p className="text-gray-500 text-sm">This confirmation link expired 7 days after it was sent.</p>
        </div>
      </div>
    )
  }

  if (canceled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">❌</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Shift Canceled</h1>
          <p className="text-gray-500 text-sm">This shift has been canceled and can no longer be confirmed.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <ConfirmTokenClient
        token={token}
        shift={info.shift}
        facilityName={info.facilityName}
        alreadyConfirmed={alreadyUsed}
        agencyConfirmed={agencyConfirmed}
        nurse={info.nurse}
      />
    </div>
  )
}
