import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ShiftConfigForm, { type ShiftConfigsByCredential, type ShiftSlot } from '@/components/settings/ShiftConfigForm'
import NotificationPreferencesForm from '@/components/notifications/NotificationPreferencesForm'
import FacilityNotesForm from '@/components/facility/FacilityNotesForm'

export default async function FacilitySettingsPage({ params }: { params: Promise<{ facilityId: string }> }) {
  const { facilityId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()

  const [{ data: existing }, { data: facilityRow }] = await Promise.all([
    supabase
      .from('facility_shift_configs')
      .select('credential_type, shift_name, start_time, end_time')
      .eq('facility_id', facilityId)
      .order('credential_type')
      .order('shift_name'),
    admin
      .from('facilities')
      .select('facility_notes')
      .eq('id', facilityId)
      .single(),
  ])

  // Group by credential type
  const initial: ShiftConfigsByCredential = {}
  for (const row of existing ?? []) {
    const ct = row.credential_type as keyof ShiftConfigsByCredential
    if (!initial[ct]) initial[ct] = []
    ;(initial[ct] as ShiftSlot[]).push({
      shift_name: row.shift_name,
      start_time: row.start_time,
      end_time: row.end_time,
    })
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Configure shift slots for your facility</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Facility Notes for Nurses</h2>
        <p className="text-sm text-gray-500 mb-5">
          Add parking instructions, entry details, unit info, or anything else nurses should know before arriving. Shown on every shift card at your facility.
        </p>
        <FacilityNotesForm facilityId={facilityId} initialNotes={facilityRow?.facility_notes ?? ''} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Shift Configuration</h2>
        <p className="text-sm text-gray-500 mb-5">
          Define the named shift slots available per credential type. These slots will appear
          when you post shifts on the calendar. Each slot needs a name (e.g. &ldquo;Day&rdquo;, &ldquo;Night&rdquo;) and start/end times.
        </p>
        <ShiftConfigForm facilityId={facilityId} initial={initial} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Notification Preferences</h2>
        <p className="text-sm text-gray-500 mb-5">
          Choose which channels you want to receive for each type of notification.
        </p>
        <NotificationPreferencesForm channels={['in_app', 'email']} />
      </div>
    </div>
  )
}
