import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (user.app_metadata?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { accountId, action } = await req.json() as {
    accountId: string
    action: 'suspend' | 'activate' | 'reset_password'
  }

  if (!accountId || !action) {
    return NextResponse.json({ error: 'accountId and action are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  if (action === 'suspend') {
    const { error } = await admin
      .from('profiles')
      .update({ is_active: false })
      .eq('id', accountId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Also ban the user in auth so they can't log in
    const { error: authErr } = await admin.auth.admin.updateUserById(accountId, {
      ban_duration: '876600h', // ~100 years
    })
    if (authErr) console.warn('[admin] auth ban failed:', authErr.message)

    return NextResponse.json({ ok: true })
  }

  if (action === 'activate') {
    const { error } = await admin
      .from('profiles')
      .update({ is_active: true })
      .eq('id', accountId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Lift the ban
    const { error: authErr } = await admin.auth.admin.updateUserById(accountId, {
      ban_duration: 'none',
    })
    if (authErr) console.warn('[admin] auth unban failed:', authErr.message)

    return NextResponse.json({ ok: true })
  }

  if (action === 'reset_password') {
    // Fetch the user's email first
    const { data: profile } = await admin
      .from('profiles')
      .select('email')
      .eq('id', accountId)
      .single()

    if (!profile?.email) {
      return NextResponse.json({ error: 'User email not found' }, { status: 404 })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

    const { error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: profile.email,
      options: {
        redirectTo: `${siteUrl}/reset-password`,
      },
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
