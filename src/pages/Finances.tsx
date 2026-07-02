import { useState } from 'react'
import { FileText, TrendingUp } from 'lucide-react'
import SaisieFacture from './SaisieFacture'
import SuiviCouts from './SuiviCouts'

type FinancesView = 'menu' | 'saisie' | 'suivi'

export default function Finances() {
  const [view, setView] = useState<FinancesView>('menu')

  if (view === 'saisie') return <SaisieFacture onBack={() => setView('menu')} />
  if (view === 'suivi') return <SuiviCouts onBack={() => setView('menu')} />

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-5 pt-5 pb-3">
        <h1 className="text-2xl font-bold text-gray-900 leading-tight">Finances</h1>
        <p className="text-xs text-gray-500 mt-0.5">Factures &amp; suivi des coûts</p>
      </div>

      <div className="flex-1 px-4 pb-6 space-y-3">
        <button
          type="button"
          onClick={() => setView('saisie')}
          className="w-full bg-white rounded-2xl shadow-xs p-5 flex items-center gap-4 text-left cursor-pointer hover:bg-gray-50/70 transition-colors"
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: '#f0fbf4', color: '#2f6b3f' }}
          >
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800">Saisie de facture</p>
            <p className="text-xs text-gray-400 mt-0.5">Enregistrer une facture et sa ventilation</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setView('suivi')}
          className="w-full bg-white rounded-2xl shadow-xs p-5 flex items-center gap-4 text-left cursor-pointer hover:bg-gray-50/70 transition-colors"
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: '#eef2ff', color: '#4A5FA0' }}
          >
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800">Suivi des coûts</p>
            <p className="text-xs text-gray-400 mt-0.5">Totaux, ventilation par cheval, historique</p>
          </div>
        </button>
      </div>
    </div>
  )
}
