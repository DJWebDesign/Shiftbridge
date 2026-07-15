import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import NurseProfileClient, { type NurseProfileData } from './NurseProfileClient'

export default async function NurseProfilePage({
  params,
}: {
  params: Promise<{ agencyId: string; nurseId: string }>
}) {
  const { agencyId, nurseId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()

  const [{ data: np }, { data: anr }] = await Promise.all([
    admin
      .from('nurse_profiles')
      .select(`
        id, license_number, license_state, credential_type,
        license_status, license_expiration, iv_certified, iv_cert_source,
        cpr_expiration, tb_test_date, covid_vaccinated,
        phone, home_address, home_address_lat, home_address_lng,
        profile_photo_url, nursys_last_checked, created_at,
        profiles ( full_name, email, phone )
      `)
      .eq('id', nurseId)
      .single(),
    admin
      .from('agency_nurse_relationships')
      .select('base_pay_rate, notes, status, created_at')
      .eq('agency_id', agencyId)
      .eq('nurse_profile_id', nurseId)
      .single(),
  ])

  if (!np || !anr) notFound()

  const profile = (np as any).profiles

  const data: NurseProfileData = {
    agencyId,
    nurseId,
    fullName:          profile?.full_name ?? '—',
    email:             profile?.email ?? '',
    phone:             profile?.phone ?? np.phone ?? null,
    homeAddress:       (np as any).home_address ?? null,
    homeAddressLat:    (np as any).home_address_lat ?? null,
    homeAddressLng:    (np as any).home_address_lng ?? null,
    credentialType:    np.credential_type,
    licenseNumber:     np.license_number,
    licenseState:      np.license_state,
    licenseStatus:     np.license_status,
    licenseExpiration: np.license_expiration ?? null,
    ivCertified:       np.iv_certified,
    ivCertSource:      np.iv_cert_source ?? null,
    nursysLastChecked: np.nursys_last_checked ?? null,
    cprExpiration:     np.cpr_expiration ?? null,
    tbTestDate:        np.tb_test_date ?? null,
    covidVaccinated:   np.covid_vaccinated,
    rosterStatus:      anr.status,
    basePayRate:       anr.base_pay_rate ?? null,
    notes:             anr.notes ?? null,
    addedAt:           anr.created_at,
  }

  return <NurseProfileClient data={data} />
}
