'use client'

import { useState, useEffect } from 'react'
import type { CompareResult, CompareShift } from '@/app/api/placeholders/compare/route'
import { CredentialBadge } from '@/components/ui/Badge'

const STATUS_STYLES: Record<string, string> = {
  open:      'text-gray-500',
  claimed:   'text-amber-600',
  confirmed: 'text-green-600 font-medium',
  canceled:  'text-red-400 line-through',
}

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${((h % 12) || 12)}:${String(m).padStart(2, '0')} ${ampm}`
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

interface ShiftRowProps {
  shift: CompareShift
  isOverlap?: boolean
}

function ShiftRow({ shift, isOverlap }: ShiftRowProps) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${isOverlap ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
      <CredentialBadge credential={shift.credential_required} className="text-[10px]" />
      <span className="text-gray-700">{formatTime(shift.start_time)} – {formatTime(shift.end_time)}</span>
      <span className={`ml-auto ${STATUS_STYLES[shift.status] ?? 'text-gray-500'}`}>
        {shift.status === 'confirmed' && shift.nurse_name ? shift.nurse_name : shift.status}
      </span>
      {isOverlap && <span title="Date overlap" className="text-amber-500">⚠</span>}
    </div>
  )
}

interface DateGroupProps {
  date: string
  shifts: CompareShift[]
  isOverlap: boolean
  label: string
}

function DateGroup({ date, shifts, isOverlap, label }: DateGroupProps) {
  const [open, setOpen] = useState(true)

  return (
    <div className={`border rounded-xl overflow-hidden ${isOverlap ? 'border-amber-300' : 'border-gray-200'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-sm font-medium ${isOverlap ? 'bg-amber-50 text-amber-900' : 'bg-gray-50 text-gray-700'}`}
      >
        <span>{formatDate(date)}</span>
        <span className="flex items-center gap-2 text-xs font-normal">
          {isOverlap && <span className="text-amber-600 font-medium">Both sides have shifts</span>}
          <span className="text-gray-400">{shifts.length} shift{shifts.length !== 1 ? 's' : ''}</span>
          <span>{open ? '▲' : '▼'}</span>
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-2 space-y-1.5">
          {shifts.length === 0 ? (
            <p className="text-xs text-gray-400 italic">{label} has no shifts on this date.</p>
          ) : (
            shifts.map(s => <ShiftRow key={s.id} shift={s} isOverlap={isOverlap} />)
          )}
        </div>
      )}
    </div>
  )
}

interface Props {
  requestId: string
}

export default function CalendarComparison({ requestId }: Props) {
  const [data, setData] = useState<CompareResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'placeholder' | 'facility' | 'all'>('all')

  useEffect(() => {
    fetch(`/api/placeholders/compare?request_id=${requestId}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) setError(json.error)
        else setData(json as CompareResult)
      })
      .catch(() => setError('Failed to load comparison data'))
      .finally(() => setLoading(false))
  }, [requestId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-400">
        Loading calendar comparison…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
        {error ?? 'Could not load comparison data.'}
      </div>
    )
  }

  // Collect all unique dates across both sides
  const allDates = Array.from(
    new Set([
      ...data.placeholderShifts.map(s => s.shift_date),
      ...data.facilityShifts.map(s => s.shift_date),
    ])
  ).sort()

  const overlapSet = new Set(data.overlapDates)

  // Group shifts by date for each side
  const phByDate: Record<string, CompareShift[]> = {}
  const facByDate: Record<string, CompareShift[]> = {}
  for (const s of data.placeholderShifts) {
    ;(phByDate[s.shift_date] ??= []).push(s)
  }
  for (const s of data.facilityShifts) {
    ;(facByDate[s.shift_date] ??= []).push(s)
  }

  const displayDates = allDates.filter(d => {
    if (tab === 'placeholder') return !!phByDate[d]
    if (tab === 'facility')    return !!facByDate[d]
    return true
  })

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      <div className="bg-brand-tint border border-teal-200 rounded-xl p-4 space-y-1.5 text-sm">
        <p className="font-semibold text-teal-900">What happens when you connect:</p>
        <ul className="space-y-1 text-teal-800 text-xs list-disc ml-4">
          {data.confirmedCount > 0 && (
            <li>
              <strong>{data.confirmedCount}</strong> confirmed placeholder shift{data.confirmedCount !== 1 ? 's' : ''} will be
              <span className="text-green-700 font-medium"> migrated</span> to {data.facilityName}'s live calendar — nurses keep their shifts.
            </li>
          )}
          {data.openCount > 0 && (
            <li>
              <strong>{data.openCount}</strong> open placeholder shift{data.openCount !== 1 ? 's' : ''} will be
              <span className="text-red-600 font-medium"> deleted</span>.
            </li>
          )}
          {data.openCount === 0 && data.confirmedCount === 0 && (
            <li>The placeholder has no active shifts — connection is clean.</li>
          )}
          <li>
            Going forward, {data.placeholderName} will be replaced by the verified {data.facilityName} account.
          </li>
        </ul>
      </div>

      {/* Overlap warning */}
      {data.overlapDates.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-sm">
          <p className="font-semibold text-amber-800 mb-1">
            ⚠ {data.overlapDates.length} date{data.overlapDates.length !== 1 ? 's have' : ' has'} shifts on both sides
          </p>
          <p className="text-xs text-amber-700">
            Shifts on these dates exist in both the placeholder and the facility calendar. Review them below.
          </p>
        </div>
      )}

      {/* Empty state */}
      {data.placeholderShifts.length === 0 && data.facilityShifts.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">
          No shifts found in the next 120 days for either side.
        </p>
      )}

      {/* Tab bar */}
      {(data.placeholderShifts.length > 0 || data.facilityShifts.length > 0) && (
        <>
          <div className="flex border-b border-gray-200">
            {(['all', 'placeholder', 'facility'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  tab === t
                    ? 'border-teal-600 text-teal-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'all'         ? 'All Dates'           : null}
                {t === 'placeholder' ? `${data.placeholderName} (${data.placeholderShifts.length})` : null}
                {t === 'facility'    ? `${data.facilityName} (${data.facilityShifts.length})` : null}
              </button>
            ))}
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {displayDates.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No shifts for this view.</p>
            )}
            {displayDates.map(date => {
              const isOverlap = overlapSet.has(date)
              if (tab === 'placeholder') {
                return (
                  <DateGroup key={date} date={date} shifts={phByDate[date] ?? []} isOverlap={isOverlap} label={data.placeholderName} />
                )
              }
              if (tab === 'facility') {
                return (
                  <DateGroup key={date} date={date} shifts={facByDate[date] ?? []} isOverlap={isOverlap} label={data.facilityName} />
                )
              }
              // 'all' tab: show both sides for this date in two sub-groups
              return (
                <div key={date} className={`border rounded-xl overflow-hidden ${isOverlap ? 'border-amber-300' : 'border-gray-200'}`}>
                  <div className={`px-4 py-2.5 flex items-center justify-between ${isOverlap ? 'bg-amber-50' : 'bg-gray-50'}`}>
                    <span className={`text-sm font-medium ${isOverlap ? 'text-amber-900' : 'text-gray-700'}`}>
                      {formatDate(date)}
                    </span>
                    {isOverlap && <span className="text-xs text-amber-600 font-medium">⚠ Overlap</span>}
                  </div>
                  <div className="px-3 pb-3 pt-2 space-y-3">
                    {(phByDate[date]?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                          {data.placeholderName} (placeholder)
                        </p>
                        <div className="space-y-1">
                          {phByDate[date].map(s => <ShiftRow key={s.id} shift={s} isOverlap={isOverlap} />)}
                        </div>
                      </div>
                    )}
                    {(facByDate[date]?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                          {data.facilityName} (live calendar)
                        </p>
                        <div className="space-y-1">
                          {facByDate[date].map(s => <ShiftRow key={s.id} shift={s} isOverlap={isOverlap} />)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
