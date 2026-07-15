'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useTour } from '@/lib/tour/context'

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
  dashboard:  <Icon d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" d2="M9 22V12h6v10" />,
  staff:      <Icon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" d2="M9 7a4 4 0 100 8 4 4 0 000-8zm14 14v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />,
  shifts:     <Icon d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
  facilities: <Icon d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />,
  claims:     <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />,
  available:  <Icon d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
  schedule:   <Icon d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
  settings:   <Icon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />,
}

function NavLink({ href, label, icon, pill, tourId }: { href: string; label: string; icon: string; pill?: string; tourId?: string }) {
  const pathname = usePathname()
  // Active if exact match or starts with href + '/'
  const active = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      data-tour-id={tourId}
      className="flex items-center gap-2.5 px-3 py-[9px] mx-1 rounded-lg text-[13.5px] font-medium transition-all"
      style={{
        color:      active ? '#2DD4BF' : '#7B93AB',
        background: active ? 'rgba(13,148,136,0.14)' : 'transparent',
        borderLeft: `2px solid ${active ? '#0D9488' : 'transparent'}`,
      }}
      onMouseEnter={e => {
        if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
      }}
      onMouseLeave={e => {
        if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
    >
      <span style={{ color: active ? '#2DD4BF' : '#5A7A96' }}>
        {ICONS[icon] ?? null}
      </span>
      {label}
      {pill && (
        <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(245,158,11,0.18)', color: '#FBBF24' }}>
          {pill}
        </span>
      )}
    </Link>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9.5px] font-bold tracking-[0.1em] uppercase px-3 mt-4 mb-1.5"
      style={{ color: '#3D5166' }}>
      {children}
    </p>
  )
}

function Divider() {
  return <div className="mx-4 my-2" style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
}

function useCountdown(expiresAt: string) {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    function update() {
      const diff = new Date(expiresAt).getTime() - Date.now()
      if (diff <= 0) { setRemaining('Expired'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setRemaining(h > 0 ? `${h}h ${m}m` : `${m}m`)
    }
    update()
    const id = setInterval(update, 30000)
    return () => clearInterval(id)
  }, [expiresAt])

  return remaining
}

export interface DemoSidebarNavProps {
  agencyId: string
  facilityId: string
  userName: string
  expiresAt: string
}

export default function DemoSidebarNav({ agencyId, facilityId, userName, expiresAt }: DemoSidebarNavProps) {
  const countdown = useCountdown(expiresAt)
  const { active, restart } = useTour()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const initials = userName
    .split(' ')
    .map(w => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <aside
      className="flex flex-col flex-shrink-0 h-full overflow-hidden"
      style={{ width: 252, background: '#0D1B2A' }}
    >
      {/* Logo + DEMO badge */}
      <div className="px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #0D9488, #0891B2)' }}
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2}
              viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 18 Q4 10 12 10 Q20 10 20 18" />
              <path d="M4 18h16" />
              <path d="M8 18v-4" />
              <path d="M16 18v-4" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-serif text-[17px] leading-tight" style={{ color: '#F1F5F9' }}>
                ShiftBridge
              </p>
              <span className="text-[9px] font-bold tracking-[0.08em] px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(13,148,136,0.25)', color: '#2DD4BF' }}>
                DEMO
              </span>
            </div>
            <p className="text-[10px] mt-0.5 truncate" style={{ color: '#3D5166' }}>
              Session expires in {countdown}
            </p>
          </div>
        </div>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto">

        {/* Agency Admin section */}
        <SectionLabel>Agency Admin</SectionLabel>
        <NavLink href={`/demo/agency/${agencyId}`}             label="Dashboard"  icon="dashboard"  />
        <NavLink href={`/demo/agency/${agencyId}/staff`}       label="Staff"      icon="staff"      />
        <NavLink href={`/demo/agency/${agencyId}/shifts`}      label="Shifts"     icon="shifts"     tourId="nav-agency-shifts" />
        <NavLink href={`/demo/agency/${agencyId}/facilities`}  label="Facilities" icon="facilities" tourId="nav-facilities" />

        <Divider />

        {/* Facility Admin section */}
        <SectionLabel>Facility Admin</SectionLabel>
        <NavLink href={`/demo/facility/${facilityId}`}          label="Dashboard" icon="dashboard" />
        <NavLink href={`/demo/facility/${facilityId}/shifts`}   label="Shifts"    icon="shifts"    />
        <NavLink href={`/demo/facility/${facilityId}/claims`}   label="Claims"    icon="claims"    tourId="nav-facility-claims" />
        <NavLink href={`/demo/facility/${facilityId}/staff`}    label="Staff"     icon="staff"     />

        <Divider />

        {/* Nurse section */}
        <SectionLabel>Nurse</SectionLabel>
        <NavLink href="/demo/nurse"          label="Available Shifts" icon="available" tourId="nav-nurse-shifts" />
        <NavLink href="/demo/nurse/schedule" label="My Schedule"      icon="schedule"  tourId="nav-nurse-schedule" />

      </nav>

      {/* User footer */}
      <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {!active && (
          <button
            onClick={restart}
            className="w-full text-center mb-3 text-[11px] font-medium"
            style={{ color: '#2DD4BF', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}
          >
            ↺ Restart guided tour
          </button>
        )}
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0"
            style={{ background: 'rgba(13,148,136,0.25)', color: '#2DD4BF' }}
          >
            {initials}
          </div>
          <p className="flex-1 min-w-0 text-[13px] font-medium truncate" style={{ color: '#94A3B8' }}>
            {userName}
          </p>
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
