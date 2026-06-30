import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Horse, HealthEvent, FarmAlert } from '../lib/types'
import { CANONICAL_ORDER, HORSE_COLORS } from '../lib/types'
import { CheckCircle, Wheat, Droplets, CalendarCheck } from 'lucide-react'
import VisiteSheet from '../components/VisiteSheet'

// ─── Spinner inline ──────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <svg className="animate-spin h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    </div>
  )
}

// ─── Étoiles gravité (lecture seule) ─────────────────────────────────────────
function Stars({ count }: { count: number }) {
  return (
    <span className="text-amber-400 text-xs leading-none">
      {'★'.repeat(Math.min(count, 5))}
      <span className="text-gray-200">{'★'.repeat(Math.max(0, 5 - count))}</span>
    </span>
  )
}

// ─── Page Accueil ─────────────────────────────────────────────────────────────
export default function Accueil() {
  const [horses,  setHorses]  = useState<Horse[]>([])
  const [events,  setEvents]  = useState<HealthEvent[]>([])
  const [alerts,  setAlerts]  = useState<Record<string, boolean>>({ foin: false, eau: false })
  const [loading, setLoading] = useState(true)
  const [visiteOpen, setVisiteOpen] = useState(false)

  async function fetchData() {
    setLoading(true)
    try {
      const [
        { data: horsesData, error: horsesErr },
        { data: eventsData, error: eventsErr },
        { data: alertsData, error: alertsErr },
      ] = await Promise.all([
        supabase.from('horses').select('*'),
        supabase
          .from('health_events')
          .select('*')
          .in('status', ['open', 'active']),
        supabase.from('farm_alerts').select('*'),
      ])
      if (horsesErr) throw horsesErr
      if (eventsErr) throw eventsErr
      if (alertsErr) throw alertsErr

      setHorses(horsesData ?? [])
      setEvents(eventsData ?? [])

      const map: Record<string, boolean> = {}
      ;(alertsData as FarmAlert[] ?? []).forEach(a => { map[a.key] = a.active })
      setAlerts(map)
    } catch (err) {
      console.error('Erreur chargement Accueil:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  // Rafraîchit les données à la fermeture de VisiteSheet
  function handleVisiteClose() {
    setVisiteOpen(false)
    fetchData()
  }

  // ─── Calculs dérivés ────────────────────────────────────────────────────
  const activeHorses = horses.filter(h => h.is_active)
  const activeEvents = events.filter(e => e.status !== 'closed')

  // Par cheval : nb de bobos actifs + gravité max
  interface HorseSummary {
    horse: Horse
    count: number
    maxSeverity: number
  }

  const horseSummaries: HorseSummary[] = activeHorses
    .map(horse => {
      const horseEvents = activeEvents.filter(e => e.horse_id === horse.id)
      const maxSeverity = horseEvents.reduce((max, e) => Math.max(max, e.severity), 0)
      return { horse, count: horseEvents.length, maxSeverity }
    })
    .filter(s => s.count > 0)
    .sort((a, b) => {
      const ia = CANONICAL_ORDER.indexOf(a.horse.name as typeof CANONICAL_ORDER[number])
      const ib = CANONICAL_ORDER.indexOf(b.horse.name as typeof CANONICAL_ORDER[number])
      if (ia === -1 && ib === -1) return a.horse.name.localeCompare(b.horse.name)
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })

  const foinActif = alerts['foin'] === true
  const eauActive = alerts['eau'] === true

  // ─── Rendu ──────────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex-1 flex flex-col">
        {/* En-tête */}
        <div className="px-5 pt-5 pb-3">
          <h1 className="text-2xl font-bold text-gray-900 leading-tight font-sans">Accueil</h1>
          <p className="text-xs text-gray-500 mt-0.5">Tableau de bord — Élevage Scalbert</p>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6 space-y-4">

          {loading ? (
            <Spinner />
          ) : (
            <>
              {/* ── Bannières d'alerte (lecture seule) ── */}
              {(foinActif || eauActive) && (
                <div className="space-y-2">
                  {foinActif && (
                    <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl">
                      <Wheat className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <p className="text-xs font-bold text-amber-700">Alerte foin — commander une botte</p>
                    </div>
                  )}
                  {eauActive && (
                    <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl">
                      <Droplets className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <p className="text-xs font-bold text-amber-700">Alerte eau — vérifier la bassine</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Bouton Démarrer une visite ── */}
              <button
                type="button"
                onClick={() => setVisiteOpen(true)}
                className="w-full flex items-center justify-center gap-2.5 font-bold text-sm text-white rounded-xl shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
                style={{ backgroundColor: '#2f6b3f', minHeight: '56px' }}
              >
                <CalendarCheck className="w-5 h-5" />
                Démarrer une visite
              </button>

              {/* ── Bobos actifs ── */}
              <section>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Bobos actifs
                </p>

                {horseSummaries.length === 0 ? (
                  <div className="bg-white rounded-xl p-5 shadow-xs text-center">
                    <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-gray-700">Tous les chevaux vont bien.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {horseSummaries.map(({ horse, count, maxSeverity }) => {
                      const color = horse.color_hex ?? HORSE_COLORS[horse.name] ?? '#2f6b3f'
                      return (
                        <div
                          key={horse.id}
                          className="bg-white rounded-xl px-4 py-3 shadow-xs flex items-center gap-3"
                        >
                          {/* Badge cheval */}
                          <span
                            className="text-[10px] font-bold px-2.5 py-1 rounded-full text-white flex-shrink-0"
                            style={{ backgroundColor: color }}
                          >
                            {horse.name}
                          </span>

                          {/* Nombre de bobos */}
                          <span className="flex-1 text-xs text-gray-600">
                            <span className="font-bold text-gray-800">{count}</span>{' '}
                            bobo{count > 1 ? 's' : ''} actif{count > 1 ? 's' : ''}
                          </span>

                          {/* Gravité max */}
                          <Stars count={maxSeverity} />
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {/* ── VisiteSheet ── */}
      {visiteOpen && <VisiteSheet onClose={handleVisiteClose} />}
    </>
  )
}
