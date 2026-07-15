export type PayTierConfig = {
  tier_number: 1 | 2 | 3
  custom_label: string
  bonus_amount: number
  bonus_type: 'per_hour' | 'flat'
}

/**
 * Calculate the effective hourly pay for a nurse on a given tier.
 *
 * per_hour: basePay + bonus_amount per hour
 * flat:     basePay + (bonus_amount / hours) — effective hourly given a flat shift bonus
 *           If hours is not provided for a flat bonus, returns basePay only.
 */
export function calculateEffectivePay(
  basePay: number,
  tier: 1 | 2 | 3,
  tierConfigs: PayTierConfig[],
  shiftHours?: number
): number {
  const config = tierConfigs.find(c => c.tier_number === tier)
  if (!config || config.bonus_amount === 0) return basePay

  if (config.bonus_type === 'per_hour') {
    return basePay + config.bonus_amount
  }

  // flat bonus — spread over shift hours for an effective hourly rate
  if (config.bonus_type === 'flat' && shiftHours && shiftHours > 0) {
    return basePay + config.bonus_amount / shiftHours
  }

  return basePay
}

/**
 * Calculate total shift pay (not hourly rate).
 */
export function calculateTotalShiftPay(
  basePay: number,
  tier: 1 | 2 | 3,
  tierConfigs: PayTierConfig[],
  shiftHours: number
): number {
  const config = tierConfigs.find(c => c.tier_number === tier)
  if (!config) return basePay * shiftHours

  if (config.bonus_type === 'per_hour') {
    return (basePay + config.bonus_amount) * shiftHours
  }

  return basePay * shiftHours + config.bonus_amount
}

export function tierLabel(tier: 1 | 2 | 3, tierConfigs: PayTierConfig[]): string {
  const config = tierConfigs.find(c => c.tier_number === tier)
  if (config?.custom_label) return config.custom_label
  return tier === 1 ? 'Regular' : tier === 2 ? 'Urgent' : 'Emergency'
}

export const DEFAULT_TIER_CONFIGS: PayTierConfig[] = [
  { tier_number: 1, custom_label: 'Regular',   bonus_amount: 0, bonus_type: 'per_hour' },
  { tier_number: 2, custom_label: 'Urgent',     bonus_amount: 0, bonus_type: 'per_hour' },
  { tier_number: 3, custom_label: 'Emergency',  bonus_amount: 0, bonus_type: 'per_hour' },
]
