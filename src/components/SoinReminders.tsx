import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BellRing } from 'lucide-react'
import type { Horse, SoinReminder } from '../lib/types'

// Fenêtre d'affichage : à partir de 7 jours avant la date du rappel,
// et tant qu'il n'a pas été traité (pas de mécanisme de clôture pour l'instant).
const FENETRE_JOURS = 7

function joinFr(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`
}

export default function SoinReminders() {
  const [reminders, setReminders] = useState<SoinReminder[]>([])
  const [horses, setHorses] = useState<Horse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const [{ data: reminderData }, { data: horseData }] = await Promise.all([
        supabase.from('soin_reminders').select('*'),
        supabase.from('horses').select('*'),
      ])
      setReminders((reminderData as SoinReminder[]) ?? [])
      setHorses((horseData as Horse[]) ?? [])
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) return null

  const todayYmd = new Date().toISOString().slice(0, 10)
  const upcoming = reminders
    .filter(r => {
      const daysUntil = (new Date(r.reminder_date).getTime() - new Date(todayYmd).getTime()) / (1000 * 60 * 60 * 24)
      return daysUntil <= FENETRE_JOURS
    })
    .sort((a, b) => a.reminder_date.localeCompare(b.reminder_date))

  if (upcoming.length === 0) return null

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <BellRing className="w-4 h-4 text-gray-500" />
        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Rappels soins</span>
      </div>
      <div className="space-y-2">
        {upcoming.map(r => {
          const horseNames = r.horse_ids
            .map(id => horses.find(h => h.id === id)?.name)
            .filter((n): n is string => !!n)
          return (
            <div key={r.id} className="bg-white rounded-xl shadow-xs px-4 py-3">
              <p className="text-sm font-bold text-gray-800">{r.reminder_text}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {horseNames.length === horses.length ? 'Tous' : joinFr(horseNames)} — avant le{' '}
                {new Date(r.reminder_date + 'T00:00:00').toLocaleDateString('fr-FR')}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
