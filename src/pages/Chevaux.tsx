import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Horse, HealthEvent } from '../lib/types'
import { CANONICAL_ORDER, HORSE_COLORS } from '../lib/types'
import { ChevronRight, ChevronDown, ChevronUp, AlertCircle, Clock, GitBranch } from 'lucide-react'
import { HORSE_PHOTOS } from '../lib/horsePhotos'
import GenealogyTreeSheet from '../components/GenealogyTreeSheet'

interface ChevauxProps {
  onSelectHorse: (id: string) => void
}

// ─── Spinner ──────────────────────────────────────────────────────────
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

// ─── Carte cheval actif ───────────────────────────────────────────────
function HorseCard({
  horse,
  activeEvents,
  onClick,
}: {
  horse: Horse
  activeEvents: HealthEvent[]
  onClick: () => void
}) {
  const color = horse.color_hex ?? HORSE_COLORS[horse.name] ?? '#2f6b3f'
  const hasBobos = activeEvents.length > 0

  // Calcul contraste : texte blanc si couleur sombre
  const isLight = (hex: string) => {
    const c = hex.replace('#', '')
    const r = parseInt(c.slice(0, 2), 16)
    const g = parseInt(c.slice(2, 4), 16)
    const b = parseInt(c.slice(4, 6), 16)
    return (r * 299 + g * 587 + b * 114) / 1000 > 128
  }
  const textColor = isLight(color) ? 'text-gray-900' : 'text-white'
  const subtextColor = isLight(color) ? 'text-gray-700' : 'text-white/80'

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl overflow-hidden shadow-sm active:scale-[0.98] transition-transform cursor-pointer mb-3"
      style={{ backgroundColor: color }}
    >
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Photo miniature ou initiale */}
        <div
          className="w-11 h-11 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center bg-black/15"
        >
          {HORSE_PHOTOS[horse.name] ?? horse.photo_url ? (
            <img
              src={HORSE_PHOTOS[horse.name] ?? horse.photo_url ?? undefined}
              alt={horse.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className={`text-lg font-black ${textColor}`}>
              {horse.name.charAt(0)}
            </span>
          )}
        </div>

        {/* Infos */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-bold text-base leading-tight truncate ${textColor}`}>
              {horse.name}
            </span>
            {hasBobos && (
              <span className="flex-shrink-0 flex items-center gap-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                <AlertCircle className="w-2.5 h-2.5" />
                {activeEvents.length}
              </span>
            )}
          </div>
          <div className={`text-xs mt-0.5 ${subtextColor}`}>
            {horse.race ?? 'Race inconnue'}
            {horse.born_at && (
              <span className="ml-2 opacity-70">
                · {new Date().getFullYear() - new Date(horse.born_at).getFullYear()} ans
              </span>
            )}
          </div>
        </div>

        {/* Chevron */}
        <ChevronRight className={`w-4 h-4 flex-shrink-0 ${subtextColor}`} />
      </div>
    </button>
  )
}

// ─── Page principale ──────────────────────────────────────────────────
export default function Chevaux({ onSelectHorse }: ChevauxProps) {
  const [horses, setHorses] = useState<Horse[]>([])
  const [activeEvents, setActiveEvents] = useState<Record<string, HealthEvent[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [historicalOpen, setHistoricalOpen] = useState(true)
  const [treeOpen, setTreeOpen] = useState(false)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)

      try {
        // Fetch tous les chevaux
        const { data: horsesData, error: horsesErr } = await supabase
          .from('horses')
          .select('*')

        if (horsesErr) throw horsesErr

        // Fetch bobos actifs (status != closed)
        const { data: eventsData, error: eventsErr } = await supabase
          .from('health_events')
          .select('*')
          .in('status', ['open', 'active'])

        if (eventsErr) throw eventsErr

        setHorses(horsesData ?? [])

        // Indexer les events par horse_id
        const eventsMap: Record<string, HealthEvent[]> = {}
        for (const ev of eventsData ?? []) {
          if (!eventsMap[ev.horse_id]) eventsMap[ev.horse_id] = []
          eventsMap[ev.horse_id].push(ev)
        }
        setActiveEvents(eventsMap)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur inconnue'
        setError(msg)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Trier les chevaux actifs selon l'ordre canonique
  const activeHorses = [...(horses.filter(h => h.is_active))].sort((a, b) => {
    const ia = CANONICAL_ORDER.indexOf(a.name as typeof CANONICAL_ORDER[number])
    const ib = CANONICAL_ORDER.indexOf(b.name as typeof CANONICAL_ORDER[number])
    if (ia === -1 && ib === -1) return a.name.localeCompare(b.name)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })

  const historicalHorses = horses.filter(h => !h.is_active)

  if (loading) return (
    <div className="flex-1 p-6 flex flex-col">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Chevaux</h1>
      <p className="text-xs text-gray-500 mb-6">Élevage Scalbert — Les Marchais</p>
      <Spinner />
    </div>
  )

  if (error) return (
    <div className="flex-1 p-6 flex flex-col">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Chevaux</h1>
      <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
        <p className="font-semibold mb-1">Impossible de charger les données</p>
        <p className="text-xs font-mono">{error}</p>
      </div>
    </div>
  )

  return (
    <div className="flex-1 flex flex-col">
      {/* En-tête */}
      <div className="px-5 pt-5 pb-3">
        <h1 className="text-2xl font-bold text-gray-900 leading-tight">Chevaux</h1>
        <p className="text-xs text-gray-500 mt-0.5">Élevage Scalbert — Les Marchais</p>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6">

        {/* ── Chevaux actifs ── */}
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 bg-primary rounded-full"></span>
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Cavalerie active
          </span>
          <span className="text-xs text-gray-400">({activeHorses.length})</span>
        </div>

        {activeHorses.length === 0 ? (
          <p className="text-sm text-gray-400 italic mb-6">Aucun cheval actif trouvé.</p>
        ) : (
          <div className="mb-6">
            {activeHorses.map(horse => (
              <HorseCard
                key={horse.id}
                horse={horse}
                activeEvents={activeEvents[horse.id] ?? []}
                onClick={() => onSelectHorse(horse.id)}
              />
            ))}
          </div>
        )}

        {/* ── Arbre généalogique ── */}
        <button
          type="button"
          onClick={() => setTreeOpen(true)}
          className="w-full flex items-center justify-center gap-2 bg-white border-2 border-primary rounded-xl py-3 mb-6 text-sm font-bold text-primary cursor-pointer hover:bg-primary/5 transition-colors active:scale-[0.98]"
        >
          <GitBranch className="w-4 h-4 text-primary" />
          Arbre généalogique
        </button>

        {/* ── Cavalerie historique ── */}
        {historicalHorses.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setHistoricalOpen(!historicalOpen)}
              className="w-full flex items-center justify-between gap-2 mb-3 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3 text-gray-400" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Cavalerie historique
                </span>
                <span className="text-xs text-gray-400">({historicalHorses.length})</span>
              </div>
              {historicalOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {historicalOpen && (
              <div className="mb-6">
                {historicalHorses.map(horse => (
                  <HorseCard
                    key={horse.id}
                    horse={horse}
                    activeEvents={[]}
                    onClick={() => onSelectHorse(horse.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Arbre généalogique complet ── */}
      {treeOpen && (
        <GenealogyTreeSheet
          onClose={() => setTreeOpen(false)}
          onSelectHorse={id => { setTreeOpen(false); onSelectHorse(id) }}
        />
      )}
    </div>
  )
}
