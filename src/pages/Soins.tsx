import { useState } from 'react'
import { Plus, Syringe } from 'lucide-react'
import BoboWizard from '../components/BoboWizard'
import VaccineReminders from '../components/VaccineReminders'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Horse } from '../lib/types'
import type { VaccineSummary } from '../lib/vaccineUtils'

function formatYmdFr(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

// ─── Page principale ─────────────────────────────────────────────────────────
export default function Soins() {
  const [activeHorses, setActiveHorses] = useState<Horse[]>([])
  const [wizardOpen, setWizardOpen] = useState(false)
  const [vaccineSummary, setVaccineSummary] = useState<VaccineSummary | null>(null)

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
          <button
            onClick={() => setWizardOpen(true)}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold text-sm py-3 rounded-xl shadow-sm active:scale-[0.98] transition-transform cursor-pointer mb-6"
          >
            <Plus className="w-4 h-4" />
            Signaler un bobo
          </button>

          {/* ── Prochains vaccins (résumé) ── */}
          {vaccineSummary && (
            <div className="flex items-center gap-2.5 bg-white rounded-xl px-4 py-3 shadow-xs mb-3">
              <Syringe className="w-4 h-4 flex-shrink-0 text-gray-400" />
              <p className="text-xs text-gray-700">
                <span className="font-bold">Prochains vaccins avant le {formatYmdFr(vaccineSummary.date)}</span>
                {' — '}
                {vaccineSummary.allActive ? 'Tous' : vaccineSummary.horseNames.join(', ')}
              </p>
            </div>
          )}

          {/* ── Rappels vaccins ── */}
          <VaccineReminders onSummaryChange={setVaccineSummary} />
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
    </>
  )
}
