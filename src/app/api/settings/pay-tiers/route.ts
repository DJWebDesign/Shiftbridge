import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDemoUser } from '@/lib/demo/context'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'agency_admin' && !isDemoUser(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: agencyAdmin } = await supabase
    .from('agency_admins')
    .select('agency_id')
    .eq('profile_id', user.id)
    .single()

  if (!agencyAdmin) {
    return NextResponse.json({ error: 'Agency not found' }, { status: 403 })
  }

  const agencyId = agencyAdmin.agency_id
  const body = await request.json()
  const { tiers } = body as {
    tiers: Array<{
      tier_number: 1 | 2 | 3
      custom_label: string
      bonus_amount: number
      bonus_type: 'per_hour' | 'flat'
    }>
  }

  if (!Array.isArray(tiers) || tiers.length !== 3) {
    return NextResponse.json({ error: 'Must provide exactly 3 tiers' }, { status: 400 })
  }

  const admin = createAdminClient()

  const rows = tiers.map(t => ({
    agency_id:    agencyId,
    tier_number:  t.tier_number,
    custom_label: t.custom_label?.trim() ?? '',
    bonus_amount: Number(t.bonus_amount) || 0,
    bonus_type:   t.bonus_type,
  }))

  const { error } = await admin
    .from('pay_tier_configs')
    .upsert(rows, { onConflict: 'agency_id,tier_number' })

  if (error) {
    console.error('[settings/pay-tiers] error:', error)
    return NextResponse.json({ error: 'Failed to save pay tiers' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
