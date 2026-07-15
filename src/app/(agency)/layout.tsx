import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SidebarNav from '@/components/layout/SidebarNav'
import NotificationBell from '@/components/notifications/NotificationBell'
import type { AppNotification } from '@/hooks/useNotifications'

export default async function AgencyLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'agency_admin') redirect('/login')

  const [{ data: profile }, { data: agencyAdmin }, { data: rawNotifications }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    supabase.from('agency_admins').select('agency_id').eq('profile_id', user.id).single(),
    supabase.from('notifications').select('id, event_type, message, read_at, created_at, payload')
      .eq('profile_id', user.id).eq('channel', 'in_app')
      .order('created_at', { ascending: false }).limit(30),
  ])
  const initialNotifications = (rawNotifications ?? []) as AppNotification[]

  const agencyId = agencyAdmin?.agency_id
  const userName = profile?.full_name ?? user.email ?? 'Agency Admin'

  const navLinks = agencyId ? [
    { href: `/agency/${agencyId}`,           label: 'Dashboard',  icon: 'dashboard'  },
    { href: `/agency/${agencyId}/staff`,      label: 'Staff',      icon: 'staff'      },
    { href: `/agency/${agencyId}/shifts`,     label: 'Shifts',     icon: 'shifts'     },
    { href: `/agency/${agencyId}/facilities`, label: 'Facilities', icon: 'facilities' },
    { href: `/agency/${agencyId}/settings`,   label: 'Settings',   icon: 'settings'   },
  ] : []

  return (
    <div className="flex h-full">
      <SidebarNav
        navLinks={navLinks}
        userName={userName}
        userRole="Agency Admin"
        bell={
          <NotificationBell
            profileId={user.id}
            initialNotifications={initialNotifications}
            variant="dark"
            role="agency_admin"
            entityId={agencyId}
          />
        }
      />
      <main className="flex-1 overflow-y-auto" style={{ background: '#F4F7FA' }}>
        <div className="max-w-7xl mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
