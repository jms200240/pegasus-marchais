import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Horse, HealthEvent, HealthEventVisit, Pathology } from '../lib/types'
import { CANONICAL_ORDER, HORSE_COLORS } from '../lib/types'
import { X, ChevronDown, ChevronUp, Plus, CheckCircle, Camera, Stethoscope, Wrench, Activity, Smile } from 'lucide-react'
import { getBoboTitle, Stars, VisitModal } from './BoboCard'
import BoboWizard from './BoboWizard'

// ─── Utilitaire datetime-local ────────────────────────────────────────────────
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    d.getFullYear() +
    '-' + pad(d.getMonth() + 1) +
    '-' + pad(d.getDate()) +
    'T' + pad(d.getHours()) +
    ':' + pad(d.getMinutes())
  )
}

function fromDatetimeLocal(val: string): string {
  return new Date(val).toISOString()
}

// ─── Types locaux ─────────────────────────────────────────────────────────────
interface ActiveBobo {
  event: HealthEvent
  horse: Horse | null
  pathology: Pathology | null
  lastVisit: HealthEventVisit | null
}

type Evolution = 'Amélioré' | 'Stable' | 'Aggravé' | 'Résolu'
type Metier = 'veterinaire' | 'marechal' | 'osteopathe' | 'dentiste'

const METIER_LABELS: Record<Metier, string> = {
  veterinaire: 'Vétérinaire',
  marechal: 'Maréchal-ferrant',
  osteopathe: 'Ostéopathe',
  dentiste: 'Dentiste',
}

