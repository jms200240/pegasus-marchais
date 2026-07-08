import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Session } from '@supabase/supabase-js'

export type UserRole = 'famille' | 'groom' | 'visiteur' | 'admin'

// En cas d'erreur ou de ligne manquante dans public.users, on retombe sur le
// rôle le plus restrictif (visiteur) plutôt que sur 'famille' — fail-closed.
export function useUserRole(session: Session | null): UserRole | null {
  const [role, setRole] = useState<UserRole | null>(null)

  useEffect(() => {
    if (!session) {
      setRole(null)
      return
    }
    supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        setRole(!error && data?.role ? (data.role as UserRole) : 'visiteur')
      })
  }, [session])

  return role
}
