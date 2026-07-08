import { useEffect, useState } from 'react'
import { ArrowLeft, Check, Pencil, Ban, RotateCcw, Dices } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { AdminUser } from '../lib/types'
import type { UserRole } from '../lib/useUserRole'
import { ADMIN_USERS_LAST_SEEN_KEY, newestCreatedAt } from '../lib/adminNotifications'

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
  const [selfEmail, setSelfEmail] = useState<string | null>(null)
  const [revokingEmail, setRevokingEmail] = useState<string | null>(null)

  // Création manuelle de compte
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newAccountRole, setNewAccountRole] = useState<UserRole>('famille')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createdInfo, setCreatedInfo] = useState<{ email: string; password: string } | null>(null)

  async function fetchUsers() {
    setLoading(true)
    const { data, error } = await supabase.rpc('admin_list_users')
    if (error) {
      setError(error.message)
    } else {
      const list = (data as AdminUser[]) ?? []
      setUsers(list)
      // La liste vient d'être consultée : on marque le compte le plus récent comme "vu"
      // pour faire disparaître la pastille de la roue crantée.
      const newest = newestCreatedAt(list)
      if (newest) localStorage.setItem(ADMIN_USERS_LAST_SEEN_KEY, newest)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchUsers()
    supabase.auth.getUser().then(({ data }) => setSelfEmail(data.user?.email ?? null))
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

  function handleEdit(u: AdminUser) {
    setEmail(u.email)
    setNewRole(u.role)
    setError(null)
    setSuccess(null)
  }

  function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    let pwd = ''
    for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
    setNewPassword(pwd)
  }

  async function handleCreateAccount() {
    if (!newEmail.trim() || newPassword.length < 6) return
    setCreating(true)
    setCreateError(null)
    setCreatedInfo(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const res = await fetch('/api/admin-create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: newEmail.trim(), password: newPassword, role: newAccountRole }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Erreur inconnue')
      setCreatedInfo({ email: newEmail.trim(), password: newPassword })
      setNewEmail('')
      setNewPassword('')
      setNewAccountRole('famille')
      fetchUsers()
    } catch (err: any) {
      setCreateError(err.message || 'Erreur inconnue')
    } finally {
      setCreating(false)
    }
  }

  async function handleToggleBan(u: AdminUser) {
    const action = u.banned ? 'réactiver' : 'révoquer'
    if (!window.confirm(`Confirmer : ${action} l'accès de ${u.email} ?`)) return

    setRevokingEmail(u.email)
    setError(null)
    setSuccess(null)
    const { error } = await supabase.rpc(u.banned ? 'admin_restore_access' : 'admin_revoke_access', {
      target_email: u.email,
    })
    if (error) {
      setError(error.message)
    } else {
      setSuccess(u.banned ? `Accès réactivé pour ${u.email}` : `Accès révoqué pour ${u.email}`)
      fetchUsers()
    }
    setRevokingEmail(null)
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
        {/* Création manuelle de compte */}
        <section className="bg-white rounded-2xl shadow-xs p-5 space-y-3">
          <p className="text-sm font-bold text-gray-800">Créer un compte manuellement</p>
          <p className="text-[10px] text-gray-400 -mt-2">
            Pour une personne qui n'a pas accès à l'écran de connexion — communique-lui ensuite ces identifiants toi-même.
          </p>

          <div>
            <label className="text-sm font-semibold text-gray-500 block mb-1.5">Adresse email</label>
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="prenom@exemple.com"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-500 block mb-1.5">Mot de passe</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="6 caractères minimum"
                className="flex-1 min-w-0 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700"
              />
              <button
                type="button"
                onClick={generatePassword}
                title="Générer un mot de passe"
                className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 cursor-pointer transition-colors"
              >
                <Dices className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-500 block mb-1.5">Rôle</label>
            <select
              value={newAccountRole}
              onChange={e => setNewAccountRole(e.target.value as UserRole)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700"
            >
              <option value="famille">Famille</option>
              <option value="groom">Groom</option>
              <option value="visiteur">Visiteur</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {createError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{createError}</p>
          )}
          {createdInfo && (
            <div className="text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2 space-y-1">
              <p className="text-green-700 font-semibold flex items-center gap-1.5">
                <Check className="w-4 h-4 flex-shrink-0" />
                Compte créé
              </p>
              <p className="text-gray-700 text-xs">Email : <span className="font-mono">{createdInfo.email}</span></p>
              <p className="text-gray-700 text-xs">Mot de passe : <span className="font-mono">{createdInfo.password}</span></p>
              <p className="text-[10px] text-gray-400">Communique ces identifiants à la personne — ils ne seront plus affichés ensuite.</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleCreateAccount}
            disabled={creating || !newEmail.trim() || newPassword.length < 6}
            className="w-full font-bold text-sm py-3 rounded-xl text-white shadow-sm active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-40"
            style={{ backgroundColor: '#2f6b3f' }}
          >
            {creating ? 'Création…' : 'Créer le compte'}
          </button>
        </section>

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
              {users.map(u => {
                const isSelf = selfEmail !== null && u.email === selfEmail
                return (
                  <div
                    key={u.id}
                    className="bg-white rounded-xl shadow-xs px-4 py-3 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{u.name ?? u.email}</p>
                      <p className="text-xs text-gray-400 truncate">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {u.banned && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 uppercase tracking-wider">
                          Révoqué
                        </span>
                      )}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 uppercase tracking-wider">
                        {ROLE_LABELS[u.role]}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleEdit(u)}
                        title="Modifier le rôle"
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleBan(u)}
                        disabled={isSelf || revokingEmail === u.email}
                        title={isSelf ? 'Impossible de révoquer son propre accès' : u.banned ? "Réactiver l'accès" : "Révoquer l'accès"}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-red-600 cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {u.banned ? <RotateCcw className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
