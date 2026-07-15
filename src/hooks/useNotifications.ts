'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export type AppNotification = {
  id: string
  event_type: string
  message: string
  read_at: string | null
  created_at: string
  payload: Record<string, unknown>
}

export function useNotifications(profileId: string, initial: AppNotification[]) {
  const [notifications, setNotifications] = useState<AppNotification[]>(initial)

  // Realtime: subscribe to new in-app notifications for this user
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`notifications-${profileId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `profile_id=eq.${profileId}`,
        },
        (payload) => {
          const n = payload.new as AppNotification & { channel: string }
          // Only surface in-app notifications in the bell
          if (n.channel === 'in_app') {
            setNotifications(prev => [n, ...prev].slice(0, 50))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profileId])

  const unreadCount = notifications.filter(n => !n.read_at).length

  async function markRead(id: string) {
    const now = new Date().toISOString()
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read_at: now } : n)
    )
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('id', id)
  }

  async function markAllRead() {
    const now = new Date().toISOString()
    const unreadIds = notifications.filter(n => !n.read_at).map(n => n.id)
    if (unreadIds.length === 0) return

    setNotifications(prev =>
      prev.map(n => !n.read_at ? { ...n, read_at: now } : n)
    )
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ read_at: now })
      .in('id', unreadIds)
  }

  return { notifications, unreadCount, markRead, markAllRead }
}
