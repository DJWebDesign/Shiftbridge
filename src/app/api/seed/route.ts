/**
 * POST /api/seed
 * One-time test data seeder. Super admin only.
 * Idempotent — safe to run multiple times.
 *
 * Creates:
 *  - 3 real facilities (Bayou Pines, St. Martin's Village, Magnolia Gardens)
 *  - Shift configs (Day/Night × CNA/LPN/LPN_IV/RN/CMA) for each
 *  - Agency-facility connections for Sunrise Staffing
 *  - 5 test nurses (one per credential) with TestPass123!
 *  - ~25 open shifts spread across the next 16 days
 *  - 2 placeholder facilities + placeholder shifts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeAddress } from '@/lib/utils/address'

function futureDate(daysFromNow: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString().split('T')[0]
}

function offsetDate(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString().split('T')[0]
}

function pastDate(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d.toISOString().split('T')[0]
}

export async function POST(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
  }

  const admin = createAdminClient()
  const log: string[] = []
  const errors: string[] = []

  // ── 1. Find agency ──────────────────────────────────────────────────────────
  const { data: agencyAdminRow } = await admin
    .from('agency_admins')
    .select('agency_id')
    .limit(1)
    .single()

  if (!agencyAdminRow?.agency_id) {
    return NextResponse.json({ error: 'No agency found. Run the normal setup first.' }, { status: 400 })
  }
  const agencyId = agencyAdminRow.agency_id
  log.push(`Agency: ${agencyId}`)

  // ── 2. Create facilities ────────────────────────────────────────────────────
  const facilityDefs = [
    {
      name: 'Bayou Pines Skilled Nursing Facility',
      address_line1: '1234 Old Spanish Trail',
      city: 'Baton Rouge', state: 'LA', zip: '70802',
      facility_type: 'long_term_care',
    },
    {
      name: "St. Martin's Village",
      address_line1: '456 Cane Sugar Drive',
      city: 'Breaux Bridge', state: 'LA', zip: '70517',
      facility_type: 'assisted_living',
    },
    {
      name: 'Magnolia Gardens Care Center',
      address_line1: '789 Magazine Street',
      city: 'New Orleans', state: 'LA', zip: '70130',
      facility_type: 'long_term_care',
    },
  ]

  const facilityIds: string[] = []
  for (const f of facilityDefs) {
    const { data: existing } = await admin.from('facilities').select('id').eq('name', f.name).maybeSingle()
    if (existing) {
      facilityIds.push(existing.id)
      log.push(`Facility exists: ${f.name}`)
      continue
    }
    const { data: created, error } = await admin.from('facilities').insert({
      ...f,
      address_normalized: normalizeAddress({ address_line1: f.address_line1, city: f.city, state: f.state, zip: f.zip }),
      status: 'active',
    }).select('id').single()
    if (error || !created) { errors.push(`Facility "${f.name}": ${error?.message}`); continue }
    facilityIds.push(created.id)
    log.push(`Created facility: ${f.name}`)
  }

  // ── 3. Shift configs ────────────────────────────────────────────────────────
  const configs = [
    { shift_name: 'Day Shift',   credential_type: 'CNA',    start_time: '07:00:00', end_time: '19:00:00' },
    { shift_name: 'Night Shift', credential_type: 'CNA',    start_time: '19:00:00', end_time: '07:00:00' },
    { shift_name: 'Day Shift',   credential_type: 'CMA',    start_time: '07:00:00', end_time: '15:00:00' },
    { shift_name: 'Day Shift',   credential_type: 'LPN',    start_time: '07:00:00', end_time: '19:00:00' },
    { shift_name: 'Night Shift', credential_type: 'LPN',    start_time: '19:00:00', end_time: '07:00:00' },
    { shift_name: 'Day Shift',   credential_type: 'LPN_IV', start_time: '07:00:00', end_time: '19:00:00' },
    { shift_name: 'Day Shift',   credential_type: 'RN',     start_time: '07:00:00', end_time: '19:00:00' },
    { shift_name: 'Night Shift', credential_type: 'RN',     start_time: '19:00:00', end_time: '07:00:00' },
  ]
  for (const fId of facilityIds) {
    for (const c of configs) {
      const { error } = await admin.from('facility_shift_configs').insert({ facility_id: fId, ...c })
      if (error && error.code !== '23505') errors.push(`Config error: ${error.message}`)
    }
  }
  log.push(`Shift configs upserted for ${facilityIds.length} facilities`)

  // ── 4. Agency-facility connections ──────────────────────────────────────────
  for (const fId of facilityIds) {
    const { error } = await admin.from('agency_facility_connections').insert({
      agency_id: agencyId, facility_id: fId, status: 'active',
    })
    if (error && error.code !== '23505') errors.push(`Connection error: ${error.message}`)
  }
  log.push(`Facilities connected to agency`)

  // ── 5. Test nurses ──────────────────────────────────────────────────────────
  const nurseDefs = [
    { email: 'cna@test.com',   name: 'Marie Thibodaux',      cred: 'CNA',    license: 'LA-CNA-10001', rate: 18, iv: false },
    { email: 'cma@test.com',   name: 'Jacque Fontenot',      cred: 'CMA',    license: 'LA-CMA-10002', rate: 20, iv: false },
    { email: 'lpn@test.com',   name: 'Celestine Broussard',  cred: 'LPN',    license: 'LA-LPN-10003', rate: 24, iv: false },
    { email: 'lpniv@test.com', name: 'Alcide Boudreaux',     cred: 'LPN_IV', license: 'LA-LPN-10004', rate: 26, iv: true  },
    { email: 'rn@test.com',    name: 'Evangeline Trosclair', cred: 'RN',     license: 'LA-RN-10005',  rate: 32, iv: true  },
  ]

  const nurseProfileIds: string[] = []

  for (const n of nurseDefs) {
    // Step 1: create auth user, or find the existing one
    let authUserId: string

    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email: n.email,
      password: 'TestPass123!',
      email_confirm: true,
      user_metadata: { full_name: n.name },
      app_metadata: { role: 'nurse' },
    })

    if (authErr) {
      if (authErr.message?.includes('already been registered')) {
        // Auth user exists — look them up via profiles table
        const { data: existingProfile } = await admin
          .from('profiles').select('id').eq('email', n.email).maybeSingle()
        if (!existingProfile) {
          errors.push(`${n.email}: auth user exists but no profile row found — delete the auth user and re-run`)
          continue
        }
        authUserId = existingProfile.id
        log.push(`Nurse auth already exists: ${n.email}`)
      } else {
        errors.push(`Auth create ${n.email}: ${authErr.message}`)
        continue
      }
    } else {
      authUserId = authData.user.id

      // Step 2: create profile row (only for brand-new auth users)
      const { error: profErr } = await admin.from('profiles').insert({
        id: authUserId, role: 'nurse', full_name: n.name, email: n.email,
      })
      if (profErr && profErr.code !== '23505') {
        errors.push(`Profile ${n.email}: ${profErr.message}`)
        // Clean up the orphaned auth user so re-run can succeed
        await admin.auth.admin.deleteUser(authUserId)
        continue
      }
      log.push(`Created nurse: ${n.email}`)
    }

    // Step 3: get or create nurse_profile
    const { data: existingNP } = await admin
      .from('nurse_profiles').select('id').eq('profile_id', authUserId).maybeSingle()

    let npId: string
    if (existingNP) {
      npId = existingNP.id
    } else {
      const { data: np, error: npErr } = await admin.from('nurse_profiles').insert({
        profile_id: authUserId,
        license_number: n.license,
        license_state: 'LA',
        credential_type: n.cred,
        license_status: 'active',
        license_expiration: offsetDate(24),
        iv_certified: n.iv,
        iv_cert_source: n.cred === 'RN' ? 'implicit_rn' : n.iv ? 'manual' : null,
        cpr_expiration: offsetDate(12),
        tb_test_date: pastDate(6),
        covid_vaccinated: true,
      }).select('id').single()
      if (npErr || !np) { errors.push(`NurseProfile ${n.email}: ${npErr?.message}`); continue }
      npId = np.id
    }
    nurseProfileIds.push(npId)

    // Step 4: create agency relationship (upsert-style — ignore duplicate)
    const { error: relErr } = await admin.from('agency_nurse_relationships').insert({
      agency_id: agencyId,
      nurse_profile_id: npId,
      base_pay_rate: n.rate,
      status: 'active',
    })
    if (relErr && relErr.code !== '23505') {
      errors.push(`Relationship ${n.email}: ${relErr.message}`)
    } else if (!relErr) {
      log.push(`Linked ${n.email} → agency`)
    } else {
      log.push(`${n.email} already linked to agency`)
    }
  }
  log.push(`Nurses ready: ${nurseProfileIds.length}`)

  // ── 6. Open shifts ──────────────────────────────────────────────────────────
  type ShiftPlan = { fi: number; days: number[]; cred: string; tier: number; start: string; end: string }
  const shiftPlans: ShiftPlan[] = [
    // Bayou Pines
    { fi: 0, days: [2, 5, 9, 13],  cred: 'CNA',    tier: 1, start: '07:00:00', end: '19:00:00' },
    { fi: 0, days: [3, 10],         cred: 'LPN',    tier: 2, start: '07:00:00', end: '19:00:00' },
    { fi: 0, days: [6, 14],         cred: 'RN',     tier: 3, start: '07:00:00', end: '19:00:00' },
    { fi: 0, days: [4, 11],         cred: 'CNA',    tier: 1, start: '19:00:00', end: '07:00:00' },
    // St. Martin's
    { fi: 1, days: [2, 7, 12],      cred: 'CNA',    tier: 1, start: '07:00:00', end: '19:00:00' },
    { fi: 1, days: [3, 9, 15],      cred: 'LPN_IV', tier: 2, start: '07:00:00', end: '19:00:00' },
    { fi: 1, days: [5, 13],         cred: 'RN',     tier: 1, start: '19:00:00', end: '07:00:00' },
    { fi: 1, days: [6, 14],         cred: 'LPN',    tier: 2, start: '07:00:00', end: '19:00:00' },
    // Magnolia Gardens
    { fi: 2, days: [2, 6, 10, 16],  cred: 'CNA',    tier: 1, start: '07:00:00', end: '19:00:00' },
    { fi: 2, days: [4, 11],         cred: 'RN',     tier: 3, start: '07:00:00', end: '19:00:00' },
    { fi: 2, days: [8, 15],         cred: 'LPN',    tier: 1, start: '19:00:00', end: '07:00:00' },
    { fi: 2, days: [3, 12],         cred: 'CMA',    tier: 1, start: '07:00:00', end: '15:00:00' },
  ]

  let shiftsCreated = 0
  for (const plan of shiftPlans) {
    const fId = facilityIds[plan.fi]
    if (!fId) continue
    for (const day of plan.days) {
      const { error } = await admin.from('shifts').insert({
        facility_id: fId,
        shift_date: futureDate(day),
        start_time: plan.start,
        end_time: plan.end,
        credential_required: plan.cred,
        priority_tier: plan.tier,
        status: 'open',
        is_placeholder: false,
        posted_by: user.id,
      })
      if (error) errors.push(`Shift: ${error.message}`)
      else shiftsCreated++
    }
  }
  log.push(`Created ${shiftsCreated} open shifts`)

  // ── 7. Placeholder facilities ───────────────────────────────────────────────
  const phDefs = [
    {
      name: 'East Parish Rehabilitation Center',
      address_line1: '100 Healthcare Drive',
      city: 'Prairieville', state: 'LA', zip: '70769',
      facility_type: 'rehabilitation',
      coordinator_email: 'coordinator@eastparish.example.com',
    },
    {
      name: 'Vermilion Community Care',
      address_line1: '200 Abbeville Highway',
      city: 'Abbeville', state: 'LA', zip: '70510',
      facility_type: 'long_term_care',
      coordinator_email: null,
    },
  ]

  const phIds: string[] = []
  for (const p of phDefs) {
    const { data: existing } = await admin.from('placeholder_facilities')
      .select('id').eq('name', p.name).eq('agency_id', agencyId).maybeSingle()
    if (existing) {
      phIds.push(existing.id)
      log.push(`Placeholder exists: ${p.name}`)
      continue
    }
    const { data: ph, error } = await admin.from('placeholder_facilities').insert({
      ...p,
      agency_id: agencyId,
      address_normalized: normalizeAddress({ address_line1: p.address_line1, city: p.city, state: p.state, zip: p.zip }),
      connection_status: 'unmatched',
    }).select('id').single()
    if (error || !ph) { errors.push(`Placeholder: ${error?.message}`); continue }
    phIds.push(ph.id)
    log.push(`Created placeholder: ${p.name}`)
  }

  // ── 8. Placeholder shifts ────────────────────────────────────────────────────
  const phShiftPlans = [
    { pi: 0, days: [5, 8, 13],  cred: 'CNA', tier: 2 },
    { pi: 0, days: [6, 14],     cred: 'LPN', tier: 3 },
    { pi: 1, days: [4, 9, 16],  cred: 'RN',  tier: 2 },
    { pi: 1, days: [7, 12],     cred: 'CNA', tier: 1 },
  ]

  let phShifts = 0
  for (const plan of phShiftPlans) {
    const phId = phIds[plan.pi]
    if (!phId) continue
    for (const day of plan.days) {
      const { error } = await admin.from('shifts').insert({
        placeholder_facility_id: phId,
        agency_id: agencyId,
        shift_date: futureDate(day),
        start_time: '07:00:00',
        end_time: '19:00:00',
        credential_required: plan.cred,
        priority_tier: plan.tier,
        status: 'open',
        is_placeholder: true,
        posted_by: user.id,
      })
      if (error) errors.push(`Ph shift: ${error.message}`)
      else phShifts++
    }
  }
  log.push(`Created ${phShifts} placeholder shifts`)

  return NextResponse.json({
    ok: errors.length === 0,
    agencyId,
    facilitiesCreated: facilityIds.length,
    nursesCreated: nurseProfileIds.length,
    realShifts: shiftsCreated,
    placeholderShifts: phShifts,
    log,
    errors: errors.length > 0 ? errors : undefined,
  })
}
