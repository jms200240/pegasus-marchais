import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Horse, Genealogy, HealthEvent, Pathology } from '../lib/types'
import { HORSE_COLORS, formatDate } from '../lib/types'
import {
  ArrowLeft, ExternalLink, Calendar, Award,
  AlertCircle, CheckCircle, User
} from 'lucide-react'
import BoboCard from '../components/BoboCard'

interface FicheChevalProps {
  horseId: string
  onBack: () => void
  onSelectHorse: (id: string) => void
}

// ─── Spinner inline ────────────────────────────────────────────────────
function Spinner({ color = 'text-white' }: { color?: string }) {
  return (
    <svg className={`animate-spin h-5 w-5 ${color}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}



// ─── Ligne d'identité ─────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="flex justify-between items-start py-2.5 border-b border-gray-100/80 last:border-0">
      <span className="text-xs text-gray-500 font-medium">{label}</span>
      <span className="text-xs font-semibold text-gray-800 text-right max-w-[55%]">{value}</span>
    </div>
  )
}

// ─── Section titre ────────────────────────────────────────────────────
function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-5">
      <Icon className="w-3.5 h-3.5 text-primary" />
      <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">{title}</h2>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────
export default function FicheCheval({ horseId, onBack, onSelectHorse }: FicheChevalProps) {
  const [horse, setHorse] = useState<Horse | null>(null)
  const [genealogy, setGenealogy] = useState<Genealogy | null>(null)
  const [healthEvents, setHealthEvents] = useState<HealthEvent[]>([])
  const [allHorses, setAllHorses] = useState<Pick<Horse, 'id' | 'name' | 'color_hex' | 'is_active'>[]>([])
  const [pathologies, setPathologies] = useState<Pathology[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)

      try {
        const [{ data: horseData, error: horseErr },
               { data: geneData, error: geneErr },
               { data: eventsData, error: eventsErr },
               { data: horsesAll, error: horsesAllErr },
               { data: pathoData, error: pathoErr }] = await Promise.all([
          supabase.from('horses').select('*').eq('id', horseId).single(),
          supabase.from('genealogy').select('*').eq('horse_id', horseId).maybeSingle(),
          supabase.from('health_events').select('*').eq('horse_id', horseId).order('opened_at', { ascending: false }),
          supabase.from('horses').select('id, name, color_hex, is_active'),
          supabase.from('pathologies').select('*'),
        ])

        if (horseErr) throw horseErr
        if (geneErr) throw geneErr
        if (eventsErr) throw eventsErr
        if (horsesAllErr) throw horsesAllErr
        if (pathoErr) throw pathoErr

        setHorse(horseData)
        setGenealogy(geneData ?? null)
        setHealthEvents(eventsData ?? [])
        setAllHorses(horsesAll ?? [])
        setPathologies(pathoData ?? [])
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [horseId])

  const pathById = (id: string | null) => id ? pathologies.find(p => p.id === id) ?? null : null

  // ─── Chargement ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-primary/5">
        <Spinner color="text-primary" />
      </div>
    )
  }

  // ─── Erreur ───────────────────────────────────────────────────────
  if (error || !horse) {
    return (
      <div className="flex-1 p-6">
        <button onClick={onBack} className="flex items-center gap-2 text-primary text-sm font-semibold mb-4 cursor-pointer">
          <ArrowLeft className="w-4 h-4" />Retour
        </button>
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <p className="font-semibold">Impossible de charger la fiche</p>
          <p className="text-xs mt-1 font-mono">{error}</p>
        </div>
      </div>
    )
  }

  const color = horse.color_hex ?? HORSE_COLORS[horse.name] ?? '#2f6b3f'
  const activeEventCount = healthEvents.filter(e => e.status !== 'closed').length

  // Calcul de l'âge depuis born_at
  const age = horse.born_at
    ? new Date().getFullYear() - new Date(horse.born_at).getFullYear()
    : null

  // Résoudre les IDs de parents en noms cliquables
  const findHorseById = (id: string | null) =>
    id ? allHorses.find(h => h.id === id) ?? null : null

  const fatherHorse = findHorseById(genealogy?.pere_id ?? null)
  const motherHorse = findHorseById(genealogy?.mere_id ?? null)

  return (
    <div className="flex-1 flex flex-col overflow-y-auto no-scrollbar">
      {/* ── En-tête coloré ── */}
      <div className="relative" style={{ backgroundColor: color }}>
        {/* Bouton retour */}
        <button
          onClick={onBack}
          className="absolute top-4 left-4 z-10 w-8 h-8 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center cursor-pointer hover:bg-black/30 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>

        {/* Photo ou initiale */}
        <div className="pt-14 pb-6 flex flex-col items-center gap-3">
          <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-white/30 shadow-xl flex items-center justify-center bg-black/20">
            {horse.photo_url ? (
              <img src={horse.photo_url} alt={horse.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl font-black text-white/90">{horse.name.charAt(0)}</span>
            )}
          </div>

          <div className="text-center px-6">
            <h1 className="text-2xl font-black text-white tracking-tight">{horse.name}</h1>
            <p className="text-white/80 text-sm mt-0.5">
              {horse.race ?? 'Race inconnue'}
              {age !== null && <span> · {age} ans</span>}
            </p>
            {activeEventCount > 0 && (
              <span className="mt-2 inline-flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                <AlertCircle className="w-3 h-3" />
                {activeEventCount} bobo{activeEventCount > 1 ? 's' : ''} actif{activeEventCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Contenu ── */}
      <div className="flex-1 bg-[#F6F2EC] px-5 pb-8">

        {/* Identité */}
        <SectionTitle icon={User} title="Identité" />
        <div className="bg-white rounded-xl px-4 py-1 shadow-xs">
          <InfoRow label="Date de naissance" value={formatDate(horse.born_at)} />
          <InfoRow label="Robe" value={horse.robe} />
          <InfoRow label="Nom SIRE" value={horse.sire_name} />
          <InfoRow label="N° SIRE" value={horse.sire_number} />
          <InfoRow label="UELN" value={horse.ueln} />
        </div>

        {/* Lien IFCE */}
        {horse.ifce_url && (
          <a
            href={horse.ifce_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center justify-between px-4 py-3 bg-white rounded-xl shadow-xs cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-semibold text-primary">Fiche IFCE officielle</span>
            <ExternalLink className="w-4 h-4 text-primary" />
          </a>
        )}

        {/* Généalogie */}
        {genealogy && (genealogy.pere_name || genealogy.mere_name) && (
          <>
            <SectionTitle icon={Award} title="Généalogie" />
            <div className="bg-white rounded-xl px-4 py-1 shadow-xs">
              {/* Père */}
              {genealogy.pere_name && (
                <div className="flex justify-between items-center py-2.5 border-b border-gray-100/80">
                  <span className="text-xs text-gray-500 font-medium">Père</span>
                  {fatherHorse ? (
                    <button
                      onClick={() => onSelectHorse(fatherHorse.id)}
                      className="text-xs font-bold text-primary flex items-center gap-1 cursor-pointer"
                    >
                      {genealogy.pere_name}
                      <ChevronRightIcon />
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-gray-800">{genealogy.pere_name}</span>
                  )}
                </div>
              )}
              {/* Mère */}
              {genealogy.mere_name && (
                <div className="flex justify-between items-center py-2.5 border-b border-gray-100/80">
                  <span className="text-xs text-gray-500 font-medium">Mère</span>
                  {motherHorse ? (
                    <button
                      onClick={() => onSelectHorse(motherHorse.id)}
                      className="text-xs font-bold text-primary flex items-center gap-1 cursor-pointer"
                    >
                      {genealogy.mere_name}
                      <ChevronRightIcon />
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-gray-800">{genealogy.mere_name}</span>
                  )}
                </div>
              )}
              {/* Père de mère */}
              {genealogy.pdm_name && (
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-xs text-gray-500 font-medium">Père de mère</span>
                  <span className="text-xs font-semibold text-gray-800">{genealogy.pdm_name}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Historique bobos */}
        <SectionTitle icon={Calendar} title="Historique médical" />
        {healthEvents.length === 0 ? (
          <div className="bg-white rounded-xl p-5 shadow-xs text-center">
            <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-700">Aucun événement médical</p>
            <p className="text-xs text-gray-400 mt-0.5">Ce cheval n'a aucun antécédent enregistré.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {healthEvents.map(event => (
              <BoboCard
                key={event.id}
                event={event}
                horse={horse}
                pathology={pathById(event.pathology_id)}
                showHorseBadge={false}
                onUpdated={async () => {
                  const { data, error } = await supabase
                    .from('health_events')
                    .select('*')
                    .eq('horse_id', horseId)
                    .order('opened_at', { ascending: false })
                  if (!error && data) {
                    setHealthEvents(data)
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Mini chevron inline
function ChevronRightIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
    </svg>
  )
}
