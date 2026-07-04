import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Horse, Genealogy, HealthEvent, Pathology, Vaccination } from '../lib/types'
import { HORSE_COLORS, formatDate } from '../lib/types'
import { HORSE_PHOTOS } from '../lib/horsePhotos'
import { VACCINES, computeStatus } from '../lib/vaccineUtils'
import {
  ArrowLeft, ExternalLink, Award,
  AlertCircle, CheckCircle, User, Syringe, Wrench,
  ChevronDown, ChevronUp, GitBranch
} from 'lucide-react'
import BoboCard from '../components/BoboCard'
import VaccinHistorySheet from '../components/VaccinHistorySheet'
import GenealogyTreeSheet from '../components/GenealogyTreeSheet'

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

// ─── Section pliable, avec compteur et flèche ─────────────────────────
function CollapsibleSection({
  icon: Icon,
  title,
  count,
  open,
  onToggle,
  children,
}: {
  icon: React.ElementType
  title: string
  count: number
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 mb-3 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-primary" />
          <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">{title}</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
            {count}
          </span>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>
      {open && children}
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────
export default function FicheCheval({ horseId, onBack, onSelectHorse }: FicheChevalProps) {
  const [horse, setHorse] = useState<Horse | null>(null)
  const [genealogy, setGenealogy] = useState<Genealogy | null>(null)
  const [allGenealogy, setAllGenealogy] = useState<Pick<Genealogy, 'horse_id' | 'pere_id' | 'mere_id'>[]>([])
  const [healthEvents, setHealthEvents] = useState<HealthEvent[]>([])
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([])
  const [allHorses, setAllHorses] = useState<Pick<Horse, 'id' | 'name' | 'color_hex' | 'is_active'>[]>([])
  const [pathologies, setPathologies] = useState<Pathology[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Sections pliables ──────────────────────────────────────────────
  const [vaccinsOpen, setVaccinsOpen] = useState(false)
  const [soinsOpen, setSoinsOpen] = useState(false)
  const [bobosOpen, setBobosOpen] = useState(false)
  const [vaccinHistoryOpen, setVaccinHistoryOpen] = useState(false)
  const [treeOpen, setTreeOpen] = useState(false)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)

      try {
        const [{ data: horseData, error: horseErr },
               { data: geneData, error: geneErr },
               { data: allGeneData, error: allGeneErr },
               { data: eventsData, error: eventsErr },
               { data: vaccData, error: vaccErr },
               { data: horsesAll, error: horsesAllErr },
               { data: pathoData, error: pathoErr }] = await Promise.all([
          supabase.from('horses').select('*').eq('id', horseId).single(),
          supabase.from('genealogy').select('*').eq('horse_id', horseId).maybeSingle(),
          supabase.from('genealogy').select('horse_id, pere_id, mere_id'),
          supabase.from('health_events').select('*').eq('horse_id', horseId).order('opened_at', { ascending: false }),
          supabase.from('vaccinations').select('*').eq('horse_id', horseId),
          supabase.from('horses').select('id, name, color_hex, is_active'),
          supabase.from('pathologies').select('*'),
        ])

        if (horseErr) throw horseErr
        if (geneErr) throw geneErr
        if (allGeneErr) throw allGeneErr
        if (eventsErr) throw eventsErr
        if (vaccErr) throw vaccErr
        if (horsesAllErr) throw horsesAllErr
        if (pathoErr) throw pathoErr

        setHorse(horseData)
        setGenealogy(geneData ?? null)
        setAllGenealogy(allGeneData ?? [])
        setHealthEvents(eventsData ?? [])
        setVaccinations(vaccData ?? [])
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

  // Soins = interventions pro (Véto/Maréchal/Ostéo/Dentiste) sans pathologie liée —
  // exclut les bobos "Autre" (BoboWizard, note libre) qui n'ont pas de type métier.
  const METIERS_SOIN: (HealthEvent['type'])[] = ['veterinaire', 'marechal', 'osteo', 'dentiste']
  const soins = healthEvents.filter(e => !e.pathology_id && METIERS_SOIN.includes(e.type))
  const bobos = healthEvents.filter(e => !soins.includes(e))

  // Prochains rappels vaccins pour ce cheval (vaccins jamais administrés exclus)
  const vaccinReminders = VACCINES
    .map(vaccine => {
      const rows = vaccinations.filter(v => v.vaccine_type === vaccine.dbType)
      const lastRow = rows.length > 0
        ? rows.reduce((max, r) => (r.injection_date > max.injection_date ? r : max), rows[0])
        : null
      if (!lastRow) return null
      const { nextDue } = computeStatus(lastRow.injection_date, vaccine.cadence, vaccine.alertWindow, vaccine.tolerance)
      if (!nextDue) return null
      return { label: vaccine.label, nextDue }
    })
    .filter((r): r is { label: string; nextDue: string } => !!r)
    .sort((a, b) => a.nextDue.localeCompare(b.nextDue))

  // Calcul de l'âge depuis born_at
  const age = horse.born_at
    ? new Date().getFullYear() - new Date(horse.born_at).getFullYear()
    : null

  // Résoudre les IDs de parents en noms cliquables
  const findHorseById = (id: string | null) =>
    id ? allHorses.find(h => h.id === id) ?? null : null

  const fatherHorse = findHorseById(genealogy?.pere_id ?? null)
  const motherHorse = findHorseById(genealogy?.mere_id ?? null)
  const pdmHorse = findHorseById(genealogy?.pdm_id ?? null)

  // Descendance : chevaux dont ce cheval est père ou mère (résolution inverse)
  const descendants = allGenealogy
    .filter(g => g.pere_id === horse.id || g.mere_id === horse.id)
    .map(g => findHorseById(g.horse_id))
    .filter((h): h is Pick<Horse, 'id' | 'name' | 'color_hex' | 'is_active'> => !!h)

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
        <div className="pt-14 pb-8 px-6 flex items-center gap-4">
          <div className="w-40 h-40 rounded-2xl overflow-hidden border-4 border-white/30 shadow-xl flex items-center justify-center bg-black/20 flex-shrink-0">
            {HORSE_PHOTOS[horse.name] ?? horse.photo_url ? (
              <img src={HORSE_PHOTOS[horse.name] ?? horse.photo_url ?? undefined} alt={horse.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-5xl font-black text-white/90">{horse.name.charAt(0)}</span>
            )}
          </div>

          <div className="min-w-0">
            <h1 className={`font-black text-white tracking-tight leading-tight whitespace-nowrap ${horse.name.length > 10 ? 'text-xl' : 'text-2xl'}`}>
              {horse.name}
            </h1>
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
        {genealogy && (genealogy.pere_name || genealogy.mere_name || genealogy.pdm_name) && (
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
                <div className={`flex justify-between items-center py-2.5 ${descendants.length > 0 ? 'border-b border-gray-100/80' : ''}`}>
                  <span className="text-xs text-gray-500 font-medium">Père de mère</span>
                  {pdmHorse ? (
                    <button
                      onClick={() => onSelectHorse(pdmHorse.id)}
                      className="text-xs font-bold text-primary flex items-center gap-1 cursor-pointer"
                    >
                      {genealogy.pdm_name}
                      <ChevronRightIcon />
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-gray-800">{genealogy.pdm_name}</span>
                  )}
                </div>
              )}
              {/* Descendance */}
              {descendants.length > 0 && (
                <div className="flex justify-between items-start py-2.5">
                  <span className="text-xs text-gray-500 font-medium pt-0.5">Descendance</span>
                  <div className="flex flex-wrap justify-end gap-x-1.5 gap-y-1 max-w-[65%]">
                    {descendants.map((d, idx) => (
                      <button
                        key={d.id}
                        onClick={() => onSelectHorse(d.id)}
                        className="text-xs font-bold text-primary flex items-center gap-1 cursor-pointer"
                      >
                        {d.name}{idx < descendants.length - 1 ? ',' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Lien vers l'arbre généalogique ciblé ── */}
        <button
          type="button"
          onClick={() => setTreeOpen(true)}
          className="mt-3 w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl shadow-xs cursor-pointer hover:bg-gray-50 transition-colors"
        >
          <span className="text-sm font-semibold text-primary">Voir dans l'arbre généalogique</span>
          <GitBranch className="w-4 h-4 text-primary" />
        </button>

        {/* ── Vaccins / Soins / Bobos (cavalerie active uniquement) ── */}
        {horse.is_active && (
        <>
        <CollapsibleSection
          icon={Syringe}
          title="Vaccins"
          count={vaccinReminders.length}
          open={vaccinsOpen}
          onToggle={() => setVaccinsOpen(!vaccinsOpen)}
        >
          <div className="space-y-2">
            {vaccinReminders.length === 0 ? (
              <div className="bg-white rounded-xl p-5 shadow-xs text-center">
                <p className="text-sm font-semibold text-gray-700">Aucun rappel connu</p>
              </div>
            ) : (
              vaccinReminders.map(r => (
                <div key={r.label} className="bg-white rounded-xl shadow-xs px-4 py-3 flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-800">{r.label}</p>
                  <p className="text-xs text-gray-500">
                    avant le {new Date(r.nextDue + 'T00:00:00').toLocaleDateString('fr-FR')}
                  </p>
                </div>
              ))
            )}
            <button
              type="button"
              onClick={() => setVaccinHistoryOpen(true)}
              className="text-xs font-semibold text-primary underline underline-offset-2 cursor-pointer"
            >
              Historique complet
            </button>
          </div>
        </CollapsibleSection>

        {/* ── Soins (Véto / Maréchal / Ostéo / Dentiste, hors vaccins) ── */}
        <CollapsibleSection
          icon={Wrench}
          title="Soins"
          count={soins.length}
          open={soinsOpen}
          onToggle={() => setSoinsOpen(!soinsOpen)}
        >
          {soins.length === 0 ? (
            <div className="bg-white rounded-xl p-5 shadow-xs text-center">
              <p className="text-sm font-semibold text-gray-700">Aucun soin enregistré</p>
            </div>
          ) : (
            <div className="space-y-2">
              {soins.map(event => (
                <BoboCard
                  key={event.id}
                  event={event}
                  horse={horse}
                  pathology={null}
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
        </CollapsibleSection>

        {/* ── Bobos ── */}
        <CollapsibleSection
          icon={AlertCircle}
          title="Bobos"
          count={bobos.length}
          open={bobosOpen}
          onToggle={() => setBobosOpen(!bobosOpen)}
        >
          {bobos.length === 0 ? (
            <div className="bg-white rounded-xl p-5 shadow-xs text-center">
              <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-700">Aucun bobo enregistré</p>
            </div>
          ) : (
            <div className="space-y-2">
              {bobos.map(event => (
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
        </CollapsibleSection>
        </>
        )}
      </div>

      {/* ── Historique vaccinal complet ── */}
      {vaccinHistoryOpen && (
        <VaccinHistorySheet
          horseId={horseId}
          horseName={horse.name}
          onClose={() => setVaccinHistoryOpen(false)}
        />
      )}

      {/* ── Arbre généalogique ciblé sur ce cheval ── */}
      {treeOpen && (
        <GenealogyTreeSheet
          focusHorseId={horse.id}
          onClose={() => setTreeOpen(false)}
          onSelectHorse={id => { setTreeOpen(false); onSelectHorse(id) }}
        />
      )}
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
