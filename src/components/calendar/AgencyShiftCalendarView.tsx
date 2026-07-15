'use client'

import { useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import ShiftCalendar from '@/components/calendar/ShiftCalendar'
import AgencyShiftDayPanel from '@/components/calendar/AgencyShiftDayPanel'
import type { Database } from '@/lib/supabase/types'

type Shift = Database['public']['Tables']['shifts']['Row']

interface PlaceholderFacility {
  id: string
  name: string
}

interface RealFacility {
  id: string
  name: string
}

interface Props {
  agencyId: string
  initialShifts: Shift[]
  initialYear: number
  initialMonth: number  // 0-indexed
  placeholderFacilities: PlaceholderFacility[]
  connectedFacilities: RealFacility[]
  facilityNames: Record<string, string>
  /** When set, month nav only fetches shifts for this one facility_id */
  filterFacilityId?: string
  /** When set, month nav only fetches shifts for this one placeholder_facility_id */
  filterPlaceholderId?: string
}

export default function AgencyShiftCalendarView({
  agencyId,
  initialShifts,
  initialYear,
  initialMonth,
  placeholderFacilities,
  connectedFacilities,
  facilityNames,
  filterFacilityId,
  filterPlaceholderId,
}: Props) {
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [shifts, setShifts] = useState<Shift[]>(initialShifts)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function loadShifts(y: number, m: number) {
    setLoading(true)
    const supabase = createClient()
    const from = `${y}-${String(m + 1).padStart(2, '0')}-01`
    const lastDay = new Date(y, m + 1, 0).getDate()
    const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    // Fetch shifts — optionally filtered to a single facility or placeholder
    let query = supabase
      .from('shifts')
      .select('*')
      .gte('shift_date', from)
      .lte('shift_date', to)
      .order('shift_date')
      .order('start_time')

    if (filterFacilityId) {
      query = query.eq('facility_id', filterFacilityId)
    } else if (filterPlaceholderId) {
      query = query.eq('placeholder_facility_id', filterPlaceholderId)
    }

    const { data } = await query

    setShifts(data ?? [])
    setLoading(false)
  }

  function goToPrevMonth() {
    const newMonth = month === 0 ? 11 : month - 1
    const newYear = month === 0 ? year - 1 : year
    setMonth(newMonth); setYear(newYear)
    setSelectedDate(null)
    loadShifts(newYear, newMonth)
  }

  function goToNextMonth() {
    const newMonth = month === 11 ? 0 : month + 1
    const newYear = month === 11 ? year + 1 : year
    setMonth(newMonth); setYear(newYear)
    setSelectedDate(null)
    loadShifts(newYear, newMonth)
  }

  const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}-`

  const handleInsert = useCallback((shift: Shift) => {
    if (!shift.shift_date.startsWith(currentMonthPrefix)) return
    setShifts(prev => {
      if (prev.some(s => s.id === shift.id)) return prev
      return [...prev, shift]
    })
  }, [currentMonthPrefix])

  const handleUpdate = useCallback((shift: Shift) => {
    if (!shift.shift_date.startsWith(currentMonthPrefix)) return
    setShifts(prev => prev.map(s => s.id === shift.id ? shift : s))
  }, [currentMonthPrefix])

  const shiftsByDate = useMemo(() => {
    const map: Record<string, Shift[]> = {}
    for (const shift of shifts) {
      if (!map[shift.shift_date]) map[shift.shift_date] = []
      map[shift.shift_date].push(shift)
    }
    return map
  }, [shifts])

  function handleShiftPosted(newShifts: Shift[]) {
    setShifts(prev => {
      const ids = new Set(prev.map(s => s.id))
      return [...prev, ...newShifts.filter(s => !ids.has(s.id))]
    })
  }

  function handleShiftCanceled(shiftId: string) {
    setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, status: 'canceled' } : s))
  }

  function handleShiftConfirmed(shiftId: string) {
    setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, status: 'confirmed' } : s))
  }

  function handleShiftReopened(shiftId: string) {
    setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, status: 'open' } : s))
  }

  const selectedDayShifts = selectedDate ? (shiftsByDate[selectedDate] ?? []) : []

  return (
    <div data-tour-id="agency-shift-calendar" className="flex gap-4 items-start">
      <div className="flex-1 min-w-0">
        <ShiftCalendar
          year={year}
          month={month}
          shiftsByDate={shiftsByDate}
          selectedDate={selectedDate}
          loading={loading}
          onDayClick={d => setSelectedDate(prev => prev === d ? null : d)}
          onPrevMonth={goToPrevMonth}
          onNextMonth={goToNextMonth}
        />
      </div>

      {selectedDate && (
        <div className="w-80 shrink-0 sticky top-6" style={{ maxHeight: 'calc(100vh - 120px)' }}>
          <AgencyShiftDayPanel
            date={selectedDate}
            shifts={selectedDayShifts}
            facilityNames={facilityNames}
            placeholderFacilities={placeholderFacilities}
            onClose={() => setSelectedDate(null)}
            onShiftPosted={handleShiftPosted}
            onShiftCanceled={handleShiftCanceled}
            onShiftConfirmed={handleShiftConfirmed}
            onShiftReopened={handleShiftReopened}
          />
        </div>
      )}
    </div>
  )
}
