'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CredentialBadge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'

export interface AgencyOverview {
  agencyId: string
  agencyName: string
  confirmedShifts: number
  billRate: number | null
  estimatedCost: number | null
  totalHours: number
}

export interface FacilityFillRateRow {
  credential: string
  currentFilled: number
  currentTotal: number
  prevFilled: number
  prevTotal: number
}

interface Props {
  facilityId: string
  agencyOverviews: AgencyOverview[]
  fillRateData: FacilityFillRateRow[]
}

export default function FacilityDashboardClient({ facilityId, agencyOverviews, fillRateData }: Props) {
  const [billRates, setBillRates] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const a of agencyOverviews) {
      init[a.agencyId] = a.billRate !== null ? String(a.billRate) : ''
    }
    return init
  })
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<Record<string, boolean>>({})

  async function saveBillRate(agencyId: string) {
    const rate = parseFloat(billRates[agencyId] ?? '')
    if (isNaN(rate) || rate < 0) return
    setSaving(agencyId)
    try {
      await fetch('/api/settings/bill-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facilityId, agencyId, billRate: rate }),
      })
      setSaved(s => ({ ...s, [agencyId]: true }))
      setTimeout(() => setSaved(s => ({ ...s, [agencyId]: false })), 2000)
    } finally {
      setSaving(null)
    }
  }

  if (agencyOverviews.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-ink-3">No connected agencies yet.</p>
        <p className="text-xs text-ink-3 mt-1">Agencies will appear here once a connection request is accepted.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
    <Card>
      <div className="px-5 py-4 border-b border-line flex items-center justify-between">
        <h3 className="section-title text-[17px]">Agency Overview</h3>
        <Link href={`/facility/${facilityId}/claims`} className="text-xs text-brand hover:underline">
          Review claims →
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-5 py-2 text-left text-[11px] uppercase tracking-wide text-ink-3 font-bold border-b border-line">Agency</th>
              <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-ink-3 font-bold border-b border-line">Confirmed Shifts</th>
              <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-ink-3 font-bold border-b border-line">Hours</th>
              <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-ink-3 font-bold border-b border-line">Bill Rate ($/hr)</th>
              <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-ink-3 font-bold border-b border-line">Est. Monthly Cost</th>
              <th className="px-3 py-2 border-b border-line"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {agencyOverviews.map(agency => {
              const rateVal = parseFloat(billRates[agency.agencyId] ?? '')
              const estCost = !isNaN(rateVal) && rateVal > 0 && agency.totalHours > 0
                ? Math.round(agency.totalHours * rateVal)
                : null

              return (
                <tr key={agency.agencyId} className="hover:bg-brand-tint">
                  <td className="px-5 py-3 font-medium text-ink">{agency.agencyName}</td>
                  <td className="px-3 py-3 text-right text-ink-2 tabular-nums">{agency.confirmedShifts}</td>
                  <td className="px-3 py-3 text-right text-ink-2 tabular-nums">{agency.totalHours.toFixed(1)}</td>
                  <td className="px-3 py-3 text-right">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={billRates[agency.agencyId] ?? ''}
                      onChange={e => setBillRates(r => ({ ...r, [agency.agencyId]: e.target.value }))}
                      placeholder="—"
                      className="w-20 text-right border border-line rounded px-2 py-1 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                  </td>
                  <td className="px-3 py-3 text-right text-ink-2 tabular-nums">
                    {estCost !== null ? `$${estCost.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      onClick={() => saveBillRate(agency.agencyId)}
                      disabled={saving === agency.agencyId}
                      className="text-xs px-2.5 py-1 bg-brand text-white rounded hover:bg-brand-hover disabled:opacity-40"
                    >
                      {saving === agency.agencyId ? '...' : saved[agency.agencyId] ? 'Saved' : 'Save'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>

    {/* Fill Rate */}
    {fillRateData.length > 0 && (
      <Card>
        <div className="px-5 py-4 border-b border-line">
          <h3 className="section-title text-[17px]">Fill Rate by Credential</h3>
          <p className="text-xs text-ink-3 mt-0.5">Confirmed / posted (excl. canceled) — vs prior month</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-5 py-2 text-left text-[11px] uppercase tracking-wide text-ink-3 font-bold border-b border-line">Credential</th>
                <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-ink-3 font-bold border-b border-line">This Month</th>
                <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-ink-3 font-bold border-b border-line">Last Month</th>
                <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-ink-3 font-bold border-b border-line">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {fillRateData.map(row => {
                const cur = row.currentTotal > 0 ? Math.round((row.currentFilled / row.currentTotal) * 100) : null
                const prev = row.prevTotal > 0 ? Math.round((row.prevFilled / row.prevTotal) * 100) : null
                const trend = cur !== null && prev !== null ? cur - prev : null
                return (
                  <tr key={row.credential} className="hover:bg-brand-tint">
                    <td className="px-5 py-2.5">
                      <CredentialBadge credential={row.credential} />
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-ink tabular-nums">
                      {cur !== null ? `${cur}%` : '—'}
                      <span className="text-xs text-ink-3 ml-1">({row.currentFilled}/{row.currentTotal})</span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-ink-2 tabular-nums">
                      {prev !== null ? `${prev}%` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {trend === null ? <span className="text-ink-3">—</span>
                        : trend > 0 ? <span className="text-green-600 font-medium">↑ {trend}pp</span>
                        : trend < 0 ? <span className="text-red-600 font-medium">↓ {Math.abs(trend)}pp</span>
                        : <span className="text-ink-3">→</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    )}
    </div>
  )
}
