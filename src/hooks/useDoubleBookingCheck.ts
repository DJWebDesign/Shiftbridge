'use client'

import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

function timesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return s1 < e2 && s2 < e1
}

interface ConflictInfo {
  shift_date: string
  start_time: string
  end_time: string
}

/**
 * Client-side pre-check for double bookings.
 * Returns a stable `check` function that queries the nurse's confirmed shifts
 * and tests for time overlap. The API does the authoritative server-side check.
 */
export function useDoubleBookingCheck(nurseProfileId: string) {
  const [checking, setChecking] = useState(false)

  const check = useCallback(async (
    shiftDate: string,
    startTime: string,
    endTime: string
  ): Promise<ConflictInfo | null> => {
    setChecking(true)
    try {
      const supabase = createClient()

      // Get all active claims (confirmed or pending) for this nurse
      const { data: activeClaims } = await supabase
        .from('shift_claims')
        .select('shift_id, status')
        .eq('nurse_profile_id', nurseProfileId)
        .in('status', ['confirmed', 'pending'])

      if (!activeClaims || activeClaims.length === 0) return null

      const shiftIds = activeClaims.map(c => c.shift_id)

      // Get the shifts for that date
      const { data: activeShifts } = await supabase
        .from('shifts')
        .select('shift_date, start_time, end_time')
        .in('id', shiftIds)
        .eq('shift_date', shiftDate)

      if (!activeShifts) return null

      return activeShifts.find(s =>
        timesOverlap(startTime, endTime, s.start_time, s.end_time)
      ) ?? null
    } finally {
      setChecking(false)
    }
  }, [nurseProfileId])

  return { check, checking }
}
