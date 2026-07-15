'use client'

import { useState } from 'react'
import Link from 'next/link'
import MassTextModal from '@/components/agency/MassTextModal'
import { CredentialBadge, TierBadge } from '@/components/ui/Badge'
import { Card, CardHeader, StatTile } from '@/components/ui/Card'

export interface ShiftSummary {
  id: string
  shift_date: string
  start_time: string
  end_time: string
  credential_required: string
  priority_tier: number
  status: string
  is_late_cancel: boolean | null
  facility_name: string | null
  nurse_name: string | null
  claim_status: string | null
}

export interface CredentialAlert {
  id: string
  full_name: string
  credential_type: string
  license_expiration: string | null
  cpr_expiration: string | null
  tb_expiration: string | null
}

export interface OpenShiftNeed {
  id: string
  shift_date: string
  start_time: string
  credential_required: string
  priority_tier: number
  facility_name: string | null
  hours_open: number
}

export interface FinancialSnapshot {
  totalHours: number
  totalPay: number
}

export interface StaffSummary {
  id: string
  full_name: string
  credential_type: string
  shifts_worked: number
  shifts_canceled: number
  hours_worked: number
  has_dnr: boolean
  cancel_rate: number
  late_cancel_rate: number
}

export interface FillRateRow {
  credential: string
  currentFilled: number
  currentTotal: number
  prevFilled: number
  prevTotal: number
}

export interface PendingApprovalClaim {
  id: string
  shift_id: string
  nurse_profile_id: string
  nurse_name: string
  credential: string
  shift_date: string
  start_time: string
  end_time: string
  facility_name: string
}

interface Props {
  agencyId: string
  month: string  // yyyy-mm
  confirmedShifts: ShiftSummary[]
  pendingShifts: ShiftSummary[]
  canceledShifts: ShiftSummary[]
  credentialAlerts30: CredentialAlert[]
  credentialAlerts90: CredentialAlert[]
  openNeeds: OpenShiftNeed[]
  financial: FinancialSnapshot
  staffSummaries: StaffSummary[]
  fillRateData: FillRateRow[]
  pendingApprovalClaims: PendingApprovalClaim[]
}

function fmt12(time: string) {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

function formatDate(dateStr: string) {
  const [y, mo, d] = dateStr.split('-').map(Number)
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  })
}

