'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type Shift = Database['public']['Tables']['shifts']['Row']

interface RealtimeCallbacks {
  onInsert?: (shift: Shift) => void
  onUpdate?: (shift: Shift) => void
  onDelete?: (id: string) => void
}

/**
 * Subscribes to real-time changes on the shifts table for a given facility.
 * Uses a ref for callbacks so re-renders never trigger re-subscription.
 */
export function useRealtimeShifts(facilityId: string, callbacks: RealtimeCallbacks) {
  const cbRef = useRef(callbacks)
  cbRef.current = callbacks

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`shifts-facility-${facilityId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shifts',
          filter: `facility_id=eq.${facilityId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            cbRef.current.onInsert?.(payload.new as Shift)
          } else if (payload.eventType === 'UPDATE') {
            cbRef.current.onUpdate?.(payload.new as Shift)
          } else if (payload.eventType === 'DELETE') {
            cbRef.current.onDelete?.((payload.old as { id: string }).id)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [facilityId])
}
