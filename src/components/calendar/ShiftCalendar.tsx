'use client'

import type { Database } from '@/lib/supabase/types'

type Shift = Database['public']['Tables']['shifts']['Row']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const STATUS_PILL: Record<string, { bg: string; color: string; label: string }> = {
  open:      { bg: '#CCFBF1', color: '#0F766E', label: 'open' },
  claimed:   { bg: '#FEF3C7', color: '#92400E', label: 'pending' },
  confirmed: { bg: '#DCFCE7', color: '#166534', label: 'confirmed' },
  canceled:  { bg: '#F1F5F9', color: '#64748B', label: 'canceled' },
}

const STATUS_ORDER = ['open', 'claimed', 'confirmed', 'canceled']

const LEGEND = [
  { color: '#0D9488', label: 'Open' },
  { color: '#F59E0B', label: 'Pending' },
  { color: '#22C55E', label: 'Confirmed' },
  { color: '#94A3B8', label: 'Canceled' },
]

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getCalendarDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)
  const days: (Date | null)[] = []
  for (let i = 0; i < firstDay.getDay(); i++) days.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d))
  while (days.length % 7 !== 0) days.push(null)
  return days
}

interface Props {
  year: number
  month: number   // 0-indexed
  shiftsByDate: Record<string, Shift[]>
  selectedDate: string | null
  loading: boolean
  onDayClick: (dateStr: string) => void
  onPrevMonth: () => void
  onNextMonth: () => void
}

const NAV_BTN: React.CSSProperties = {
  width: 30, height: 30,
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 7,
  background: 'rgba(255,255,255,0.05)',
  color: '#7B93AB',
  fontSize: 18,
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  lineHeight: 1,
}

export default function ShiftCalendar({
  year, month, shiftsByDate, selectedDate, loading,
  onDayClick, onPrevMonth, onNextMonth,
}: Props) {
  const todayStr = toDateStr(new Date())
  const days = getCalendarDays(year, month)

  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)', background: '#fff' }}>

      {/* ── Navy header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#0D1B2A' }}>
        <button onClick={onPrevMonth} style={NAV_BTN} aria-label="Previous month">‹</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#F1F5F9' }}>{MONTH_NAMES[month]}</span>
          <span style={{ fontSize: 16, fontWeight: 400, color: '#4A6080' }}>{year}</span>
          {loading && <span style={{ fontSize: 11, color: '#4A6080' }}>Loading…</span>}
        </div>
        <button onClick={onNextMonth} style={NAV_BTN} aria-label="Next month">›</button>
      </div>

      {/* ── Day-of-week labels in navy band ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#0D1B2A', padding: '2px 14px 12px' }}>
        {DAY_LABELS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 600, color: '#7B93AB', letterSpacing: '.07em', textTransform: 'uppercase' }}>
            {d}
          </div>
        ))}
      </div>

      {/* ── Tile grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5, padding: 14, background: '#F4F7FA' }}>
        {days.map((date, idx) => {
          if (!date) {
            return <div key={`pad-${idx}`} style={{ minHeight: 74, borderRadius: 10 }} />
          }

          const dateStr    = toDateStr(date)
          const dayShifts  = shiftsByDate[dateStr] ?? []
          const isToday    = dateStr === todayStr
          const isSelected = dateStr === selectedDate
          const isPast     = dateStr < todayStr

          const counts: Record<string, number> = {}
          for (const s of dayShifts) counts[s.status] = (counts[s.status] ?? 0) + 1

          const hasTealRing = isToday || isSelected

          return (
            <div
              key={dateStr}
              onClick={() => onDayClick(dateStr)}
              style={{
                minHeight: 74,
                borderRadius: 10,
                padding: '8px 8px 7px',
                background: '#fff',
                cursor: 'pointer',
                transition: 'box-shadow .12s, transform .12s, background .12s',
                opacity: isPast ? 0.52 : 1,
                boxShadow: hasTealRing ? 'inset 0 0 0 2.5px #0D9488' : undefined,
              }}
              onMouseEnter={e => {
                if (!hasTealRing) {
                  const el = e.currentTarget as HTMLElement
                  el.style.background = '#EBF5F4'
                  el.style.transform = 'translateY(-1px)'
                  el.style.boxShadow = '0 3px 8px rgba(13,148,136,.10)'
                }
              }}
              onMouseLeave={e => {
                if (!hasTealRing) {
                  const el = e.currentTarget as HTMLElement
                  el.style.background = '#fff'
                  el.style.transform = ''
                  el.style.boxShadow = ''
                }
              }}
            >
              {/* Date number */}
              <div style={{
                fontSize: 13, fontWeight: 600,
                width: 24, height: 24,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%',
                marginBottom: 5,
                color: isToday ? '#0D9488' : '#0D1B2A',
              }}>
                {date.getDate()}
              </div>

              {/* Status pills */}
              {dayShifts.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {STATUS_ORDER.filter(s => counts[s] > 0).map(status => {
                    const pill = STATUS_PILL[status]
                    return (
                      <span key={status} style={{
                        fontSize: 10, fontWeight: 600,
                        padding: '2px 7px',
                        borderRadius: 20,
                        whiteSpace: 'nowrap',
                        width: 'fit-content',
                        lineHeight: 1.5,
                        background: pill.bg,
                        color: pill.color,
                      }}>
                        {counts[status]} {pill.label}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Legend ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '11px 22px', borderTop: '1px solid #E4EAF0', background: '#fff' }}>
        {LEGEND.map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
            <span style={{ fontSize: 11, color: '#5B6B80', fontWeight: 500 }}>{label}</span>
          </div>
        ))}
      </div>

    </div>
  )
}
