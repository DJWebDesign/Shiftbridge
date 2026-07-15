// Single source of truth for credential + tier badge colors.
// Colors are defined once in globals.css (.cred-*, .tier-badge-*) — do not
// re-declare per-component color maps; every screen should agree on what
// an RN badge (or a Priority tier) looks like.

const CREDENTIAL_LABELS: Record<string, string> = {
  CNA: 'CNA', CMA: 'CMA', LPN: 'LPN', LPN_IV: 'LPN/IV', RN: 'RN',
}

const TIER_LABELS: Record<number, string> = {
  1: 'Standard', 2: 'Priority', 3: 'Urgent',
}

const TIER_CLASS: Record<number, string> = {
  1: 'tier-badge-standard', 2: 'tier-badge-priority', 3: 'tier-badge-urgent',
}

export function CredentialBadge({
  credential, className = '',
}: { credential: string; className?: string }) {
  return (
    <span className={`badge cred-${credential} ${className}`}>
      {CREDENTIAL_LABELS[credential] ?? credential}
    </span>
  )
}

export function TierBadge({
  tier, label, className = '',
}: { tier: number; label?: string; className?: string }) {
  return (
    <span className={`badge ${TIER_CLASS[tier] ?? 'tier-badge-standard'} ${className}`}>
      {label ?? TIER_LABELS[tier] ?? `Tier ${tier}`}
    </span>
  )
}
