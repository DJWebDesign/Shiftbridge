import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SidebarNav from '@/components/layout/SidebarNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'super_admin') redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const userName = profile?.full_name ?? user.email ?? 'Admin'

  const navLinks = [
    { href: '/admin',             label: 'Platform Overview', icon: 'dashboard'   },
    { href: '/admin/accounts',    label: 'Accounts',          icon: 'accounts'    },
    { href: '/admin/connections', label: 'Connections',        icon: 'connections' },
  ]

  return (
    <div className="flex h-full">
      <SidebarNav
        navLinks={navLinks}
        userName={userName}
        userRole="Super Admin"
      />
      <main className="flex-1 overflow-y-auto" style={{ background: '#F4F7FA' }}>
        <div className="max-w-7xl mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
