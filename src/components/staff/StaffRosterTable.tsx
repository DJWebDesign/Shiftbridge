'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CredentialBadge } from '@/components/ui/Badge'

const LICENSE_STATUS_COLORS: Record<string, string> = {
  active:    'bg-green-100 text-green-800',
  expired:   'bg-red-100 text-red-800',
  suspended: 'bg-amber-100 text-amber-800',
  revoked:   'bg-red-100 text-red-800',
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isExpiringSoon(dateStr: string | null | undefined) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + 30)
  return d <= cutoff && d >= new Date()
}

function isExpired(dateStr: string | null | undefined) {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

type RosterRow = {
  id: string
  base_pay_rate: number | null
  status: string
  notes: string | null
  nurse_profiles: {
    id: string
    license_number: string
    license_state: string
    credential_type: string
    license_status: string
    license_expiration: string | null
    iv_certified: boolean
    cpr_expiration: string | null
    tb_test_date: string | null
    covid_vaccinated: boolean
    profile_photo_url: string | null
    profiles: {
      full_name: string
      email: string
      phone: string | null
    } | null
  } | null
}

export default function StaffRosterTable({ roster, agencyId, facilityId }: { roster: RosterRow[], agencyId: string, facilityId?: string }) {
  const router = useRouter()
  const [showInactive, setShowInactive] = useState(false)

  const hasInactive = roster.some(r => r.status === 'inactive')
  const filtered = showInactive ? roster : roster.filter(r => r.status === 'active')

  if (roster.length === 0) {
    return (
      <div className="card p-12 text-center">
        <p className="text-ink-2 mb-4">No nurses on your roster yet.</p>
        <Link
          href={`/agency/${agencyId}/staff/new`}
          className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover transition-colors"
        >
          Add your first nurse
        </Link>
      </div>
    )
  }

  return (
    <div>
      {hasInactive && (
        <div className="flex justify-end mb-3">
          <button
            onClick={() => setShowInactive(v => !v)}
            className="text-[13px] font-medium px-3 py-1.5 rounded-lg transition-all"
            style={{
              border: '1px solid #E4EAF0',
              background: showInactive ? '#F1F5F9' : '#fff',
              color: '#5B6B80',
            }}
          >
            {showInactive ? 'Hide Inactive' : 'Show Inactive'}
          </button>
        </div>
      )}
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wide text-ink-3 font-bold border-b border-line">Name</th>
            <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wide text-ink-3 font-bold border-b border-line">Credential</th>
            <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wide text-ink-3 font-bold border-b border-line">License</th>
            <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wide text-ink-3 font-bold border-b border-line">Lic. Expires</th>
            <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wide text-ink-3 font-bold border-b border-line">CPR Expires</th>
            <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wide text-ink-3 font-bold border-b border-line">Pay Rate</th>
            <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wide text-ink-3 font-bold border-b border-line">Status</th>
            <th className="px-4 py-3 border-b border-line"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {filtered.map(row => {
            const np = row.nurse_profiles
            const profile = np?.profiles
            const licExpiring = isExpiringSoon(np?.license_expiration)
            const licExpired  = isExpired(np?.license_expiration)
            const cprExpiring = isExpiringSoon(np?.cpr_expiration)
            const cprExpired  = isExpired(np?.cpr_expiration)

            return (
              <tr
                key={row.id}
                className="hover:bg-brand-tint transition-colors cursor-pointer"
                onClick={() => np?.id && router.push(facilityId ? `/facility/${facilityId}/staff/${np.id}` : `/agency/${agencyId}/staff/${np.id}`)}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">{profile?.full_name ?? '—'}</div>
                  <div className="text-xs text-ink-3">{profile?.email}</div>
                </td>
                <td className="px-4 py-3">
                  {np?.credential_type && <CredentialBadge credential={np.credential_type} />}
                  {np?.iv_certified && (
                    <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-100 text-cyan-800">IV</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="text-ink-2 tabular-nums">{np?.license_number} ({np?.license_state})</div>
                  {np?.license_status && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-0.5 ${LICENSE_STATUS_COLORS[np.license_status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {np.license_status}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  <span className={licExpired ? 'text-red-600 font-medium' : licExpiring ? 'text-amber-600 font-medium' : 'text-ink-2'}>
                    {formatDate(np?.license_expiration)}
                    {licExpiring && !licExpired && ' ⚠'}
                    {licExpired && ' ✕'}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums">
                  <span className={cprExpired ? 'text-red-600 font-medium' : cprExpiring ? 'text-amber-600 font-medium' : 'text-ink-2'}>
                    {formatDate(np?.cpr_expiration)}
                    {cprExpiring && !cprExpired && ' ⚠'}
                    {cprExpired && ' ✕'}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-2 tabular-nums">
                  {row.base_pay_rate ? `$${Number(row.base_pay_rate).toFixed(2)}/hr` : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${row.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {np?.id && (
                    <Link
                      href={`/agency/${agencyId}/staff/${np.id}`}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors bg-background text-brand"
                    >
                      Edit →
                    </Link>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
    </div>
  )
}
