'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRealtimeShifts } from '@/hooks/useRealtimeShifts'
import ShiftCalendar from '@/components/calendar/ShiftCalendar'
import ShiftDayPanel from '@/components/calendar/ShiftDayPanel'
import ShiftOutreachModal from '@/components/facility/ShiftOutreachModal'
import type { Database } from '@/lib/supabase/types'

type Shift = Database['public']['Tables']['shifts']['Row']

interface ShiftSlot {
  shift_name: string
  start_time: string
  end_time: string
}

type ShiftConfigsByCredential = Partial<Record<string, ShiftSlot[]>>

interface Props {
  facilityId: string
  facilityName: string
  shiftConfigs: ShiftConfigsByCredential
  initialShifts: Shift[]
  initialYear: number
  initialMonth: number  // 0-indexed
}

export default function ShiftCalendarView({
  facilityId, facilityName, shiftConfigs, initialShifts, initialYear, initialMonth,
}: Props) {
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [shifts, setShifts] = useState<Shift[]>(initialShifts)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showOutreach, setShowOutreach] = useState(false)

  async function loadShifts(y: number, m: number) {
    setLoading(true)
    const from = `${y}-${String(m + 1).padStart(2, '0')}-01`
    const lastDay = new Date(y, m + 1, 0).getDate()
    const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    // Fetch via API route to avoid client-side RLS issues with migrated shifts
    const res = await fetch(
      `/api/shifts/by-facility?facilityId=${facilityId}&from=${from}&to=${to}`
    )
    const json = await res.json()
    setShifts(json.shifts ?? [])
    setLoading(false)
  }

  function goToPrevMonth() {
    const newMonth = month === 0 ? 11 : month - 1
    const newYear = month === 0 ? year - 1 : year
    setMonth(newMonth)
    setYear(newYear)
    setSelectedDate(null)
    loadShifts(newYear, newMonth)
  }

  function goToNextMonth() {
    const newMonth = month === 11 ? 0 : month + 1
    const newYear = month === 11 ? year + 1 : year
    setMonth(newMonth)
    setYear(newYear)
    setSelectedDate(null)
    loadShifts(newYear, newMonth)
  }

  function handleDayClick(dateStr: string) {
    setSelectedDate(prev => prev === dateStr ? null : dateStr)
  }

  // Realtime: only apply updates for the currently displayed month
  const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}-`

  const handleInsert = useCallback((shift: Shift) => {
    if (!shift.shift_date.startsWith(currentMonthPrefix)) return
    setShifts(prev => [...prev, shift])
  }, [currentMonthPrefix])

  const handleUpdate = useCallback((shift: Shift) => {
    if (!shift.shift_date.startsWith(currentMonthPrefix)) return
    setShifts(prev => {
      const idx = prev.findIndex(s => s.id === shift.id)
      // If not found (e.g. shift was just migrated to this facility), add it
      if (idx === -1) return [...prev, shift]
      return prev.map(s => s.id === shift.id ? shift : s)
    })
  }, [currentMonthPrefix])

  const handleDelete = useCallback((id: string) => {
    setShifts(prev => prev.filter(s => s.id !== id))
  }, [])

  useRealtimeShifts(facilityId, {
    onInsert: handleInsert,
    onUpdate: handleUpdate,
    onDelete: handleDelete,
  })

  const shiftsByDate = useMemo(() => {
    const map: Record<string, Shift[]> = {}
    for (const shift of shifts) {
      if (!map[shift.shift_date]) map[shift.shift_date] = []
      map[shift.shift_date].push(shift)
    }
    return map
  }, [shifts])

  const openShifts = useMemo(() => shifts.filter(s => s.status === 'open'), [shifts])
  const currentMonth = `${year}-${String(month + 1).padStart(2, '0')}`

  const selectedDayShifts = selectedDate ? (shiftsByDate[selectedDate] ?? []) : []

  function handleShiftPosted(newShifts: Shift[]) {
    // Optimistically add; realtime will also fire but we dedupe by id
    setShifts(prev => {
      const ids = new Set(prev.map(s => s.id))
      return [...prev, ...newShifts.filter(s => !ids.has(s.id))]
    })
  }

  function handleTierChange(shiftId: string, tier: number) {
    setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, priority_tier: tier } : s))
  }

  function handleShiftCanceled(shiftId: string) {
    setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, status: 'canceled' } : s))
  }

  return (
    <>
    <div className="flex gap-4 items-start">
      <div className="flex-1 min-w-0">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <button
            onClick={() => setShowOutreach(true)}
            style={{
              padding: '8px 16px',
              background: '#fff',
              border: '1px solid #0D9488',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: '#0D9488',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            ✉ Send Shift Needs Email
          </button>
        </div>
        <ShiftCalendar
          year={year}
          month={month}
          shiftsByDate={shiftsByDate}
          selectedDate={selectedDate}
          loading={loading}
          onDayClick={handleDayClick}
          onPrevMonth={goToPrevMonth}
          onNextMonth={goToNextMonth}
        />
      </div>

      {selectedDate && (
        <div className="w-80 shrink-0 sticky top-6" style={{ maxHeight: 'calc(100vh - 120px)' }}>
          <ShiftDayPanel
            date={selectedDate}
            shifts={selectedDayShifts}
            shiftConfigs={shiftConfigs}
            facilityId={facilityId}
            onClose={() => setSelectedDate(null)}
            onShiftPosted={handleShiftPosted}
            onTierChange={handleTierChange}
            onShiftCanceled={handleShiftCanceled}
          />
        </div>
      )}
    </div>

    {showOutreach && (
      <ShiftOutreachModal
        facilityId={facilityId}
        facilityName={facilityName}
        currentMonth={currentMonth}
        openShifts={openShifts}
        onClose={() => setShowOutreach(false)}
      />
    )}
    </>
  )
}
