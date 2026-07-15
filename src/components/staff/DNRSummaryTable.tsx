import type { Database } from '@/lib/supabase/types'

interface DNRRow {
  id: string
  created_at: string
  nurse_profiles: {
    id: string
    credential_type: string
    profiles: { full_name: string } | null
  } | null
  facilities: { name: string } | null
}

interface Props {
  records: DNRRow[]
}

const CREDENTIAL_LABELS: Record<string, string> = {
  CNA: 'CNA', CMA: 'CMA', LPN: 'LPN', LPN_IV: 'LPN (IV)', RN: 'RN',
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function DNRSummaryTable({ records }: Props) {
  if (records.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">No DNR records for your roster.</p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2 pr-4">Nurse</th>
            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2 pr-4">Credential</th>
            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2 pr-4">Facility</th>
            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2">Date Issued</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {records.map(rec => (
            <tr key={rec.id}>
              <td className="py-2.5 pr-4 font-medium text-gray-900">
                {rec.nurse_profiles?.profiles?.full_name ?? '—'}
              </td>
              <td className="py-2.5 pr-4 text-gray-600">
                {CREDENTIAL_LABELS[rec.nurse_profiles?.credential_type ?? ''] ?? rec.nurse_profiles?.credential_type ?? '—'}
              </td>
              <td className="py-2.5 pr-4 text-gray-600">
                {rec.facilities?.name ?? '—'}
              </td>
              <td className="py-2.5 text-gray-500">
                {fmtDate(rec.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
