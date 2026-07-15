import type { User } from '@supabase/supabase-js'

export function isDemoUser(user: User | null): boolean {
  return user?.app_metadata?.role === 'demo'
}
