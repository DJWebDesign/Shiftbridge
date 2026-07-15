'use client'

import { useState } from 'react'
import { DEFAULT_TIER_CONFIGS, type PayTierConfig } from '@/lib/utils/pay'

const TIER_COLORS = ['bg-background border-line', 'bg-amber-50 border-amber-200', 'bg-red-50 border-red-200']
const TIER_BADGES = ['bg-slate-100 text-slate-600', 'bg-amber-100 text-amber-800', 'bg-red-100 text-red-800']

export default function PayTierForm({
  agencyId,
  initial,
}: {
  agencyId: string
  initial: PayTierConfig[]
}) {
  const base = [1, 2, 3].map(n => {
    const existing = initial.find(t => t.tier_number === n)
    return existing ?? DEFAULT_TIER_CONFIGS[n - 1]
  }) as PayTierConfig[]

  const [tiers, setTiers] = useState<PayTierConfig[]>(base)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState<string | null>(null)

  function update(index: number, field: keyof PayTierConfig, value: string | number) {
    setTiers(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const res = await fetch('/api/settings/pay-tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiers }),
      })
      const data = await res.json()
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        setError(data.error ?? 'Failed to save')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {tiers.map((tier, i) => (
        <div key={tier.tier_number} className={`rounded-xl border p-5 ${TIER_COLORS[i]}`}>
          <div className="flex items-center gap-2 mb-4">
            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${TIER_BADGES[i]}`}>
              {tier.tier_number}
            </span>
            <span className="text-sm font-semibold text-ink">Tier {tier.tier_number}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
              <input
                type="text"
                value={tier.custom_label}
                onChange={e => update(i, 'custom_label', e.target.value)}
                placeholder={i === 0 ? 'Regular' : i === 1 ? 'Urgent' : 'Emergency'}
                maxLength={40}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bonus Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  value={tier.bonus_amount}
                  onChange={e => update(i, 'bonus_amount', parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.50"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bonus Type</label>
              <select
                value={tier.bonus_type}
                onChange={e => update(i, 'bonus_type', e.target.value as 'per_hour' | 'flat')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="per_hour">Per hour</option>
                <option value="flat">Flat (per shift)</option>
              </select>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-3">
            {tier.bonus_amount === 0
              ? 'No bonus — nurse receives base pay only'
              : tier.bonus_type === 'per_hour'
              ? `+$${Number(tier.bonus_amount).toFixed(2)}/hr above base pay`
              : `+$${Number(tier.bonus_amount).toFixed(2)} flat bonus added to shift total`}
          </p>
        </div>
      ))}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save Pay Tiers'}
        </button>
        {saved && (
          <span className="text-sm text-green-600 font-medium">Saved</span>
        )}
      </div>
    </div>
  )
}
