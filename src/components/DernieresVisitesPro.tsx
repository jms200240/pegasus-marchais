import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Stethoscope } from 'lucide-react'
import type { HealthEvent } from '../lib/types'

const METIER_ORDER: { type: HealthEvent['type']; label: string }[] = [
  { type: 'veterinaire', label: 'Vétérinaire' },
  { type: 'marechal', label: 'Maréchal-ferrant' },
  { type: 'osteo', label: 'Ostéopathe' },
  { type: 'dentiste', label: 'Dentiste' },
]

export default function DernieresVisitesPro() {
  const [lastByType, setLastByType] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const [{ data }, { data: vaccData }] = await Promise.all([
        supabase
          .from('health_events')
          .select('type, opened_at')
          .in('type', METIER_ORDER.map(m => m.type)),
        supabase.from('vaccinations').select('injection_date'),
      ])
      const map: Record<string, string> = {}
      for (const row of (data as Pick<HealthEvent, 'type' | 'opened_at'>[]) ?? []) {
        if (!row.type) continue
        if (!map[row.type] || row.opened_at > map[row.type]) map[row.type] = row.opened_at
      }

      // Un vaccin administré compte aussi comme une visite véto, même sans "Soin véto" explicite.
      const lastVaccinDate = (vaccData as { injection_date: string }[] | null ?? []).reduce<string | null>(
        (max, r) => (!r.injection_date ? max : !max || r.injection_date > max ? r.injection_date : max),
        null
      )
      if (lastVaccinDate && (!map.veterinaire || lastVaccinDate > map.veterinaire.slice(0, 10))) {
        map.veterinaire = lastVaccinDate
      }

      setLastByType(map)
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) return null

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Stethoscope className="w-4 h-4 text-gray-500" />
        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Dernières visites pro</span>
      </div>
      <div className="bg-white rounded-xl shadow-xs overflow-hidden divide-y divide-gray-50">
        {METIER_ORDER.map(({ type, label }) => {
          const last = lastByType[type ?? '']
          return (
            <div key={label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-gray-700">{label}</span>
              <span className={`text-xs font-semibold ${last ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                {last ? new Date(last).toLocaleDateString('fr-FR') : 'Aucune visite enregistrée'}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
