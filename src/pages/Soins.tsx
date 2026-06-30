import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Horse, HealthEvent, Pathology } from '../lib/types'
import { Plus, CheckCircle } from 'lucide-react'
import BoboWizard from '../components/BoboWizard'
import BoboCard from '../components/BoboCard'

// ─── Spinner inline ─────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <svg className="animate-spin h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    </div>
  )
}

// ─── Page principale ─────────────────────────────────────────────────────────
export default function Soins() {
  const [horses, setHorses] = useState<Horse[]>([])
  const [events, setEvents] = useState<HealthEvent[]>([])
  const [pathologies, setPathologies] = useState<Pathology[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const [
        { data: horsesData,     error: horsesErr     },
        { data: eventsData,     error: eventsErr     },
        { data: pathoData,      error: pathoErr      },
      ] = await Promise.all([
        supabase.from('horses').select('*'),
        supabase.from('health_events').select('*').order('opened_at', { ascending: false }),
        supabase.from('pathologies').select('*'),
      ])
      if (horsesErr) throw horsesErr
      if (eventsErr) throw eventsErr
      if (pathoErr)  throw pathoErr

      setHorses(horsesData    ?? [])
      setEvents(eventsData    ?? [])
      setPathologies(pathoData ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const horseById  = (id: string)        => horses.find(h => h.id === id) ?? null
  const pathById   = (id: string | null) => id ? pathologies.find(p => p.id === id) ?? null : null

  const activeHorses   = horses.filter(h => h.is_active)
  const activeEvents   = events.filter(e => e.status !== 'closed')
  const resolvedEvents = events.filter(e => e.status === 'closed')

  if (loading) {
    return (
      <div className="flex-1 p-6 flex flex-col">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Soins</h1>
        <p className="text-xs text-gray-500 mb-6">Carnet de soins &amp; Bobos</p>
        <Spinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 p-6 flex flex-col">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Soins</h1>
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <p className="font-semibold mb-1">Impossible de charger les données</p>
          <p className="text-xs font-mono">{error}</p>
        </div>
      </div>
    )
  }

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

          {/* ── Bobos actifs ── */}
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 bg-red-500 rounded-full" />
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Bobos actifs
            </span>
            <span className="text-xs text-gray-400">({activeEvents.length})</span>
          </div>

          {activeEvents.length === 0 ? (
            <div className="bg-white rounded-xl p-5 shadow-xs text-center mb-6">
              <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-700">Aucun bobo actif</p>
              <p className="text-xs text-gray-400 mt-0.5">Tous les chevaux vont bien.</p>
            </div>
          ) : (
            <div className="space-y-2 mb-6">
              {activeEvents.map(event => (
                <BoboCard
                  key={event.id}
                  event={event}
                  horse={horseById(event.horse_id)}
                  pathology={pathById(event.pathology_id)}
                  onUpdated={fetchData}
                />
              ))}
            </div>
          )}

          {/* ── Bobos résolus ── */}
          {resolvedEvents.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 bg-green-400 rounded-full" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Historique résolus
                </span>
                <span className="text-xs text-gray-400">({resolvedEvents.length})</span>
              </div>
              <div className="space-y-2">
                {resolvedEvents.map(event => (
                  <BoboCard
                    key={event.id}
                    event={event}
                    horse={horseById(event.horse_id)}
                    pathology={pathById(event.pathology_id)}
                    onUpdated={fetchData}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Wizard bobo ── */}
      {wizardOpen && (
        <BoboWizard
          horses={activeHorses}
          onCreated={fetchData}
          onClose={() => setWizardOpen(false)}
        />
      )}
    </>
  )
}
