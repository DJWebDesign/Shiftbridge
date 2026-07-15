import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ShiftCalendarView from '@/components/calendar/ShiftCalendarView'

type ShiftSlot = { shift_name: string; start_time: string; end_time: string }
type ShiftConfigsByCredential = Partial<Record<string, ShiftSlot[]>>

export default async function FacilityShiftsPage({ params }: { params: Promise<{ facilityId: string }> }) {
  const { facilityId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-indexed

  const monthFrom = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDay = new Date(year, month + 1, 0).getDate()
  const monthTo = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  // Use admin client — user client silently returns empty for shifts after
  // placeholder migration due to RLS chain complexity (same pattern as claims page).
  const admin = createAdminClient()

  const [{ data: configRows }, { data: initialShifts }, { data: facilityRow }] = await Promise.all([
    admin
      .from('facility_shift_configs')
      .select('credential_type, shift_name, start_time, end_time')
      .eq('facility_id', facilityId)
      .order('credential_type')
      .order('shift_name'),
    admin
      .from('shifts')
      .select('*')
      .eq('facility_id', facilityId)
      .gte('shift_date', monthFrom)
      .lte('shift_date', monthTo)
      .order('shift_date')
      .order('start_time'),
    admin
      .from('facilities')
      .select('name')
      .eq('id', facilityId)
      .single(),
  ])

  // Group configs by credential type
  const shiftConfigs: ShiftConfigsByCredential = {}
  for (const row of configRows ?? []) {
    const ct = row.credential_type
    if (!shiftConfigs[ct]) shiftConfigs[ct] = []
    shiftConfigs[ct]!.push({
      shift_name: row.shift_name,
      start_time: row.start_time,
      end_time: row.end_time,
    })
  }

  const hasConfigs = Object.values(shiftConfigs).some(slots => (slots?.length ?? 0) > 0)

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shifts</h1>
          <p className="text-sm text-gray-500 mt-0.5">Click any day to view or post shifts</p>
        </div>
      </div>

      {!hasConfigs && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-amber-500 text-xl leading-none mt-0.5">⚠</span>
          <div>
            <p className="text-sm font-medium text-amber-800">No shift slots configured</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Define your named shift slots before posting.
            </p>
            <Link
              href={`/facility/${facilityId}/settings`}
              className="inline-block mt-2 text-sm font-medium text-amber-800 underline hover:text-amber-900"
            >
              Go to Settings →
            </Link>
          </div>
        </div>
      )}

      <ShiftCalendarView
        facilityId={facilityId}
        facilityName={facilityRow?.name ?? ''}
        shiftConfigs={shiftConfigs}
        initialShifts={initialShifts ?? []}
        initialYear={year}
        initialMonth={month}
      />
    </div>
  )
}
