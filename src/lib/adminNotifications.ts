import type { AdminUser } from './types'

// Clé localStorage — date du compte le plus récent déjà vu par l'admin
export const ADMIN_USERS_LAST_SEEN_KEY = 'pegasus_admin_users_last_seen'

export function newestCreatedAt(users: AdminUser[]): string | null {
  if (users.length === 0) return null
  return users.reduce((max, u) => (u.created_at > max ? u.created_at : max), users[0].created_at)
}
