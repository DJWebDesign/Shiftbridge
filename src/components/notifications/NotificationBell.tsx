'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useNotifications, type AppNotification } from '@/hooks/useNotifications'

function getNotificationHref(
  eventType: string,
  _payload: Record<string, unknown>,
  role: string | undefined,
  entityId: string | undefined,
): string | null {
  if (role === 'facility_admin' && entityId) {
    if (eventType === 'shift_claimed') return `/facility/${entityId}/claims`
    if (eventType === 'connection_requested') return `/facility/${entityId}`
    if (eventType === 'connection_accepted') return `/facility/${entityId}`
    if (eventType === 'connection_declined') return `/facility/${entityId}`
  }
  if (role === 'agency_admin' && entityId) {
    if (eventType === 'new_claim') return `/agency/${entityId}`
    if (eventType === 'shift_claimed') return `/agency/${entityId}`
    if (eventType === 'shift_confirmed') return `/agency/${entityId}/shifts`
    if (eventType === 'shift_canceled') return `/agency/${entityId}/shifts`
    if (eventType === 'dnr_issued') return `/agency/${entityId}/staff`
    if (eventType === 'connection_accepted') return `/agency/${entityId}/facilities`
    if (eventType === 'connection_declined') return `/agency/${entityId}/facilities`
  }
  if (role === 'nurse') {
    if (eventType === 'shift_confirmed') return '/nurse/schedule'
    if (eventType === 'shift_filled') return '/nurse'
    if (eventType === 'shift_canceled') return '/nurse/schedule'
  }
  return null
}

const EVENT_ICONS: Record<string, string> = {
  shift_claimed:       '📋',
  shift_confirmed:     '✅',
  shift_filled:        'ℹ️',
  shift_canceled:      '❌',
  dnr_issued:          '🚫',
  credential_expiring: '⚠️',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

interface Props {
  profileId: string
  initialNotifications: AppNotification[]
  /** 'dark' = for use on dark sidebar background; 'light' = default white topbar */
  variant?: 'light' | 'dark'
  role?: string
  entityId?: string
}

export default function NotificationBell({ profileId, initialNotifications, variant = 'light', role, entityId }: Props) {
  const isDark = variant === 'dark'
  const router = useRouter()
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications(profileId, initialNotifications)
  const [open, setOpen] = useState(false)
  // For dark variant: fixed position so dropdown escapes sidebar's overflow:hidden
  const [fixedPos, setFixedPos] = useState<{ bottom: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleToggle() {
    if (!open && isDark && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      // Anchor dropdown's bottom edge just above the button, open to the right
      setFixedPos({ bottom: window.innerHeight - rect.top + 4, left: rect.right + 12 })
    }
    setOpen(prev => !prev)
  }

  async function handleClickNotification(n: AppNotification) {
    if (!n.read_at) await markRead(n.id)
    const href = getNotificationHref(n.event_type, n.payload, role, entityId)
    if (href) {
      setOpen(false)
      router.push(href)
    }
  }

  const dropdownContent = (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#F1F5F9' }}>
        <span className="text-sm font-semibold" style={{ color: '#0D1B2A' }}>Notifications</span>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs font-medium transition-colors"
            style={{ color: '#0D9488' }}
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto divide-y" style={{ borderColor: '#F8FAFC' }}>
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm" style={{ color: '#94A3B8' }}>
            No notifications yet
          </div>
        ) : (
          notifications.map(n => {
            const href = getNotificationHref(n.event_type, n.payload, role, entityId)
            return (
              <button
                key={n.id}
                onClick={() => handleClickNotification(n)}
                className="w-full text-left px-4 py-3 flex gap-3 transition-colors"
                style={{ background: !n.read_at ? 'rgba(13,148,136,0.04)' : 'transparent', cursor: href ? 'pointer' : 'default' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F8FAFC' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = !n.read_at ? 'rgba(13,148,136,0.04)' : 'transparent' }}
              >
                <span className="text-base shrink-0 mt-0.5">{EVENT_ICONS[n.event_type] ?? '🔔'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug"
                    style={{ color: !n.read_at ? '#0D1B2A' : '#5B6B80', fontWeight: !n.read_at ? 500 : 400 }}>
                    {n.message}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{timeAgo(n.created_at)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                  {!n.read_at && (
                    <span className="w-2 h-2 rounded-full" style={{ background: '#0D9488' }} />
                  )}
                  {href && (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ color: '#94A3B8' }}>
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>
    </>
  )

  return (
    <div className="relative flex-shrink-0">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="relative p-1.5 rounded-md transition-colors"
        style={{ color: isDark ? '#3D5166' : '#6B7280' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = isDark ? '#7B93AB' : '#111827' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = isDark ? '#3D5166' : '#6B7280' }}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 w-[14px] h-[14px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dark variant: fixed portal so it escapes sidebar overflow:hidden */}
      {open && isDark && fixedPos && (
        <div
          ref={dropdownRef}
          className="fixed w-80 bg-white rounded-xl border shadow-lg overflow-hidden"
          style={{ borderColor: '#E4EAF0', bottom: fixedPos.bottom, left: fixedPos.left, zIndex: 9999 }}
        >
          {dropdownContent}
        </div>
      )}

      {/* Light variant: normal absolute positioning */}
      {open && !isDark && (
        <div
          ref={dropdownRef}
          className="absolute right-0 mt-1 w-80 bg-white rounded-xl border shadow-lg overflow-hidden"
          style={{ borderColor: '#E4EAF0', top: '100%', zIndex: 50 }}
        >
          {dropdownContent}
        </div>
      )}
    </div>
  )
}
