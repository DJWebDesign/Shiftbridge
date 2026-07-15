'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ── Icon library ──────────────────────────────────────────────────────────────
function Icon({ d, d2 }: { d: string; d2?: string }) {
  return (
    <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor"
      viewBox="0 0 24 24" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
      {d2 && <path d={d2} />}
    </svg>
  )
}

const ICONS: Record<string, React.ReactNode> = {
  dashboard:   <Icon d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" d2="M9 22V12h6v10" />,
  staff:       <Icon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" d2="M9 7a4 4 0 100 8 4 4 0 000-8zm14 14v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />,
  shifts:      <Icon d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
  facilities:  <Icon d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />,
  settings:    <Icon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />,
  claims:      <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />,
  available:   <Icon d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
  schedule:    <Icon d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
  accounts:    <Icon d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />,
  connections: <Icon d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />,
}

// ── Types ─────────────────────────────────────────────────────────────────────
export type NavLink = {
  href: string
  label: string
  icon: string
  pill?: string
  pillColor?: 'teal' | 'amber' | 'red'
}

interface SidebarNavProps {
  navLinks: NavLink[]
  userName: string
  userRole: string
  bell?: React.ReactNode
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SidebarNav({ navLinks, userName, userRole, bell }: SidebarNavProps) {
  const pathname = usePathname()

  // Longest matching href wins (so /staff beats /agency/123 on the staff page)
  const activeHref = navLinks
    .filter(l => pathname === l.href || pathname.startsWith(l.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href

  const initials = userName
    .split(' ')
    .map(w => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <aside
      className="flex flex-col flex-shrink-0 h-full overflow-hidden"
      style={{ width: 252, background: '#0D1B2A' }}
    >
      {/* Logo */}
      <div className="px-5 py-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #0D9488, #0891B2)' }}
          >
            {/* Bridge / arch icon */}
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2}
              viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 18 Q4 10 12 10 Q20 10 20 18" />
              <path d="M4 18h16" />
              <path d="M8 18v-4" />
              <path d="M16 18v-4" />
            </svg>
          </div>
          <div>
            <p className="font-serif text-[17px] leading-tight" style={{ color: '#F1F5F9' }}>
              ShiftBridge
            </p>
            <p className="text-[10.5px] font-medium tracking-[0.04em] mt-0.5" style={{ color: '#4A6080' }}>
              {userRole}
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-bold tracking-[0.1em] uppercase px-3 mb-3"
          style={{ color: '#3D5166' }}>
          Navigation
        </p>
        {navLinks.map(link => {
          const active = link.href === activeHref
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2.5 px-3 py-[9px] mx-1 rounded-lg text-[13.5px] font-medium transition-all"
              style={{
                color:       active ? '#2DD4BF' : '#7B93AB',
                background:  active ? 'rgba(13,148,136,0.14)' : 'transparent',
                borderLeft:  `2px solid ${active ? '#0D9488' : 'transparent'}`,
              }}
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
              }}
              onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              <span style={{ color: active ? '#2DD4BF' : '#5A7A96' }}>
                {ICONS[link.icon] ?? null}
              </span>
              {link.label}
              {link.pill && (
                <span
                  className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: link.pillColor === 'amber' ? 'rgba(245,158,11,0.18)'
                              : link.pillColor === 'red'   ? 'rgba(239,68,68,0.18)'
                              : 'rgba(45,212,191,0.18)',
                    color:      link.pillColor === 'amber' ? '#FBBF24'
                              : link.pillColor === 'red'   ? '#F87171'
                              : '#2DD4BF',
                  }}
                >
                  {link.pill}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2.5">
          {/* Avatar */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0"
            style={{ background: 'rgba(13,148,136,0.25)', color: '#2DD4BF' }}
          >
            {initials}
          </div>

          {/* Name */}
          <p className="flex-1 min-w-0 text-[13px] font-medium truncate" style={{ color: '#94A3B8' }}>
            {userName}
          </p>

          {/* Notification bell (passed from layout) */}
          {bell}

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="p-1.5 rounded-md transition-colors flex-shrink-0"
            style={{ color: '#3D5166' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#7B93AB' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#3D5166' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
              strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
