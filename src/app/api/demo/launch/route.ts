import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const RATE_LIMIT = 20 // max concurrent active demo sessions

function randomPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#'
  let out = ''
  for (let i = 0; i < 20; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

// Kansas/Midwest themed demo data
const DEMO_AGENCY_NAME = 'Heartland Per Diem Staffing'

const DEMO_FACILITIES = [
  {
    name: 'Cottonwood Creek Memory Care',
    facility_type: 'memory_care',
    address_line1: '1200 E Douglas Ave',
    city: 'Wichita',
    state: 'KS',
    zip: '67214',
    address_normalized: '1200 e douglas ave wichita ks 67214',
    status: 'active',
  },
  {
    name: 'Prairie View SNF',
    facility_type: 'long_term_care',
    address_line1: '8900 Metcalf Ave',
    city: 'Overland Park',
    state: 'KS',
    zip: '66212',
    address_normalized: '8900 metcalf ave overland park ks 66212',
    status: 'active',
  },
]

// Placeholder — address deliberately different from connected facilities so no match_detected
const DEMO_PLACEHOLDER = {
  name: 'Flint Hills Rehabilitation Center',
  facility_type: 'rehabilitation',
  address_line1: '3800 W 6th St',
  city: 'Lawrence',
  state: 'KS',
  zip: '66049',
  address_normalized: '3800 w 6th st lawrence ks 66049',
  coordinator_email: 'coordinator@flinthills.example',
  connection_status: 'unmatched',
}

const DEMO_NURSES = [
  { first: 'Beth',    last: 'Kowalski', credential: 'CNA',    licenseBase: 'CNA-KS-4', phone: '+13165550101' },
  { first: 'Tom',     last: 'Driskel',  credential: 'LPN',    licenseBase: 'LPN-KS-2', phone: '+13165550102' },
  { first: 'Amy',     last: 'Hartley',  credential: 'RN',     licenseBase: 'RN-KS-9',  phone: '+13165550103' },
  { first: 'Caitlin', last: 'Novak',    credential: 'LPN_IV', licenseBase: 'LPN-KS-5', phone: '+13165550104' },
]

const DEMO_NURSE_FULL_NAME = 'Demo User'
const DEMO_NURSE_CREDENTIAL = 'CNA'

type ShiftConfig = {
  credential_type: string
  shift_name: string
  start_time: string
  end_time: string
}

const SHIFT_CONFIGS: ShiftConfig[] = [
  { credential_type: 'CNA',    shift_name: 'Day',   start_time: '07:00:00', end_time: '15:00:00' },
  { credential_type: 'CNA',    shift_name: 'Night',  start_time: '23:00:00', end_time: '07:00:00' },
  { credential_type: 'LPN',    shift_name: 'Day',   start_time: '07:00:00', end_time: '15:00:00' },
  { credential_type: 'LPN_IV', shift_name: 'Day',   start_time: '07:00:00', end_time: '15:00:00' },
  { credential_type: 'RN',     shift_name: 'Day',   start_time: '07:00:00', end_time: '15:00:00' },
]

function addDays(base: Date, n: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

async function createDemoSession(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  userEmail: string,
) {
  const today = new Date()
  // Short random suffix so nurse license numbers are unique across concurrent sessions
  const suffix = Math.floor(10000 + Math.random() * 90000).toString()

  // 1. Create agency
  const { data: agency, error: agencyErr } = await admin
    .from('agencies')
    .insert({ name: DEMO_AGENCY_NAME, display_name: DEMO_AGENCY_NAME, status: 'active' })
    .select('id')
    .single()
  if (agencyErr || !agency) throw new Error('Failed to create agency: ' + agencyErr?.message)

  // 2. Create profile row for auth user
  // profiles.role must be a valid DB role — use 'agency_admin'; the real 'demo' role is in app_metadata
  await admin.from('profiles').insert({
    id: userId,
    email: userEmail,
    full_name: DEMO_NURSE_FULL_NAME,
    role: 'agency_admin',
    is_active: true,
  })

  // 3. Create agency_admins row
  await admin.from('agency_admins').insert({ agency_id: agency.id, profile_id: userId })

  // 4. Create facilities
  const facilityIds: string[] = []
  for (const fac of DEMO_FACILITIES) {
    const { data: facility, error: facErr } = await admin
      .from('facilities')
      .insert({ ...fac })
      .select('id')
      .single()
    if (facErr || !facility) throw new Error('Failed to create facility: ' + JSON.stringify(facErr))
    facilityIds.push(facility.id)

    // 5. Connect agency ↔ facility
    await admin.from('agency_facility_connections').insert({
      agency_id: agency.id,
      facility_id: facility.id,
      status: 'active',
      accepted_at: new Date().toISOString(),
    })

    // 6. Shift configs per facility
    await admin.from('facility_shift_configs').insert(
      SHIFT_CONFIGS.map(sc => ({ ...sc, facility_id: facility.id }))
    )
  }

  const primaryFacilityId = facilityIds[0] // Cottonwood Creek — demo user's facility admin view

  // 7. facility_admins row (primary facility only)
  await admin.from('facility_admins').insert({ facility_id: primaryFacilityId, profile_id: userId })

  // 8. Create roster nurses — requires real auth users because profiles.id FK → auth.users.id
  // These accounts have random passwords nobody knows; they exist only for FK integrity
  const nurseProfileIds: string[] = []
  for (const n of DEMO_NURSES) {
    const licenseExpiry = addDays(today, 180)
    const cprExpiry = addDays(today, 90)
    const tbDate = addDays(today, -200)

    const { data: nurseAuthData, error: nurseAuthErr } = await admin.auth.admin.createUser({
      email: `${n.first.toLowerCase()}.${n.last.toLowerCase()}.${crypto.randomUUID().slice(0, 8)}@demo.shiftbridge`,
      password: randomPassword(),
      email_confirm: true,
      app_metadata: { role: 'nurse' },
    })
    if (nurseAuthErr || !nurseAuthData.user) {
      throw new Error('Failed to create nurse auth user: ' + nurseAuthErr?.message)
    }
    const nurseUserId = nurseAuthData.user.id

    await admin.from('profiles').insert({
      id: nurseUserId,
      email: nurseAuthData.user.email!,
      full_name: `${n.first} ${n.last}`,
      role: 'nurse',
      is_active: true,
    })

    const { data: np, error: npErr } = await admin
      .from('nurse_profiles')
      .insert({
        profile_id: nurseUserId,
        license_number: n.licenseBase + suffix,
        license_state: 'KS',
        credential_type: n.credential,
        license_expiration: licenseExpiry,
        cpr_expiration: cprExpiry,
        tb_test_date: tbDate,
        phone: n.phone,
        iv_certified: n.credential === 'RN' || n.credential === 'LPN_IV',
      })
      .select('id')
      .single()
    if (npErr || !np) throw new Error('Failed to create nurse profile: ' + JSON.stringify(npErr))

    await admin.from('agency_nurse_relationships').insert({
      agency_id: agency.id,
      nurse_profile_id: np.id,
      status: 'active',
      base_pay_rate: n.credential === 'RN' ? 45 : n.credential === 'LPN_IV' ? 38 : n.credential === 'LPN' ? 32 : 22,
    })

    nurseProfileIds.push(np.id)
  }

  // 9. Demo user's own nurse_profiles row (demo user IS the nurse)
  const { data: demoNP } = await admin
    .from('nurse_profiles')
    .insert({
      profile_id: userId,
      license_number: 'CNA-KS-D' + suffix,
      license_state: 'KS',
      credential_type: DEMO_NURSE_CREDENTIAL,
      license_expiration: addDays(today, 300),
      cpr_expiration: addDays(today, 120),
      tb_test_date: addDays(today, -150),
      phone: '+13165550199',
      iv_certified: false,
    })
    .select('id')
    .single()
  const demoNurseProfileId = demoNP?.id ?? null
  if (demoNurseProfileId) {
    await admin.from('agency_nurse_relationships').insert({
      agency_id: agency.id,
      nurse_profile_id: demoNurseProfileId,
      status: 'active',
      base_pay_rate: 22,
    })
    nurseProfileIds.push(demoNurseProfileId)
  }

  // 10. Open shifts at primary facility (next 12 days)
  const openShifts = []
  const credentials: Array<'CNA' | 'LPN' | 'RN'> = ['CNA', 'LPN', 'RN']
  for (let i = 1; i <= 12; i++) {
    const shiftDate = addDays(today, i)
    const cred = credentials[i % credentials.length]
    openShifts.push({
      facility_id: primaryFacilityId,
      shift_date: shiftDate,
      credential_required: cred,
      start_time: '07:00:00',
      end_time: '15:00:00',
      status: 'open',
      priority_tier: 1,
      is_placeholder: false,
      posted_by: userId,
    })
    // Add a night CNA shift every 3 days
    if (i % 3 === 0) {
      openShifts.push({
        facility_id: primaryFacilityId,
        shift_date: shiftDate,
        credential_required: 'CNA',
        start_time: '23:00:00',
        end_time: '07:00:00',
        status: 'open',
        priority_tier: 2,
        is_placeholder: false,
        posted_by: userId,
      })
    }
  }
  const { data: insertedShifts } = await admin.from('shifts').insert(openShifts).select('id')

  // 11. Pre-seeded claimed shift — Tom has a pending claim ready to confirm
  const tomNpId = nurseProfileIds[1] // Tom Driskel = index 1
  const tomAgencyId = agency.id
  const claimedShiftDate = addDays(today, 2)
  const { data: claimedShift } = await admin
    .from('shifts')
    .insert({
      facility_id: primaryFacilityId,
      shift_date: claimedShiftDate,
      credential_required: 'LPN',
      start_time: '15:00:00',
      end_time: '23:00:00',
      status: 'claimed',
      priority_tier: 1,
      is_placeholder: false,
      posted_by: userId,
    })
    .select('id')
    .single()

  if (claimedShift && tomNpId) {
    await admin.from('shift_claims').insert({
      shift_id: claimedShift.id,
      nurse_profile_id: tomNpId,
      agency_id: tomAgencyId,
      status: 'pending',
    })
  }

  // 12. Historical confirmed shifts (gives the "active platform" feel)
  const historicalNurses = [
    { npId: nurseProfileIds[0], cred: 'CNA', facId: facilityIds[0] },
    { npId: nurseProfileIds[1], cred: 'LPN', facId: facilityIds[1] },
    { npId: nurseProfileIds[2], cred: 'RN',  facId: facilityIds[0] },
  ]
  for (let i = 0; i < historicalNurses.length; i++) {
    const { npId, cred, facId } = historicalNurses[i]
    const pastDate = addDays(today, -(i + 3))
    const { data: pastShift } = await admin
      .from('shifts')
      .insert({
        facility_id: facId,
        shift_date: pastDate,
        credential_required: cred,
        start_time: '07:00:00',
        end_time: '15:00:00',
        status: 'confirmed',
        priority_tier: 1,
        is_placeholder: false,
        posted_by: userId,
      })
      .select('id')
      .single()
    if (pastShift && npId) {
      await admin.from('shift_claims').insert({
        shift_id: pastShift.id,
        nurse_profile_id: npId,
        agency_id: agency.id,
        status: 'confirmed',
        confirmed_at: new Date(today.getTime() - (i + 3) * 86400000).toISOString(),
      })
    }
  }

  // 13. Placeholder facility (Flint Hills)
  const { data: placeholder, error: phErr } = await admin
    .from('placeholder_facilities')
    .insert({
      agency_id: agency.id,
      ...DEMO_PLACEHOLDER,
    })
    .select('id')
    .single()
  if (phErr || !placeholder) throw new Error('Failed to create placeholder facility: ' + phErr?.message)

  // 14. Placeholder shifts
  if (placeholder) {
    const phShifts = [1, 5, 9].map(offset => ({
      placeholder_facility_id: placeholder.id,
      shift_date: addDays(today, offset),
      credential_required: 'CNA',
      start_time: '07:00:00',
      end_time: '15:00:00',
      status: 'open',
      priority_tier: 1,
      is_placeholder: true,
      posted_by: userId,
    }))
    await admin.from('shifts').insert(phShifts)
  }

  // 15. Connection request from agency → primary facility (pending, visible on facility dashboard)
  if (placeholder) {
    await admin.from('connection_requests').insert({
      agency_id: agency.id,
      facility_id: primaryFacilityId,
      placeholder_id: placeholder.id,
      status: 'pending',
      message: 'Heartland Per Diem Staffing would like to connect with your facility.',
    })
  }

  // 16. Update placeholder to request_pending (since we just sent the request)
  if (placeholder) {
    await admin.from('placeholder_facilities').update({ connection_status: 'request_pending' }).eq('id', placeholder.id)
  }

  return {
    agencyId: agency.id,
    facilityId: primaryFacilityId,
    nurseProfileIds,
    shiftCount: (insertedShifts?.length ?? 0) + (claimedShift ? 1 : 0),
  }
}

export async function POST() {
  const admin = createAdminClient()

  // Rate limit: max 20 active sessions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (admin as any)
    .from('demo_sessions')
    .select('id', { count: 'exact', head: true })
    .gt('expires_at', new Date().toISOString())

  if ((count ?? 0) >= RATE_LIMIT) {
    return NextResponse.json({ error: 'Demo capacity reached. Please try again in a few minutes.' }, { status: 429 })
  }

  const email = `demo-${crypto.randomUUID()}@shiftbridge.demo`
  const password = randomPassword()

  // Create Supabase auth user
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'demo' },
  })

  if (authErr || !authData.user) {
    console.error('[demo/launch] auth user creation failed:', authErr)
    return NextResponse.json({ error: 'Failed to create demo session' }, { status: 500 })
  }

  const userId = authData.user.id

  try {
    const session = await createDemoSession(admin, userId, email)

    // Update auth user app_metadata with entity IDs
    await admin.auth.admin.updateUserById(userId, {
      app_metadata: {
        role: 'demo',
        agency_id: session.agencyId,
        facility_id: session.facilityId,
      },
    })

    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()

    // Insert demo_sessions row
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('demo_sessions').insert({
      auth_user_id: userId,
      agency_id: session.agencyId,
      facility_id: session.facilityId,
      nurse_profile_ids: session.nurseProfileIds,
      expires_at: expiresAt,
    })

    return NextResponse.json({ email, password, agencyId: session.agencyId, facilityId: session.facilityId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[demo/launch] data creation failed:', msg)
    // Clean up auth user on failure
    await admin.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: 'Failed to initialize demo data', detail: msg }, { status: 500 })
  }
}
