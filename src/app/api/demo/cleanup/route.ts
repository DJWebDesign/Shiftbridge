import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const force = searchParams.get('force') === 'true'

  const admin = createAdminClient()

  // Fetch sessions to clean up (cast as any — demo_sessions not in generated types until migration runs)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any
  let query = adminAny.from('demo_sessions').select('*')
  if (!force) {
    query = query.lt('expires_at', new Date().toISOString())
  }
  const { data: sessions, error: sessErr } = await query
  if (sessErr) {
    return NextResponse.json({ error: 'Failed to fetch demo sessions' }, { status: 500 })
  }
  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ cleaned: 0 })
  }

  let cleaned = 0
  const errors: string[] = []

  for (const session of sessions) {
    try {
      const agencyId = session.agency_id
      const facilityId = session.facility_id
      const nurseProfileIds: string[] = session.nurse_profile_ids ?? []
      const userId = session.auth_user_id

      // Collect all facility IDs for this demo agency
      const { data: allFacilityConns } = await admin
        .from('agency_facility_connections')
        .select('facility_id')
        .eq('agency_id', agencyId)
      const allFacilityIds = (allFacilityConns ?? []).map(r => r.facility_id).filter(Boolean)

      // Delete in dependency order
      // 1. Notifications
      await admin.from('notifications').delete().eq('profile_id', userId)

      // 2. Shift claims
      if (allFacilityIds.length > 0) {
        const { data: shiftIds } = await admin
          .from('shifts')
          .select('id')
          .in('facility_id', allFacilityIds)
        const ids = (shiftIds ?? []).map(s => s.id)
        if (ids.length > 0) {
          await admin.from('shift_claims').delete().in('shift_id', ids)
        }
      }
      // Also shifts from placeholder facilities
      if (agencyId) {
        const { data: phFacilities } = await admin
          .from('placeholder_facilities')
          .select('id')
          .eq('agency_id', agencyId)
        const phIds = (phFacilities ?? []).map(p => p.id)
        if (phIds.length > 0) {
          const { data: phShiftIds } = await admin
            .from('shifts')
            .select('id')
            .in('placeholder_facility_id', phIds)
          const psIds = (phShiftIds ?? []).map(s => s.id)
          if (psIds.length > 0) {
            await admin.from('shift_claims').delete().in('shift_id', psIds)
          }
        }
      }

      // 3. Shifts
      if (allFacilityIds.length > 0) {
        await admin.from('shifts').delete().in('facility_id', allFacilityIds)
      }
      if (agencyId) {
        const { data: phFacs2 } = await admin
          .from('placeholder_facilities')
          .select('id')
          .eq('agency_id', agencyId)
        const ph2 = (phFacs2 ?? []).map(p => p.id)
        if (ph2.length > 0) {
          await admin.from('shifts').delete().in('placeholder_facility_id', ph2)
        }
      }

      // 4. Placeholder facilities
      if (agencyId) {
        const { data: phs } = await admin
          .from('placeholder_facilities')
          .select('id')
          .eq('agency_id', agencyId)
        const phIds3 = (phs ?? []).map(p => p.id)
        if (phIds3.length > 0) {
          await admin.from('connection_requests').delete().in('placeholder_id', phIds3)
          await admin.from('placeholder_confirm_tokens').delete().in('shift_id', []) // placeholder_tokens by shift — no-op here
          await admin.from('placeholder_facilities').delete().eq('agency_id', agencyId)
        }
      }

      // 5. Connection requests (by agency)
      if (agencyId) {
        await admin.from('connection_requests').delete().eq('agency_id', agencyId)
      }

      // 6. Agency nurse relationships
      if (nurseProfileIds.length > 0) {
        await admin.from('agency_nurse_relationships').delete().in('nurse_profile_id', nurseProfileIds)
      }

      // 7. Facility shift configs
      if (allFacilityIds.length > 0) {
        await admin.from('facility_shift_configs').delete().in('facility_id', allFacilityIds)
      }

      // 8. Agency facility connections
      if (agencyId) {
        await admin.from('agency_facility_connections').delete().eq('agency_id', agencyId)
      }

      // 9. Facility admins + agency admins
      if (facilityId) await admin.from('facility_admins').delete().eq('profile_id', userId)
      if (agencyId)   await admin.from('agency_admins').delete().eq('profile_id', userId)

      // 10. Nurse profiles — delete auth user (cascades to profiles); then nurse_profiles explicitly
      for (const npId of nurseProfileIds) {
        const { data: np } = await admin.from('nurse_profiles').select('profile_id').eq('id', npId).single()
        if (np?.profile_id && np.profile_id !== userId) {
          // Deleting the auth user cascades to profiles via ON DELETE CASCADE
          await admin.auth.admin.deleteUser(np.profile_id)
        }
        await admin.from('nurse_profiles').delete().eq('id', npId)
      }

      // 11. Facilities
      for (const fid of allFacilityIds) {
        await admin.from('facilities').delete().eq('id', fid)
      }

      // 12. Agency
      if (agencyId) {
        await admin.from('agencies').delete().eq('id', agencyId)
      }

      // 13. Demo user profile
      await admin.from('profiles').delete().eq('id', userId)

      // 14. Auth user
      await admin.auth.admin.deleteUser(userId)

      // 15. Demo session row
      await adminAny.from('demo_sessions').delete().eq('id', session.id)

      cleaned++
    } catch (err) {
      console.error('[demo/cleanup] error cleaning session', session.id, err)
      errors.push(String(session.id))
    }
  }

  return NextResponse.json({ cleaned, errors: errors.length > 0 ? errors : undefined })
}
