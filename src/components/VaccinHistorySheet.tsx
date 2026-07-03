import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { X, Syringe } from 'lucide-react'
import type { Vaccination } from '../lib/types'
import { VACCINES, type VaccineDbType } from '../lib/vaccineUtils'

interface VaccinHistorySheetProps {
  horseId: string
  horseName: string
  onClose: () => void
}

export default function VaccinHistorySheet({ horseId, horseName, onClose }: VaccinHistorySheetProps) {
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<VaccineDbType | 'tous'>('tous')

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const { data } = await supabase
        .from('vaccinations')
        .select('*')
        .eq('horse_id', horseId)
        .order('injection_date', { ascending: false })
      setVaccinations((data as Vaccination[]) ?? [])
      setLoading(false)
    }
    fetchData()
  }, [horseId])

  const filtered = filter === 'tous' ? vaccinations : vaccinations.filter(v => v.vaccine_type === filter)

  return (
    <div className="fixed inset-0 z-[80] flex justify-center bg-black/5">
      <div className="w-full max-w-[390px] bg-[#F6F2EC] flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0 border-b border-gray-200/60 bg-white/70 backdrop-blur-sm">
          <h2 className="text-base font-black text-gray-900">Historique vaccinal — {horseName}</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* ── Filtres ── */}
        <div className="flex-shrink-0 px-4 pt-3 pb-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter('tous')}
            className="px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all border-2"
            style={
              filter === 'tous'
                ? { borderColor: '#bfe0c9', backgroundColor: '#f0fbf4', color: '#2f6b3f' }
                : { borderColor: '#e5e7eb', backgroundColor: 'white', color: '#4b5563' }
            }
          >
            Tous
          </button>
          {VACCINES.map(v => (
            <button
              key={v.key}
              type="button"
              onClick={() => setFilter(v.dbType)}
              className="px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all border-2"
              style={
                filter === v.dbType
                  ? { borderColor: '#bfe0c9', backgroundColor: '#f0fbf4', color: '#2f6b3f' }
                  : { borderColor: '#e5e7eb', backgroundColor: 'white', color: '#4b5563' }
              }
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* ── Contenu scrollable ── */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-8 pt-2 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Syringe className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-xl p-5 text-center shadow-xs">
              <p className="text-sm font-semibold text-gray-700">Aucune injection enregistrée</p>
            </div>
          ) : (
            filtered.map(v => {
              const def = VACCINES.find(d => d.dbType === v.vaccine_type)
              return (
                <div key={v.id} className="bg-white rounded-xl shadow-xs px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-gray-800">{def?.label ?? v.vaccine_type}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(v.injection_date + 'T00:00:00').toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  {(v.veterinarian || v.location) && (
                    <p className="text-[11px] text-gray-400 mt-1">
                      {[v.veterinarian, v.location].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
