import { useEffect, useState } from 'react'
import { ArrowLeft, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { AdminUser } from '../lib/types'
import type { UserRole } from '../lib/useUserRole'

const ROLE_LABELS: Record<UserRole, string> = {
  famille: 'Famille',
  groom: 'Groom',
  visiteur: 'Visiteur',
  admin: 'Admin',
}

export default function GestionAcces({ onBack }: { onBack: () => void }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('famille')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  async function fetchUsers() {
    setLoading(true)
    const { data, error } = await supabase.rpc('admin_list_users')
    if (error) setError(error.message)
    else setUsers((data as AdminUser[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  async function handleSubmit() {
    if (!email.trim()) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    const { error } = await supabase.rpc('admin_set_user_role', {
      target_email: email.trim(),
      new_role: newRole,
    })
    if (error) {
      setError(error.message)
    } else {
      setSuccess(`Rôle "${ROLE_LABELS[newRole]}" attribué à ${email.trim()}`)
      setEmail('')
      fetchUsers()
    }
    setSubmitting(false)
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-5 pt-5 pb-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-gray-400 hover:text-gray-600 cursor-pointer flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">Gestion des accès</h1>
          <p className="text-xs text-gray-500 mt-0.5">Attribuer un rôle par adresse email</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6 space-y-4">
        {/* Formulaire d'attribution */}
        <section className="bg-white rounded-2xl shadow-xs p-5 space-y-3">
          <div>
            <label className="text-sm font-semibold text-gray-500 block mb-1.5">Adresse email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="prenom@exemple.com"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              La personne doit d'abord avoir créé son compte (écran de connexion) avant de pouvoir lui attribuer un rôle.
            </p>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-500 block mb-1.5">Rôle à attribuer</label>
            <select
              value={newRole}
              onChange={e => setNewRole(e.target.value as UserRole)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700"
            >
              <option value="famille">Famille</option>
              <option value="groom">Groom</option>
              <option value="visiteur">Visiteur</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <Check className="w-4 h-4 flex-shrink-0" />
              {success}
            </p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !email.trim()}
            className="w-full font-bold text-sm py-3 rounded-xl text-white shadow-sm active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-40"
            style={{ backgroundColor: '#2f6b3f' }}
          >
            {submitting ? 'Enregistrement…' : 'Valider le rôle'}
          </button>
        </section>

        {/* Liste des comptes existants */}
        <section>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            Comptes existants ({users.length})
          </p>
          {loading ? (
            <p className="text-sm text-gray-400 italic">Chargement…</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Aucun compte trouvé.</p>
          ) : (
            <div className="space-y-2">
              {users.map(u => (
                <div
                  key={u.id}
                  className="bg-white rounded-xl shadow-xs px-4 py-3 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{u.name ?? u.email}</p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                  <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 uppercase tracking-wider">
                    {ROLE_LABELS[u.role]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