function daysAgo(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const then = new Date(y, mo - 1, d)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = Math.round((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'today'
  if (diff === 1) return 'yesterday'
  return `${diff}d ago`
}

function daysUntil(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const then = new Date(y, mo - 1, d)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = Math.round((then.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return 'expired'
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  return `in ${diff}d`
}

type Tab = 'confirmed' | 'pending' | 'canceled'
type CredPipelineTab = 'urgent' | 'upcoming'

export default function AgencyDashboardClient({
  agencyId,
  month,
  confirmedShifts,
  pendingShifts,
  canceledShifts,
  credentialAlerts30,
  credentialAlerts90,
  openNeeds,
  financial,
  staffSummaries,
  fillRateData,
  pendingApprovalClaims: initialPendingApproval,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('confirmed')
  const [credTab, setCredTab] = useState<CredPipelineTab>('urgent')
  const [showMassText, setShowMassText] = useState(false)
  const [staffExpanded, setStaffExpanded] = useState(false)
  const [pendingApproval, setPendingApproval] = useState<PendingApprovalClaim[]>(initialPendingApproval)
  const [actioningClaim, setActioningClaim] = useState<string | null>(null)
  const [approvalError, setApprovalError] = useState<string | null>(null)

  async function handleApprove(claimId: string) {
    setActioningClaim(claimId)
    setApprovalError(null)
    try {
      const res = await fetch('/api/shifts/agency-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim_id: claimId }),
      })
      if (!res.ok) {
        const json = await res.json()
        setApprovalError(json.error ?? 'Failed to approve')
        return
      }
      setPendingApproval(p => p.filter(c => c.id !== claimId))
    } catch {
      setApprovalError('Network error — please try again')
    } finally {
      setActioningClaim(null)
    }
  }

  async function handleReject(claimId: string) {
    setActioningClaim(claimId)
    setApprovalError(null)
    try {
      const res = await fetch('/api/shifts/agency-reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim_id: claimId }),
      })
      if (!res.ok) {
        const json = await res.json()
        setApprovalError(json.error ?? 'Failed to reject')
        return
      }
      setPendingApproval(p => p.filter(c => c.id !== claimId))
    } catch {
      setApprovalError('Network error — please try again')
    } finally {
      setActioningClaim(null)
    }
  }

  const tabShifts: Record<Tab, ShiftSummary[]> = {
    confirmed: confirmedShifts,
    pending: pendingShifts,
    canceled: canceledShifts,
  }

  const current = tabShifts[activeTab]

  return (
    <div className="space-y-6">
      {/* Needs Your Approval */}
      {pendingApproval.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-amber-200 flex items-center gap-2">
            <span className="text-sm font-semibold text-amber-800">Needs Your Approval</span>
            <span className="text-xs bg-amber-200 text-amber-800 font-semibold px-1.5 py-0.5 rounded-full">{pendingApproval.length}</span>
          </div>
          {approvalError && (
            <div className="px-5 py-2 bg-red-50 border-b border-red-100 text-xs text-red-600">{approvalError}</div>
          )}
          <div className="divide-y divide-amber-100">
            {pendingApproval.map(claim => {
              const [y, m, d] = claim.shift_date.split('-').map(Number)
              const dateFmt = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
              const [sh, sm] = claim.start_time.split(':').map(Number)
              const [eh, em] = claim.end_time.split(':').map(Number)
              const fmtT = (h: number, min: number) => `${h % 12 || 12}:${String(min).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
              return (
                <div key={claim.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{claim.nurse_name}</p>
                    <p className="text-xs text-ink-2 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <CredentialBadge credential={claim.credential} />
                      <span className="tabular-nums">{claim.facility_name} · {dateFmt} · {fmtT(sh, sm)} – {fmtT(eh, em)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleApprove(claim.id)}
                      disabled={actioningClaim === claim.id}
                      className="text-xs px-3 py-1.5 bg-brand text-white rounded-md font-medium hover:bg-brand-hover disabled:opacity-50 transition-colors"
                    >
                      {actioningClaim === claim.id ? '…' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleReject(claim.id)}
                      disabled={actioningClaim === claim.id}
                      className="text-xs px-3 py-1.5 bg-surface border border-red-200 text-red-700 rounded-md font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Financial Snapshot */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatTile label="Confirmed Shifts" value={confirmedShifts.length} caption="this month" accent />
        <StatTile label="Pending Claims" value={pendingShifts.length} caption="awaiting confirmation" valueClassName="text-amber-600" />
        <StatTile label="Hours Confirmed" value={financial.totalHours.toFixed(1)} caption="this month" />
        <StatTile
          label="Est. Pay Out"
          value={`$${financial.totalPay.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          caption="hours × base rate"
          valueClassName="text-green-700"
        />
      </div>

      {/* Shift Tabs */}
      <Card>
        <div className="flex items-center justify-between px-5 pt-4 pb-0 border-b border-line">
          <div className="flex gap-1">
            {(['confirmed', 'pending', 'canceled'] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors capitalize border-b-2 -mb-px ${
                  activeTab === tab
                    ? 'border-brand text-brand bg-surface'
                    : 'border-transparent text-ink-3 hover:text-ink-2'
                }`}
              >
                {tab === 'confirmed' ? 'Confirmed' : tab === 'pending' ? 'Pending' : 'Canceled'}
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full tabular-nums ${
                  activeTab === tab ? 'bg-brand-tint text-brand' : 'bg-background text-ink-3'
                }`}>
                  {tabShifts[tab].length}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 pb-1">
            <a
              href={`/api/shifts/export?agencyId=${agencyId}&month=${month}`}
              className="text-xs px-3 py-1.5 border border-line rounded-lg text-ink-2 hover:bg-background font-medium"
            >
              Export CSV
            </a>
            <button
              onClick={() => setShowMassText(true)}
              className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-brand-hover font-medium"
            >
              Mass Text
            </button>
          </div>
        </div>

        <div className="divide-y divide-line max-h-80 overflow-y-auto">
          {current.length === 0 ? (
            <p className="text-center text-sm text-ink-3 py-8">No {activeTab} shifts this month.</p>
          ) : (
            current.map(shift => (
              <div key={shift.id} className="flex items-center gap-4 px-5 py-3 hover:bg-brand-tint">
                <div className="w-16 text-xs text-ink-3 shrink-0 tabular-nums">{formatDate(shift.shift_date)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">
                    {shift.facility_name ?? 'Unknown Facility'}
                  </p>
                  {shift.nurse_name && (
                    <p className="text-xs text-ink-2">{shift.nurse_name}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <CredentialBadge credential={shift.credential_required} />
                  <span className="text-xs text-ink-3 tabular-nums">
                    {fmt12(shift.start_time)}–{fmt12(shift.end_time)}
                  </span>
                  {activeTab === 'canceled' && shift.is_late_cancel && (
                    <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-medium">Late</span>
                  )}
                  {shift.priority_tier > 1 && (
                    <TierBadge tier={shift.priority_tier} />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Credential Pipeline */}
        <Card>
          <div className="px-5 pt-4 pb-0 border-b border-line">
            <div className="flex items-center justify-between mb-2">
              <h3 className="section-title text-[17px]">Credential Pipeline</h3>
              <Link href={`/agency/${agencyId}/staff`} className="text-xs text-brand hover:underline">View all →</Link>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setCredTab('urgent')}
                className={`px-3 py-1.5 text-xs font-medium rounded-t border-b-2 -mb-px transition-colors ${credTab === 'urgent' ? 'border-amber-500 text-amber-700 bg-surface' : 'border-transparent text-ink-3 hover:text-ink-2'}`}
              >
                Expiring Soon
                {credentialAlerts30.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 tabular-nums">{credentialAlerts30.length}</span>
                )}
              </button>
              <button
                onClick={() => setCredTab('upcoming')}
                className={`px-3 py-1.5 text-xs font-medium rounded-t border-b-2 -mb-px transition-colors ${credTab === 'upcoming' ? 'border-brand text-brand bg-surface' : 'border-transparent text-ink-3 hover:text-ink-2'}`}
              >
                Upcoming (31–90d)
                {credentialAlerts90.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-brand-tint text-brand tabular-nums">{credentialAlerts90.length}</span>
                )}
              </button>
            </div>
          </div>
          {(() => {
            const alerts = credTab === 'urgent' ? credentialAlerts30 : credentialAlerts90
            const emptyMsg = credTab === 'urgent' ? 'No credentials expiring within 30 days.' : 'No credentials expiring in the next 31–90 days.'
            const textColor = credTab === 'urgent' ? 'text-amber-700' : 'text-brand'
            return (
              <div className="divide-y divide-line max-h-64 overflow-y-auto">
                {alerts.length === 0 ? (
                  <p className="text-center text-sm text-ink-3 py-6">{emptyMsg}</p>
                ) : (
                  alerts.map(alert => (
                    <div key={alert.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-ink">{alert.full_name}</p>
                        <CredentialBadge credential={alert.credential_type} />
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                        {alert.license_expiration && (
                          <span className={`text-xs tabular-nums ${textColor}`}>License: {daysUntil(alert.license_expiration)}</span>
                        )}
                        {alert.cpr_expiration && (
                          <span className={`text-xs tabular-nums ${textColor}`}>CPR: {daysUntil(alert.cpr_expiration)}</span>
                        )}
                        {alert.tb_expiration && (
                          <span className={`text-xs tabular-nums ${textColor}`}>TB: {daysUntil(alert.tb_expiration)}</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )
          })()}
        </Card>

        {/* Open Shifts Needing Attention */}
        <Card>
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <h3 className="section-title text-[17px]">
              Open Shifts Needing Attention
              {openNeeds.length > 0 && (
                <span className="ml-2 text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium tabular-nums">
                  {openNeeds.length}
                </span>
              )}
            </h3>
            <Link href={`/agency/${agencyId}/shifts`} className="text-xs text-brand hover:underline">
              View calendar →
            </Link>
          </div>
          <div className="divide-y divide-line max-h-64 overflow-y-auto">
            {openNeeds.length === 0 ? (
              <p className="text-center text-sm text-ink-3 py-6">No open shifts requiring attention.</p>
            ) : (
              openNeeds.map(shift => (
                <div key={shift.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">
                      {shift.facility_name ?? 'Placeholder'}
                    </p>
                    <p className="text-xs text-ink-2 tabular-nums">
                      {formatDate(shift.shift_date)} · {fmt12(shift.start_time)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <CredentialBadge credential={shift.credential_required} />
                    {shift.priority_tier > 1 && (
                      <TierBadge tier={shift.priority_tier} />
                    )}
                    <span className="text-xs text-ink-3">{daysAgo(shift.shift_date)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

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

      {/* Staff Performance */}
      {staffSummaries.length > 0 && (
        <Card>
          <button
            onClick={() => setStaffExpanded(e => !e)}
            className="w-full px-5 py-4 border-b border-line flex items-center justify-between text-left"
          >
            <h3 className="section-title text-[17px]">Staff Activity This Month</h3>
            <span className="text-ink-3 text-xs">{staffExpanded ? '▲ Collapse' : '▼ Expand'}</span>
          </button>
          {staffExpanded && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-5 py-2 text-left text-[11px] uppercase tracking-wide text-ink-3 font-bold border-b border-line">Name</th>
                    <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-ink-3 font-bold border-b border-line">Credential</th>
                    <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-ink-3 font-bold border-b border-line">Shifts</th>
                    <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-ink-3 font-bold border-b border-line">Hours</th>
                    <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-ink-3 font-bold border-b border-line">Cancel %</th>
                    <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-ink-3 font-bold border-b border-line">Late %</th>
                    <th className="px-3 py-2 text-center text-[11px] uppercase tracking-wide text-ink-3 font-bold border-b border-line">DNR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {staffSummaries.map(s => (
                    <tr key={s.id} className="hover:bg-brand-tint">
                      <td className="px-5 py-2.5 font-medium text-ink">{s.full_name}</td>
                      <td className="px-3 py-2.5">
                        <CredentialBadge credential={s.credential_type} />
                      </td>
                      <td className="px-3 py-2.5 text-right text-ink-2 tabular-nums">{s.shifts_worked}</td>
                      <td className="px-3 py-2.5 text-right text-ink-2 tabular-nums">{s.hours_worked.toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {s.shifts_canceled > 0
                          ? <span className={s.cancel_rate >= 20 ? 'text-amber-600 font-medium' : 'text-ink-2'}>{s.cancel_rate}%</span>
                          : <span className="text-ink-3">0%</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {s.shifts_canceled > 0
                          ? <span className={s.late_cancel_rate >= 10 ? 'text-red-600 font-medium' : 'text-ink-2'}>{s.late_cancel_rate}%</span>
                          : <span className="text-ink-3">0%</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {s.has_dnr && <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-medium">DNR</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {showMassText && (
        <MassTextModal agencyId={agencyId} onClose={() => setShowMassText(false)} />
      )}
    </div>
  )
}
