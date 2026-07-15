import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SidebarNav from '@/components/layout/SidebarNav'
import NotificationBell from '@/components/notifications/NotificationBell'
import type { AppNotification } from '@/hooks/useNotifications'

export default async function NurseLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'nurse') redirect('/login')

  const [{ data: profile }, { data: rawNotifications }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    supabase.from('notifications').select('id, event_type, message, read_at, created_at, payload')
      .eq('profile_id', user.id).eq('channel', 'in_app')
      .order('created_at', { ascending: false }).limit(30),
  ])
  const initialNotifications = (rawNotifications ?? []) as AppNotification[]

  const userName = profile?.full_name ?? user.email ?? 'Nurse'

  const navLinks = [
    { href: '/nurse',          label: 'Available Shifts', icon: 'available' },
    { href: '/nurse/schedule', label: 'My Schedule',      icon: 'schedule'  },
    { href: '/nurse/settings', label: 'Settings',         icon: 'settings'  },
  ]

  return (
    <div className="flex h-full">
      <SidebarNav
        navLinks={navLinks}
        userName={userName}
        userRole="Nurse"
        bell={
          <NotificationBell
            profileId={user.id}
            initialNotifications={initialNotifications}
            variant="dark"
            role="nurse"
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
