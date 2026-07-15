'use client'

import { CredentialBadge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'

export interface RepeatNurseRow {
  nurse_profile_id: string
  full_name: string
  credential_type: string
  shift_count: number
  last_shift_date: string
}

function formatDate(dateStr: string) {
  const [y, mo, d] = dateStr.split('-').map(Number)
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function RepeatNurseTable({ rows }: { rows: RepeatNurseRow[] }) {
  if (rows.length === 0) return null

  return (
    <Card>
      <div className="px-5 py-4 border-b border-line">
        <h3 className="section-title text-[17px]">Repeat Nurses</h3>
        <p className="text-xs text-ink-3 mt-0.5">Nurses who have completed confirmed shifts at this facility</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-5 py-2 text-left text-[11px] uppercase tracking-wide text-ink-3 font-bold border-b border-line">Nurse</th>
              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-ink-3 font-bold border-b border-line">Credential</th>
              <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-ink-3 font-bold border-b border-line">Shifts Completed</th>
              <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-ink-3 font-bold border-b border-line">Most Recent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(row => (
              <tr key={row.nurse_profile_id} className="hover:bg-brand-tint">
                <td className="px-5 py-2.5 font-medium text-ink">{row.full_name}</td>
                <td className="px-3 py-2.5">
                  <CredentialBadge credential={row.credential_type} />
                </td>
                <td className="px-3 py-2.5 text-right text-ink-2 font-medium tabular-nums">{row.shift_count}</td>
                <td className="px-3 py-2.5 text-right text-ink-2 tabular-nums">{formatDate(row.last_shift_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
