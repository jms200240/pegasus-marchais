import { useState } from 'react'
import { Plus, BookOpen, ChevronRight } from 'lucide-react'
import BoboWizard from '../components/BoboWizard'
import VaccineReminders from '../components/VaccineReminders'
import SoinReminders from '../components/SoinReminders'
import DernieresVisitesPro from '../components/DernieresVisitesPro'
import PathologyBrowserSheet from '../components/PathologyBrowserSheet'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Horse } from '../lib/types'

// ─── Page principale ─────────────────────────────────────────────────────────
export default function Soins({ readOnly = false }: { readOnly?: boolean }) {
  const [activeHorses, setActiveHorses] = useState<Horse[]>([])
  const [wizardOpen, setWizardOpen] = useState(false)
  const [pathologyBrowserOpen, setPathologyBrowserOpen] = useState(false)

  useEffect(() => {
    supabase.from('horses').select('*').eq('is_active', true).then(({ data }) => {
      setActiveHorses((data as Horse[]) ?? [])
    })
  }, [])

  return (
    <>
      <div className="flex-1 flex flex-col">
        <div className="px-5 pt-5 pb-3">
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">Soins</h1>
          <p className="text-xs text-gray-500 mt-0.5">Carnet de soins &amp; Bobos</p>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6">

          {/* ── Bouton Signaler un bobo ── */}
          {!readOnly && (
            <button
              onClick={() => setWizardOpen(true)}
              className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold text-sm py-3 rounded-xl shadow-sm active:scale-[0.98] transition-transform cursor-pointer mb-6"
            >
              <Plus className="w-4 h-4" />
              Signaler un bobo
            </button>
          )}

          {/* ── Rappels vaccins ── */}
          <VaccineReminders readOnly={readOnly} />

          {/* ── Rappels soins ── */}
          <SoinReminders />

          {/* ── Dernières visites pro ── */}
          <DernieresVisitesPro />

          {/* ── Fiches maladies ── */}
          <button
            type="button"
            onClick={() => setPathologyBrowserOpen(true)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-xs cursor-pointer hover:border-primary/40 transition-colors mb-6"
          >
            <span className="flex items-center gap-2.5 text-sm font-semibold text-gray-700">
              <BookOpen className="w-4 h-4 text-gray-500" />
              Voir les fiches maladies
            </span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* ── Wizard bobo ── */}
      {wizardOpen && (
        <BoboWizard
          horses={activeHorses}
          onCreated={() => {}}
          onClose={() => setWizardOpen(false)}
        />
      )}

      {/* ── Navigateur de fiches maladies ── */}
      {pathologyBrowserOpen && (
        <PathologyBrowserSheet onClose={() => setPathologyBrowserOpen(false)} />
      )}
    </>
  )
}
