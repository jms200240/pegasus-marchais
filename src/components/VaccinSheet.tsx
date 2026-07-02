import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Horse } from '../lib/types'
import { CANONICAL_ORDER, HORSE_COLORS } from '../lib/types'
import { X, Syringe, Check } from 'lucide-react'

type VaccineType = 'grippe' | 'tetanos' | 'rhino' | 'rage'

const VACCINE_LABELS: Record<VaccineType, string> = {
  grippe: 'Grippe',
  tetanos: 'Tétanos',
  rhino: 'Rhino',
  rage: 'Rage',
}

const VACCINE_ORDER: VaccineType[] = ['grippe', 'tetanos', 'rhino', 'rage']

interface VaccinSheetProps {
  horses: Horse[]
  defaultDate: string // yyyy-mm-dd
  defaultVeterinarian?: string | null
  onClose: () => void
  onSaved: () => void
}

export default function VaccinSheet({
  horses,
  defaultDate,
  defaultVeterinarian,
  onClose,
  onSaved,
}: VaccinSheetProps) {
  const [selectedHorseIds, setSelectedHorseIds] = useState<Set<string>>(new Set())
  const [selectedVaccines, setSelectedVaccines] = useState<Set<VaccineType>>(new Set())
  const [injectionDate, setInjectionDate] = useState(defaultDate)
  const [location, setLocation] = useState('')
  const [veterinarian, setVeterinarian] = useState(defaultVeterinarian ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sortedHorses = [...horses].sort((a, b) => {
    const ia = CANONICAL_ORDER.indexOf(a.name as typeof CANONICAL_ORDER[number])
    const ib = CANONICAL_ORDER.indexOf(b.name as typeof CANONICAL_ORDER[number])
    if (ia === -1 && ib === -1) return a.name.localeCompare(b.name)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })

  const allSelected = horses.length > 0 && selectedHorseIds.size === horses.length

  function toggleHorse(id: string) {
    setSelectedHorseIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelectedHorseIds(allSelected ? new Set() : new Set(horses.map(h => h.id)))
  }

  function toggleVaccine(v: VaccineType) {
    setSelectedVaccines(prev => {
      const next = new Set(prev)
      if (next.has(v)) next.delete(v)
      else next.add(v)
      return next
    })
  }

  async function handleSave() {
    if (selectedHorseIds.size === 0) {
      setError('Sélectionnez au moins un cheval.')
      return
    }
    if (selectedVaccines.size === 0) {
      setError('Sélectionnez au moins un vaccin.')
      return
    }
    if (!injectionDate) {
      setError('Renseignez la date.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const rows: {
        horse_id: string
        vaccine_type: VaccineType
        injection_date: string
        location: string | null
        veterinarian: string | null
      }[] = []

      for (const horseId of selectedHorseIds) {
        for (const vaccine of selectedVaccines) {
          rows.push({
            horse_id: horseId,
            vaccine_type: vaccine,
            injection_date: injectionDate,
            location: location.trim() || null,
            veterinarian: veterinarian.trim() || null,
          })
        }
      }

      const { error: insertErr } = await supabase.from('vaccinations').insert(rows)
      if (insertErr) throw insertErr

      onSaved()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : JSON.stringify(err))
    } finally {
      setSaving(false)
    }
  }

  const nbLignes = selectedHorseIds.size * selectedVaccines.size

  return (
    <div className="fixed inset-0 z-[70] flex justify-center bg-black/5">
      <div className="w-full max-w-[390px] bg-[#F6F2EC] flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0 border-b border-gray-200/60 bg-white/70 backdrop-blur-sm">
          <h2 className="text-base font-black text-gray-900">Vaccin</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* ── Contenu scrollable ── */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-32 pt-4 space-y-5">

          {/* ── Chevaux ── */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Chevaux
              </p>
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs font-bold underline underline-offset-2 cursor-pointer"
                style={{ color: '#2f6b3f' }}
              >
                {allSelected ? 'Aucun' : 'Tous'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {sortedHorses.map(horse => {
                const isSelected = selectedHorseIds.has(horse.id)
                const color = horse.color_hex ?? HORSE_COLORS[horse.name] ?? '#2f6b3f'
                return (
                  <button
                    key={horse.id}
                    type="button"
                    onClick={() => toggleHorse(horse.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold cursor-pointer transition-all active:scale-[0.97] border-2"
                    style={
                      isSelected
                        ? { backgroundColor: color, borderColor: color, color: 'white' }
                        : { backgroundColor: 'white', borderColor: '#e5e7eb', color: '#4b5563' }
                    }
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    {horse.name}
                  </button>
                )
              })}
            </div>
          </section>

          {/* ── Vaccins ── */}
          <section>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Vaccins
            </p>
            <div className="grid grid-cols-2 gap-2">
              {VACCINE_ORDER.map(v => {
                const isSelected = selectedVaccines.has(v)
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => toggleVaccine(v)}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 font-bold text-xs cursor-pointer transition-all active:scale-[0.97]"
                    style={
                      isSelected
                        ? { borderColor: '#bfe0c9', backgroundColor: '#f0fbf4', color: '#2f6b3f' }
                        : { borderColor: '#e5e7eb', backgroundColor: 'white', color: '#4b5563' }
                    }
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                    {VACCINE_LABELS[v]}
                  </button>
                )
              })}
            </div>
          </section>

          {/* ── Date ── */}
          <section>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Date d'injection
            </p>
            <input
              type="date"
              value={injectionDate}
              onChange={e => setInjectionDate(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700"
            />
          </section>

          {/* ── Vétérinaire ── */}
          <section>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Vétérinaire
            </p>
            <input
              type="text"
              value={veterinarian}
              onChange={e => setVeterinarian(e.target.value)}
              placeholder="Nom du vétérinaire"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700"
            />
          </section>

          {/* ── Lieu ── */}
          <section>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Lieu (optionnel)
            </p>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Ex. Bonny-sur-Loire"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700"
            />
          </section>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* ── Bouton Enregistrer (fixe en bas, au-dessus du BottomNav) ── */}
        <div
          className="flex-shrink-0 px-4 pt-3 bg-[#F6F2EC] border-t border-gray-200/60"
          style={{ paddingBottom: 'calc(1rem + 64px + env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || nbLignes === 0}
            className="w-full flex items-center justify-center gap-2 font-bold text-sm py-3 rounded-xl text-white shadow-sm active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: '#2f6b3f' }}
          >
            <Syringe className="w-4 h-4" />
            {saving
              ? 'Enregistrement…'
              : nbLignes > 0
                ? `Enregistrer (${nbLignes} injection${nbLignes > 1 ? 's' : ''})`
                : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
