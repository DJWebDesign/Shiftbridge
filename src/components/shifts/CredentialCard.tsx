// No home_address, home_address_lat/lng, or base_pay_rate — ever.
// This component is the facility-facing view of a nurse's credentials.

import { CredentialBadge } from '@/components/ui/Badge'

export type NurseCredentials = {
  nurse_profile_id: string
  full_name: string
  avatar_url: string | null
  credential_type: string
  license_number: string
  license_state: string
  license_status: string
  license_expiration: string | null
  iv_certified: boolean
  cpr_expiration: string | null
  tb_test_date: string | null
  covid_vaccinated: boolean
  agency_name: string
}

const LICENSE_STATUS_STYLE: Record<string, string> = {
  active:    'text-green-700',
  expired:   'text-red-600',
  suspended: 'text-red-600',
  revoked:   'text-red-700 font-semibold',
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isExpiringSoon(dateStr: string | null): boolean {
  if (!dateStr) return false
  const exp = new Date(dateStr)
  const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  return exp <= thirtyDays
}

interface Props {
  nurse: NurseCredentials
}

export default function CredentialCard({ nurse }: Props) {
  const licExpiring = isExpiringSoon(nurse.license_expiration)
  const cprExpiring = isExpiringSoon(nurse.cpr_expiration)

  return (
    <div className="bg-background rounded-lg border border-line p-4">
      {/* Header: avatar + name + credential */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-line flex items-center justify-center shrink-0 overflow-hidden">
          {nurse.avatar_url ? (
            <img src={nurse.avatar_url} alt={nurse.full_name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-ink-2 text-sm font-semibold">
              {nurse.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div>
          <p className="font-semibold text-ink text-sm">{nurse.full_name}</p>
          <p className="text-xs text-ink-3">{nurse.agency_name}</p>
        </div>
        <div className="ml-auto">
          <CredentialBadge credential={nurse.credential_type} />
        </div>
      </div>

      {/* License info */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs mb-3">
        <div>
          <span className="text-ink-3 block">License</span>
          <span className="text-ink font-medium tabular-nums">{nurse.license_number} ({nurse.license_state})</span>
        </div>
        <div>
          <span className="text-ink-3 block">Status</span>
          <span className={`font-medium capitalize ${LICENSE_STATUS_STYLE[nurse.license_status] ?? 'text-ink-2'}`}>
            {nurse.license_status}
          </span>
        </div>
        <div>
          <span className="text-ink-3 block">Expires</span>
          <span className={`font-medium tabular-nums ${licExpiring ? 'text-amber-600' : 'text-ink'}`}>
            {formatDate(nurse.license_expiration)}
            {licExpiring && ' ⚠'}
          </span>
        </div>
        {nurse.iv_certified && (
          <div>
            <span className="text-ink-3 block">IV Certified</span>
            <span className="text-green-700 font-medium">Yes</span>
          </div>
        )}
      </div>

      {/* Health credentials */}
      <div className="border-t border-line pt-2.5 grid grid-cols-3 gap-x-2 gap-y-1 text-xs">
        <div>
          <span className="text-ink-3 block">CPR</span>
          <span className={`tabular-nums ${cprExpiring ? 'text-amber-600 font-medium' : 'text-ink-2'}`}>
            {formatDate(nurse.cpr_expiration)}{cprExpiring && ' ⚠'}
          </span>
        </div>
        <div>
          <span className="text-ink-3 block">TB Test</span>
          <span className="text-ink-2 tabular-nums">{formatDate(nurse.tb_test_date)}</span>
        </div>
        <div>
          <span className="text-ink-3 block">COVID</span>
          <span className={nurse.covid_vaccinated ? 'text-green-700' : 'text-ink-3'}>
            {nurse.covid_vaccinated ? 'Vaccinated' : 'No'}
          </span>
        </div>
      </div>
    </div>
  )
}
