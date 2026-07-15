export type UserRole = 'super_admin' | 'agency_admin' | 'facility_admin' | 'nurse'

export type Profile = {
  id: string
  role: UserRole
  full_name: string
  email: string
  phone: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}
