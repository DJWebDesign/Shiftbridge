import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PayTierForm from '@/components/settings/PayTierForm'
import AgencyProfileForm from '@/components/agency/AgencyProfileForm'
import NotificationPreferencesForm from '@/components/notifications/NotificationPreferencesForm'
import ClaimApprovalToggle from '@/components/agency/ClaimApprovalToggle'
import { type PayTierConfig } from '@/lib/utils/pay'

export default async function AgencySettingsPage({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()

  const [{ data: existing }, { data: agency }] = await Promise.all([
    supabase
      .from('pay_tier_configs')
      .select('tier_number, custom_label, bonus_amount, bonus_type')
      .eq('agency_id', agencyId)
      .order('tier_number'),
    admin
      .from('agencies')
      .select('display_name, contact_email, bio, logo_url, require_claim_approval')
      .eq('id', agencyId)
      .single(),
  ])

  const tierConfigs = (existing ?? []) as PayTierConfig[]

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Configure your agency profile and pay tiers</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Agency Profile</h2>
        <p className="text-sm text-gray-500 mb-5">
          Public-facing information shown to facilities and included in coordinator emails.
        </p>
        <AgencyProfileForm
          agencyId={agencyId}
          initial={{
            display_name: agency?.display_name ?? null,
            contact_email: agency?.contact_email ?? null,
            bio: agency?.bio ?? null,
            logo_url: agency?.logo_url ?? null,
          }}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Pay Tier Configuration</h2>
        <p className="text-sm text-gray-500 mb-5">
          Tiers let facilities escalate shift priority. Nurses see their effective pay for each tier.
          Tier 1 is your standard rate. Tiers 2 and 3 add a bonus on top of each nurse's base pay.
        </p>
        <PayTierForm agencyId={agencyId} initial={tierConfigs} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Claim Approval</h2>
        <p className="text-sm text-gray-500 mb-5">
          When enabled, nurses' claims go to you for review before facilities see them.
        </p>
        <ClaimApprovalToggle
          agencyId={agencyId}
          initial={agency?.require_claim_approval ?? false}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Notification Preferences</h2>
        <p className="text-sm text-gray-500 mb-5">
          Choose which channels you want to receive for each type of notification.
        </p>
        <NotificationPreferencesForm channels={['in_app', 'email']} />
      </div>
    </div>
  )
}
