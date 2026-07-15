'use client'

import { useState, useEffect } from 'react'

/**
 * Fetches driving minutes from the nurse's home to each facility.
 * Handles both real facilities (facility_id) and placeholder facilities (placeholder_facility_id).
 * - initialDriveTimes: pre-loaded from DB server-side (real facilities only)
 * - Placeholder facility drive times are always fetched fresh (no DB cache for them)
 * - Results keyed by facility ID (real or placeholder) in the same map
 */
export function useDriveTime(
  facilityIds: string[],
  placeholderFacilityIds: string[],
  initialDriveTimes: Record<string, number | null> = {}
): Record<string, number | null> {
  const [minutes, setMinutes] = useState<Record<string, number | null>>(initialDriveTimes)

  useEffect(() => {
    const uncachedReal = facilityIds.filter(id => !(id in initialDriveTimes))
    // Placeholder IDs are never in the DB cache — always fetch them
    const allToFetch = [...uncachedReal, ...placeholderFacilityIds]

    if (allToFetch.length === 0) return

    // Split into chunks of 25 (API limit)
    const realChunks: string[][] = []
    for (let i = 0; i < uncachedReal.length; i += 25) {
      realChunks.push(uncachedReal.slice(i, i + 25))
    }
    const phChunks: string[][] = []
    for (let i = 0; i < placeholderFacilityIds.length; i += 25) {
      phChunks.push(placeholderFacilityIds.slice(i, i + 25))
    }

    let cancelled = false

    async function fetchAll() {
      const fetched: Record<string, number | null> = {}

      // Fetch real facility drive times
      for (const chunk of realChunks) {
        try {
          const res = await fetch('/api/drive-time', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ facility_ids: chunk }),
          })
          if (res.ok) {
            const json = await res.json()
            Object.assign(fetched, json.minutes ?? {})
          }
        } catch { /* drive time is a nice-to-have */ }
      }

      // Fetch placeholder facility drive times
      for (const chunk of phChunks) {
        try {
          const res = await fetch('/api/drive-time', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ facility_ids: [], placeholder_facility_ids: chunk }),
          })
          if (res.ok) {
            const json = await res.json()
            Object.assign(fetched, json.minutes ?? {})
          }
        } catch { /* drive time is a nice-to-have */ }
      }

      if (cancelled) return
      setMinutes(prev => ({ ...prev, ...fetched }))
    }

    fetchAll()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityIds.join(','), placeholderFacilityIds.join(',')])

  return minutes
}
