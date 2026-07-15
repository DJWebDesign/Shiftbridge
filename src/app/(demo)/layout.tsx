import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import DemoSidebarNav from '@/components/layout/DemoSidebarNav'
import { TourProvider } from '@/lib/tour/context'
import TourEmailModal from '@/components/tour/TourEmailModal'
import TourTooltip from '@/components/tour/TourTooltip'

export default async function DemoLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'demo') redirect('/login')

  const agencyId: string = user.app_metadata?.agency_id ?? ''
  const facilityId: string = user.app_metadata?.facility_id ?? ''

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: session } = await (admin as any)
    .from('demo_sessions')
    .select('expires_at')
    .eq('auth_user_id', user.id)
    .single()

  const userName = profile?.full_name ?? 'Demo User'
  const expiresAt = session?.expires_at ?? new Date(Date.now() + 4 * 3600000).toISOString()

  return (
    <TourProvider userId={user.id}>
      <div className="flex h-full">
        <DemoSidebarNav
          agencyId={agencyId}
          facilityId={facilityId}
          userName={userName}
          expiresAt={expiresAt}
        />
        <main className="flex-1 overflow-y-auto" style={{ background: '#F4F7FA' }}>
          <div className="max-w-7xl mx-auto px-8 py-8">
            {children}
          </div>
        </main>
      </div>
      <TourEmailModal />
      <TourTooltip />
    </TourProvider>
  )
}
