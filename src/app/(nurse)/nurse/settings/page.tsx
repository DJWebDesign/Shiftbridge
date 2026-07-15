import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NotificationPreferencesForm from '@/components/notifications/NotificationPreferencesForm'

export default async function NurseSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your notification preferences</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Notification Preferences</h2>
        <p className="text-sm text-gray-500 mb-5">
          Choose which channels you want to receive for each type of notification.
        </p>
        <NotificationPreferencesForm channels={['in_app', 'email', 'sms']} />
      </div>
    </div>
  )
}