const METIER_ICONS: Record<Metier, typeof Stethoscope> = {
  veterinaire: Stethoscope,
  marechal: Wrench,
  osteopathe: Activity,
  dentiste: Smile,
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
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

// ─── VisiteProSheet ──────────────────────────────────────────────────────────────
interface VisiteProSheetProps {
  onClose: () => void
}

export default function VisiteProSheet({ onClose }: VisiteProSheetProps) {
  // ── Horodatage de la session ─────────────────────────────────────────────
  const [visitedAt, setVisitedAt] = useState<string>(toDatetimeLocal(new Date().toISOString()))

  // ── Sélection du métier ──────────────────────────────────────────────────
  const [metier, setMetier] = useState<Metier | null>(null)

  // ── Vétérinaire présent (picker — câblage complet au step suivant) ───────
  const [vetName, setVetName] = useState<string | null>(null)

  // ── Bobos actifs ─────────────────────────────────────────────────────────
  const [bobos, setBobos] = useState<ActiveBobo[]>([])
  const [bobosLoading, setBobosLoading] = useState(true)
  const [openBoboId, setOpenBoboId] = useState<string | null>(null)

  // ── Actions en cours ─────────────────────────────────────────────────────
  const [savingBoboId, setSavingBoboId] = useState<string | null>(null)
  const [boboErrors, setBoboErrors] = useState<Record<string, string>>({})

  // ── VisitModal suivi complet ──────────────────────────────────────────────
  const [visitModalBoboId, setVisitModalBoboId] = useState<string | null>(null)

  // ── Suivi des bobos modifiés individuellement durant la session ──────────
  const [touchedIds, setTouchedIds] = useState<Set<string>>(new Set())
  const [remainingSaving, setRemainingSaving] = useState(false)
  const [remainingError, setRemainingError] = useState<string | null>(null)
  const [remainingDone, setRemainingDone] = useState(false)

  // ── Photos d'ambiance ──────────────────────────────────────────────────────
  const [ambianceUploading, setAmbianceUploading] = useState(false)
  const [ambianceMessage, setAmbianceMessage] = useState<string | null>(null)

  // ── BoboWizard ───────────────────────────────────────────────────────────
  const [wizardOpen, setWizardOpen] = useState(false)
  const [horses, setHorses] = useState<Horse[]>([])

  // ─── Fetch bobos actifs ───────────────────────────────────────────────────
  async function fetchBobos() {
    setBobosLoading(true)
    try {
      const [
        { data: horsesData, error: horsesErr },
        { data: eventsData, error: eventsErr },
        { data: pathoData,  error: pathoErr  },
      ] = await Promise.all([
        supabase.from('horses').select('*'),
        supabase
          .from('health_events')
          .select('*')
          .in('status', ['open', 'active'])
          .order('opened_at', { ascending: false }),
        supabase.from('pathologies').select('*'),
      ])
      if (horsesErr) throw horsesErr
      if (eventsErr) throw eventsErr
      if (pathoErr)  throw pathoErr

      const horsesArr: Horse[]       = horsesData ?? []
      const eventsArr: HealthEvent[] = eventsData ?? []
      const pathoArr: Pathology[]    = pathoData  ?? []

      setHorses(horsesArr.filter(h => h.is_active))

      const boboList: ActiveBobo[] = []
      for (const event of eventsArr) {
        const horse = horsesArr.find(h => h.id === event.horse_id) ?? null
        const patho = event.pathology_id
          ? pathoArr.find(p => p.id === event.pathology_id) ?? null
          : null

        const { data: visitsData } = await supabase
          .from('health_event_visits')
          .select('*')
          .eq('health_event_id', event.id)
          .order('visited_at', { ascending: false })
          .limit(1)

        const lastVisit: HealthEventVisit | null =
          visitsData && visitsData.length > 0 ? visitsData[0] : null

        boboList.push({ event, horse, pathology: patho, lastVisit })
      }

      boboList.sort((a, b) => {
        const nameA = a.horse?.name ?? ''
        const nameB = b.horse?.name ?? ''
        const ia = CANONICAL_ORDER.indexOf(nameA as typeof CANONICAL_ORDER[number])
        const ib = CANONICAL_ORDER.indexOf(nameB as typeof CANONICAL_ORDER[number])
        if (ia === -1 && ib === -1) return nameA.localeCompare(nameB)
        if (ia === -1) return 1
        if (ib === -1) return -1
        return ia - ib
      })

      setBobos(boboList)
    } catch (err) {
      console.error('Erreur chargement bobos:', err)
    } finally {
      setBobosLoading(false)
    }
  }

  useEffect(() => { fetchBobos() }, [])

  // ─── Calcul sévérité selon évolution ─────────────────────────────────────
  function computeSeverity(current: number, evolution: Evolution): number {
    if (evolution === 'Amélioré') return Math.max(1, current - 1)
    if (evolution === 'Aggravé')  return Math.min(5, current + 1)
    return current
  }

  function computeStatus(evolution: Evolution): 'active' | 'closed' {
    return evolution === 'Résolu' ? 'closed' : 'active'
  }

  // ─── Enregistrer une évolution, avec mention du contexte "visite pro" ───
  // Hypothèse : pas de colonne dédiée intervenant_type sur health_event_visits,
  // donc le contexte est ajouté au texte de la note. À corriger si une colonne existe.
  async function handleEvolution(bobo: ActiveBobo, evolution: Evolution) {
    const eventId = bobo.event.id
    setSavingBoboId(eventId)
    setBoboErrors(prev => { const n = { ...prev }; delete n[eventId]; return n })

    try {
      const currentSeverity = bobo.lastVisit?.severity ?? bobo.event.severity
      const newSeverity = computeSeverity(currentSeverity, evolution)
      const newStatus   = computeStatus(evolution)
      const visitedAtISO = fromDatetimeLocal(visitedAt)
      const metierLabel = metier ? METIER_LABELS[metier] : 'pro'
      const noteSuffix = vetName ? ` (visite ${metierLabel} — ${vetName})` : ` (visite ${metierLabel})`

      const { error: insertErr } = await supabase
        .from('health_event_visits')
        .insert({
          health_event_id: eventId,
          status:          newStatus,
          severity:        newSeverity,
          note:            evolution + noteSuffix,
          visited_at:      visitedAtISO,
        })
      if (insertErr) throw insertErr

      const updateFields: {
        status: 'active' | 'closed'
        severity: number
        closed_at: string | null
      } = {
        status:    newStatus,
        severity:  newSeverity,
        closed_at: newStatus === 'closed' ? new Date().toISOString() : null,
      }
      const { error: updateErr } = await supabase
        .from('health_events')
        .update(updateFields)
        .eq('id', eventId)
      if (updateErr) throw updateErr

      setOpenBoboId(null)
      setTouchedIds(prev => new Set(prev).add(eventId))
      await fetchBobos()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err)
      setBoboErrors(prev => ({ ...prev, [eventId]: msg }))
    } finally {
      setSavingBoboId(null)
    }
  }

  // ─── Validation des bobos non touchés individuellement ("Pour les autres") ──
  async function handleRemainingStable() {
    const remaining = bobos.filter(b => !touchedIds.has(b.event.id))
    if (remaining.length === 0) {
      setRemainingDone(true)
      return
    }
    setRemainingSaving(true)
    setRemainingError(null)
    try {
      const visitedAtISO = fromDatetimeLocal(visitedAt)
      const metierLabel = metier ? METIER_LABELS[metier] : 'pro'
      const noteSuffix = vetName ? ` (visite ${metierLabel} — ${vetName})` : ` (visite ${metierLabel})`
      for (const bobo of remaining) {
        const currentSeverity = bobo.lastVisit?.severity ?? bobo.event.severity
        const { error: insertErr } = await supabase
          .from('health_event_visits')
          .insert({
            health_event_id: bobo.event.id,
            status:          'active',
            severity:        currentSeverity,
            note:            'Stable' + noteSuffix,
            visited_at:      visitedAtISO,
          })
        if (insertErr) throw insertErr

        const { error: updateErr } = await supabase
          .from('health_events')
          .update({ status: 'active', severity: currentSeverity, closed_at: null })
          .eq('id', bobo.event.id)
        if (updateErr) throw updateErr
      }
      await fetchBobos()
      setRemainingDone(true)
    } catch (err: unknown) {
      setRemainingError(err instanceof Error ? err.message : JSON.stringify(err))
    } finally {
      setRemainingSaving(false)
    }
  }

  // ─── Upload des photos d'ambiance ────────────────────────────────────────
  async function handleAmbiancePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return

    setAmbianceUploading(true)
    setAmbianceMessage(null)
    try {
      const visitedAtISO = fromDatetimeLocal(visitedAt)
      const rows: { visited_at: string; photo_url: string; storage_path: string }[] = []

      for (const file of files) {
        const path = `${Date.now()}-${file.name}`
        const { error: uploadErr } = await supabase.storage
          .from('ambiance-photos')
          .upload(path, file)
        if (uploadErr) throw uploadErr

        const { data: signedData, error: signedErr } = await supabase.storage
          .from('ambiance-photos')
          .createSignedUrl(path, 60 * 60 * 24 * 365)
        if (signedErr) throw signedErr

        if (signedData?.signedUrl) {
          rows.push({ visited_at: visitedAtISO, photo_url: signedData.signedUrl, storage_path: path })
        }
      }

      if (rows.length > 0) {
        const { error: insertErr } = await supabase.from('ambiance_photos').insert(rows)
        if (insertErr) throw insertErr
      }

      setAmbianceMessage(`${rows.length} photo${rows.length > 1 ? 's' : ''} ajoutée${rows.length > 1 ? 's' : ''}.`)
    } catch (err: unknown) {
      setAmbianceMessage(
        err instanceof Error ? `Erreur : ${err.message}` : "Erreur lors de l'envoi."
      )
    } finally {
      setAmbianceUploading(false)
    }
  }

  const visitModalBobo = visitModalBoboId !== null
    ? bobos.find(b => b.event.id === visitModalBoboId) ?? null
    : null

  const title = metier ? `Visite ${vetName ?? METIER_LABELS[metier]}` : 'Visite pro'

  // ─── Rendu ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="fixed inset-0 z-[60] flex justify-center bg-black/5">
      <div className="w-full max-w-[390px] bg-[#F6F2EC] flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0 border-b border-gray-200/60 bg-white/70 backdrop-blur-sm">
          <h2 className="text-base font-black text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* ── Contenu scrollable ── */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-24 pt-4 space-y-5">

          {/* ── Horodatage de la session (toujours visible) ── */}
          <section>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Horodatage de la visite
            </p>
            <input
              type="datetime-local"
              value={visitedAt}
              onChange={e => setVisitedAt(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700"
            />
          </section>

          {/* ── Sélecteur métier (tant que non choisi) ── */}
          {!metier && (
            <section>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Intervenant
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(METIER_LABELS) as Metier[]).map(m => {
                  const Icon = METIER_ICONS[m]
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMetier(m)}
                      className="flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-gray-200 bg-white text-gray-700 font-bold text-sm cursor-pointer hover:border-primary/40 transition-all active:scale-[0.97]"
                    >
                      <Icon className="w-6 h-6" />
                      {METIER_LABELS[m]}
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {/* ── Contenu post-sélection métier ── */}
          {metier === 'veterinaire' && (
            <>
              {/* ── Vétérinaire présent (picker photos — câblage au step suivant) ── */}
              <section>
                <button
                  type="button"
                  onClick={() => { /* TODO step suivant : ouvre le picker photo classé par rang (Vétérinaires Escavet.xlsx) */ }}
                  className="w-full flex items-center justify-center gap-2 font-bold text-sm py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-600 cursor-pointer hover:border-primary/40 transition-all"
                >
                  <Stethoscope className="w-4 h-4" />
                  {vetName ?? 'Vétérinaire présent'}
                </button>
              </section>

              {/* ── Bobos actifs ── */}
              <section>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Bobos actifs
                </p>

                {bobosLoading ? (
                  <Spinner />
                ) : bobos.length === 0 ? (
                  <div className="bg-white rounded-xl p-5 text-center shadow-xs">
                    <p className="text-sm font-semibold text-gray-700">Aucun bobo actif 🎉</p>
                    <p className="text-xs text-gray-400 mt-1">Tous les chevaux vont bien.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {bobos.map(bobo => {
                      const { event, horse, pathology, lastVisit } = bobo
                      const horseColor = horse?.color_hex ?? (horse ? HORSE_COLORS[horse.name] : null) ?? '#2f6b3f'
                      const titre = getBoboTitle(event, pathology)
                      const currentSeverity = lastVisit?.severity ?? event.severity
                      const isOpen = openBoboId === event.id
                      const isSaving = savingBoboId === event.id
                      const errMsg = boboErrors[event.id]

                      return (
                        <div key={event.id} className="bg-white rounded-xl shadow-xs overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setOpenBoboId(isOpen ? null : event.id)}
                            className="w-full flex items-center gap-2.5 px-4 py-3 text-left cursor-pointer hover:bg-gray-50/70 transition-colors"
                          >
                            {horse && (
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0"
                                style={{ backgroundColor: horseColor }}
                              >
                                {horse.name}
                              </span>
                            )}
                            <span className="flex-1 min-w-0 text-xs font-bold text-gray-800 truncate">
                              {titre}
                            </span>
                            <Stars count={currentSeverity} />
                            {isOpen
                              ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            }
                          </button>

                          {isOpen && (
                            <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                              {errMsg && (
                                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                  {errMsg}
                                </p>
                              )}
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                Évolution constatée
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => handleEvolution(bobo, 'Aggravé')}
                                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-red-200 bg-red-50 text-red-700 font-bold text-xs cursor-pointer hover:bg-red-100 transition-all active:scale-[0.97] disabled:opacity-50"
                                >
                                  ↘ Aggravé
                                </button>
                                <button
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => handleEvolution(bobo, 'Amélioré')}
                                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-blue-200 bg-blue-50 text-blue-700 font-bold text-xs cursor-pointer hover:bg-blue-100 transition-all active:scale-[0.97] disabled:opacity-50"
                                >
                                  ↗ Amélioré
                                </button>
                                <button
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => handleEvolution(bobo, 'Stable')}
                                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-600 font-bold text-xs cursor-pointer hover:bg-gray-100 transition-all active:scale-[0.97] disabled:opacity-50"
                                >
                                  → Stable
                                </button>
                                <button
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => handleEvolution(bobo, 'Résolu')}
                                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 font-bold text-xs cursor-pointer transition-all active:scale-[0.97] disabled:opacity-50"
                                  style={{ borderColor: '#27AE60', backgroundColor: '#F0FBF4', color: '#27AE60' }}
                                >
                                  ✓ Résolu
                                </button>
                              </div>
                              {isSaving && (
                                <p className="text-[10px] text-gray-400 text-center animate-pulse">
                                  Enregistrement…
                                </p>
                              )}
                              <div className="text-center pt-1">
                                <button
                                  type="button"
                                  onClick={() => setVisitModalBoboId(event.id)}
                                  className="text-[11px] text-gray-400 hover:text-gray-600 underline underline-offset-2 cursor-pointer transition-colors"
                                >
                                  Modifier (commentaire, gravité, photo)
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* ── Pour les autres bobos non modifiés / Fin de visite ── */}
                {touchedIds.size > 0 && (
                  <div className="mt-3 space-y-2.5">
                    {touchedIds.size < bobos.length && !remainingDone && (
                      <button
                        type="button"
                        onClick={handleRemainingStable}
                        disabled={remainingSaving}
                        className="w-full flex items-center justify-center gap-2 font-bold text-sm py-3 rounded-xl border-2 border-gray-700 bg-gray-700 text-white cursor-pointer hover:bg-gray-800 active:scale-[0.98] transition-colors disabled:opacity-60"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {remainingSaving ? 'Enregistrement…' : 'Pour les autres bobos, rien à signaler'}
                      </button>
                    )}
                    {remainingError && (
                      <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        {remainingError}
                      </p>
                    )}
                    {(remainingDone || touchedIds.size === bobos.length) && (
                      <button
                        type="button"
                        onClick={onClose}
                        className="w-full flex items-center justify-center gap-2 font-bold text-sm py-3 rounded-xl text-white shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
                        style={{ backgroundColor: '#2f6b3f' }}
                      >
                        Fin de visite
                      </button>
                    )}
                  </div>
                )}
              </section>

              {/* ── Bouton vaccin (câblage au step suivant) ── */}
              <button
                type="button"
                onClick={() => { /* TODO step suivant : workflow vaccin (tags + sélection chevaux) */ }}
                className="w-full flex items-center justify-center gap-2 font-bold text-sm py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-600 cursor-pointer hover:border-primary/40 transition-all"
              >
                Vaccin
              </button>

              {/* ── Bouton soin véto (câblage au step suivant) ── */}
              <button
                type="button"
                onClick={() => { /* TODO step suivant : workflow soin véto (tags + sélection chevaux + commentaire) */ }}
                className="w-full flex items-center justify-center gap-2 font-bold text-sm py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-600 cursor-pointer hover:border-primary/40 transition-all"
              >
                Soin véto
              </button>

              {/* ── Bouton Nouveau bobo ── */}
              <button
                type="button"
                onClick={() => setWizardOpen(true)}
                className="w-full flex items-center justify-center gap-2 font-bold text-sm py-3 rounded-xl text-white shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
                style={{ backgroundColor: '#4A5FA0' }}
              >
                <Plus className="w-4 h-4" />
                Nouveau bobo
              </button>

              {/* ── Bouton Photo d'ambiance ── */}
              <label
                className="w-full flex items-center justify-center gap-2 font-bold text-sm py-3 rounded-xl text-white shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
                style={{ backgroundColor: ambianceUploading ? '#A9B7E0' : '#7B93D4' }}
              >
                <Camera className="w-4 h-4" />
                {ambianceUploading ? 'Envoi…' : "Photo d'ambiance"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleAmbiancePhotoSelect}
                  disabled={ambianceUploading}
                  className="hidden"
                />
              </label>
              {ambianceMessage && (
                <p className="text-[11px] text-gray-500 text-center mt-1.5">{ambianceMessage}</p>
              )}
            </>
          )}

          {/* ── Placeholder Maréchal-ferrant / Ostéopathe / Dentiste ── */}
          {metier && metier !== 'veterinaire' && (
            <section className="bg-white rounded-xl p-5 text-center shadow-xs">
              <p className="text-sm font-semibold text-gray-700">Bientôt disponible</p>
              <p className="text-xs text-gray-400 mt-1">
                Le workflow {METIER_LABELS[metier]} arrive dans une prochaine étape.
              </p>
              <button
                type="button"
                onClick={() => setMetier(null)}
                className="mt-3 text-xs text-gray-400 underline underline-offset-2 cursor-pointer"
              >
                ← Changer d'intervenant
              </button>
            </section>
          )}
        </div>
      </div>
      </div>

      {/* ── BoboWizard ── */}
      {wizardOpen && (
        <BoboWizard
          horses={horses}
          onCreated={fetchBobos}
          onClose={() => setWizardOpen(false)}
        />
      )}

      {/* ── VisitModal suivi complet ── */}
      {visitModalBobo !== null && (
        <VisitModal
          event={visitModalBobo.event}
          currentSeverity={visitModalBobo.lastVisit?.severity ?? visitModalBobo.event.severity}
          defaultVisitedAt={fromDatetimeLocal(visitedAt)}
          onClose={() => setVisitModalBoboId(null)}
          onSaved={() => {
            setVisitModalBoboId(null)
            setOpenBoboId(null)
            fetchBobos()
          }}
        />
      )}
    </>
  )
}
