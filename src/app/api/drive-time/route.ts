import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDriveTimes } from '@/lib/google-maps/drive-time'
import { isDemoUser } from '@/lib/demo/context'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'nurse' && !isDemoUser(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { facility_ids, placeholder_facility_ids } = body as {
    facility_ids: string[]
    placeholder_facility_ids?: string[]
  }

  const realIds = Array.isArray(facility_ids) ? facility_ids : []
  const phIds   = Array.isArray(placeholder_facility_ids) ? placeholder_facility_ids : []

  if (realIds.length === 0 && phIds.length === 0) {
    return NextResponse.json({ error: 'facility_ids or placeholder_facility_ids must be non-empty' }, { status: 400 })
  }
  if (realIds.length > 25 || phIds.length > 25) {
    return NextResponse.json({ error: 'Maximum 25 facilities per request' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch nurse's home coordinates via service-role — never sent to client
  const { data: nurseProfile } = await admin
    .from('nurse_profiles')
    .select('home_address_lat, home_address_lng')
    .eq('profile_id', user.id)
    .single()

  if (!nurseProfile?.home_address_lat || !nurseProfile?.home_address_lng) {
    const result: Record<string, number | null> = {}
    for (const id of [...realIds, ...phIds]) result[id] = null
    return NextResponse.json({ minutes: result })
  }

  const origin = {
    lat: Number(nurseProfile.home_address_lat),
    lng: Number(nurseProfile.home_address_lng),
  }

  const result: Record<string, number | null> = {}

  // ── Real facilities ──────────────────────────────────────────────────────────
  if (realIds.length > 0) {
    const { data: facilities } = await admin
      .from('facilities')
      .select('id, lat, lng')
      .in('id', realIds)

    const destinations = realIds.map(id => {
      const fac = (facilities ?? []).find(f => f.id === id)
      return fac?.lat && fac?.lng ? { lat: Number(fac.lat), lng: Number(fac.lng) } : null
    })

    if (destinations.some(d => d !== null)) {
      const driveResults = await getDriveTimes(origin, destinations.map(d => d ?? { lat: 0, lng: 0 }))
      for (let i = 0; i < realIds.length; i++) {
        result[realIds[i]] = destinations[i] !== null ? (driveResults[i]?.minutes ?? null) : null
      }
    } else {
      for (const id of realIds) result[id] = null
    }
  }

  // ── Placeholder facilities ───────────────────────────────────────────────────
  if (phIds.length > 0) {
    const { data: placeholders } = await admin
      .from('placeholder_facilities')
      .select('id, lat, lng')
      .in('id', phIds)

    const phDestinations = phIds.map(id => {
      const ph = (placeholders ?? []).find(p => p.id === id)
      return ph?.lat && ph?.lng ? { lat: Number(ph.lat), lng: Number(ph.lng) } : null
    })

    if (phDestinations.some(d => d !== null)) {
      const driveResults = await getDriveTimes(origin, phDestinations.map(d => d ?? { lat: 0, lng: 0 }))
      for (let i = 0; i < phIds.length; i++) {
        result[phIds[i]] = phDestinations[i] !== null ? (driveResults[i]?.minutes ?? null) : null
      }
    } else {
      for (const id of phIds) result[id] = null
    }
  }

  // ── Persist real facility results to DB cache (placeholder results not cached) ─
  const { data: np } = await admin
    .from('nurse_profiles')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (np && realIds.length > 0) {
    const rows = realIds
      .filter(id => result[id] !== null)
      .map(id => ({
        nurse_profile_id: np.id,
        facility_id: id,
        minutes: result[id],
        calculated_at: new Date().toISOString(),
      }))

    if (rows.length > 0) {
      await admin
        .from('nurse_drive_times')
        .upsert(rows, { onConflict: 'nurse_profile_id,facility_id' })
    }
  }

  return NextResponse.json({ minutes: result })
}
