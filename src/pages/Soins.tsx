import { useState } from 'react'
import { Plus } from 'lucide-react'
import BoboWizard from '../components/BoboWizard'
import VaccineReminders from '../components/VaccineReminders'
import SoinReminders from '../components/SoinReminders'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Horse } from '../lib/types'

// ─── Page principale ─────────────────────────────────────────────────────────
export default function Soins() {
  const [activeHorses, setActiveHorses] = useState<Horse[]>([])
  const [wizardOpen, setWizardOpen] = useState(false)

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

          {/* ── Rappels vaccins ── */}
          <VaccineReminders />

          {/* ── Rappels soins ── */}
          <SoinReminders />
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
