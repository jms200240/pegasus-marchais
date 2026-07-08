import { useState } from 'react'
import { ArrowLeft, Users } from 'lucide-react'
import GestionAcces from './GestionAcces'

type AdminView = 'menu' | 'acces'

export default function AdminSettings({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<AdminView>('menu')

  if (view === 'acces') return <GestionAcces onBack={() => setView('menu')} />

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
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">Administration</h1>
          <p className="text-xs text-gray-500 mt-0.5">Réservé au rôle Admin</p>
        </div>
      </div>

      <div className="flex-1 px-4 pb-6 space-y-3">
        <button
          type="button"
          onClick={() => setView('acces')}
          className="w-full bg-white rounded-2xl shadow-xs p-5 flex items-center gap-4 text-left cursor-pointer hover:bg-gray-50/70 transition-colors"
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: '#eef2ff', color: '#4A5FA0' }}
          >
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800">Gestion des accès</p>
            <p className="text-xs text-gray-400 mt-0.5">Attribuer ou modifier le rôle d'un utilisateur</p>
          </div>
        </button>
      </div>
    </div>
  )
}
