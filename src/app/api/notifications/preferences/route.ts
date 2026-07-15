import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from('notification_preferences')
    .select('preferences')
    .eq('profile_id', user.id)
    .single()

  return NextResponse.json({ preferences: data?.preferences ?? {} })
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { preferences } = body

  if (!preferences || typeof preferences !== 'object') {
    return NextResponse.json({ error: 'preferences must be an object' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('notification_preferences')
    .upsert({ profile_id: user.id, preferences, updated_at: new Date().toISOString() }, { onConflict: 'profile_id' })

  if (error) {
    console.error('[notifications/preferences PUT] error:', error)
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
