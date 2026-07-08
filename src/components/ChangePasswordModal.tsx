import { useState } from 'react'
import { X, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit() {
    setError(null)
    if (password.length < 6) {
      setError('6 caractères minimum.')
      return
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }
    setSubmitting(true)
    const { error: updateErr } = await supabase.auth.updateUser({ password })
    if (updateErr) {
      setError(updateErr.message)
    } else {
      setSuccess(true)
    }
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 backdrop-blur-sm">
      <div
        className="w-full max-w-md bg-white rounded-t-3xl px-5 pt-5"
        style={{ paddingBottom: 'calc(1rem + 64px + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-800">Changer mon mot de passe</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center cursor-pointer text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-3 flex items-center gap-2 text-green-700 font-semibold">
            <Check className="w-4 h-4 flex-shrink-0" />
            Mot de passe modifié.
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-semibold text-gray-500 block mb-1.5">Nouveau mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                minLength={6}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700"
                placeholder="6 caractères minimum"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-500 block mb-1.5">Confirmer le mot de passe</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full font-bold text-sm py-3 rounded-xl text-white shadow-sm active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-40"
              style={{ backgroundColor: '#2f6b3f' }}
            >
              {submitting ? 'Enregistrement…' : 'Valider'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
