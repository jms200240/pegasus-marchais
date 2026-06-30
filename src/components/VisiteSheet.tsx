import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Horse, HealthEvent, HealthEventVisit, Pathology, FarmAlert } from '../lib/types'
import { CANONICAL_ORDER, HORSE_COLORS } from '../lib/types'
import { X, ChevronDown, ChevronUp, Plus, Wheat, Droplets, CheckCircle, Camera } from 'lucide-react'
import { getBoboTitle, Stars, VisitModal } from './BoboCard'
import BoboWizard from './BoboWizard'

// ─── Utilitaire datetime-local ────────────────────────────────────────────────
function toDatetimeLocal(iso: string): string {
  // Convertit un ISO timestamp vers la valeur attendue par <input type="datetime-local">
  // Format requis : YYYY-MM-DDTHH:MM (sans secondes, sans timezone)
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
  // Convertit la valeur de <input type="datetime-local"> en ISO (heure locale → UTC)
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

// ─── VisiteSheet ──────────────────────────────────────────────────────────────
interface VisiteSheetProps {
  onClose: () => void
}

export default function VisiteSheet({ onClose }: VisiteSheetProps) {
  // ── Horodatage de la session ─────────────────────────────────────────────
  const [visitedAt, setVisitedAt] = useState<string>(toDatetimeLocal(new Date().toISOString()))

  // ── Alertes ferme ────────────────────────────────────────────────────────
  const [alerts, setAlerts] = useState<Record<string, boolean>>({ foin: false, eau: false })
  const [alertsLoading, setAlertsLoading] = useState(true)

  // ── Bobos actifs ─────────────────────────────────────────────────────────
  const [bobos, setBobos] = useState<ActiveBobo[]>([])
  const [bobosLoading, setBobosLoading] = useState(true)
  const [openBoboId, setOpenBoboId] = useState<string | null>(null)

  // ── Actions en cours ─────────────────────────────────────────────────────
  const [savingBoboId, setSavingBoboId] = useState<string | null>(null)
  const [boboErrors, setBoboErrors] = useState<Record<string, string>>({})

  // ── VisitModal suivi complet ──────────────────────────────────────────────
  const [visitModalBoboId, setVisitModalBoboId] = useState<string | null>(null)

  // ── Validation en masse "Rien à signaler" ─────────────────────────────────
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)

  // ── Photos d'ambiance ──────────────────────────────────────────────────────
  const [ambianceUploading, setAmbianceUploading] = useState(false)
  const [ambianceMessage, setAmbianceMessage] = useState<string | null>(null)

  // ── BoboWizard ───────────────────────────────────────────────────────────
  const [wizardOpen, setWizardOpen] = useState(false)
  const [horses, setHorses] = useState<Horse[]>([])

  // ─── Fetch alertes ────────────────────────────────────────────────────────
  async function fetchAlerts() {
    setAlertsLoading(true)
    const { data, error } = await supabase
      .from('farm_alerts')
      .select('*')
    if (!error && data) {
      const map: Record<string, boolean> = {}
      ;(data as FarmAlert[]).forEach(a => { map[a.key] = a.active })
      setAlerts(map)
    }
    setAlertsLoading(false)
  }

  async function toggleAlert(key: 'foin' | 'eau') {
    const newVal = !alerts[key]
    // Optimistic update
    setAlerts(prev => ({ ...prev, [key]: newVal }))
    const { error } = await supabase
      .from('farm_alerts')
      .update({ active: newVal, updated_at: new Date().toISOString() })
      .eq('key', key)
    if (error) {
      // Rollback
      setAlerts(prev => ({ ...prev, [key]: !newVal }))
      console.error('Erreur mise à jour alerte:', error)
    }
  }

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

      // Fetch la dernière visite de chaque bobo actif
      const boboList: ActiveBobo[] = []
      for (const event of eventsArr) {
        const horse = horsesArr.find(h => h.id === event.horse_id) ?? null
        const patho = event.pathology_id
          ? pathoArr.find(p => p.id === event.pathology_id) ?? null
          : null

        // Dernière visite
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

      // Tri canonique par cheval
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

  useEffect(() => {
    fetchAlerts()
    fetchBobos()
  }, [])

  // ─── Calcul sévérité selon évolution ─────────────────────────────────────
  function computeSeverity(current: number, evolution: Evolution): number {
    if (evolution === 'Amélioré') return Math.max(1, current - 1)
    if (evolution === 'Aggravé')  return Math.min(5, current + 1)
    return current // Stable ou Résolu
  }

  function computeStatus(evolution: Evolution): 'active' | 'closed' {
    return evolution === 'Résolu' ? 'closed' : 'active'
  }

  // ─── Enregistrer une évolution rapide ────────────────────────────────────
  async function handleEvolution(bobo: ActiveBobo, evolution: Evolution) {
    const eventId = bobo.event.id
    setSavingBoboId(eventId)
    setBoboErrors(prev => { const n = { ...prev }; delete n[eventId]; return n })

    try {
      const currentSeverity = bobo.lastVisit?.severity ?? bobo.event.severity
      const newSeverity = computeSeverity(currentSeverity, evolution)
      const newStatus   = computeStatus(evolution)
      const visitedAtISO = fromDatetimeLocal(visitedAt)

      // 1. Insert dans health_event_visits
      const { error: insertErr } = await supabase
        .from('health_event_visits')
        .insert({
          health_event_id: eventId,
          status:          newStatus,
          severity:        newSeverity,
          note:            evolution,
          visited_at:      visitedAtISO,
        })
      if (insertErr) throw insertErr

      // 2. Update health_events
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

      // Referme l'accordéon et rafraîchit la liste
      setOpenBoboId(null)
      await fetchBobos()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err)
      setBoboErrors(prev => ({ ...prev, [eventId]: msg }))
    } finally {
      setSavingBoboId(null)
    }
  }

  // ─── Validation en masse de tous les bobos actifs ("Stable") ────────────
  async function handleAllStable() {
    if (bobos.length === 0) return
    setBulkSaving(true)
    setBulkError(null)
    try {
      const visitedAtISO = fromDatetimeLocal(visitedAt)
      for (const bobo of bobos) {
        const currentSeverity = bobo.lastVisit?.severity ?? bobo.event.severity
        const { error: insertErr } = await supabase
          .from('health_event_visits')
          .insert({
            health_event_id: bobo.event.id,
            status:          'active',
            severity:        currentSeverity,
            note:            'Stable',
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
    } catch (err: unknown) {
      setBulkError(err instanceof Error ? err.message : JSON.stringify(err))
    } finally {
      setBulkSaving(false)
    }
  }

  // ─── Upload des photos d'ambiance (non liées à un cheval/bobo) ──────────
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

  // ─── VisitModal bobo résolu (pour fermer l'accordéon après onSaved) ──────
  const visitModalBobo = visitModalBoboId !== null
    ? bobos.find(b => b.event.id === visitModalBoboId) ?? null
    : null

  // ─── Rendu ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="fixed inset-0 z-[60] flex justify-center bg-black/5">
      <div className="w-full max-w-[390px] bg-[#F6F2EC] flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0 border-b border-gray-200/60 bg-white/70 backdrop-blur-sm">
          <h2 className="text-base font-black text-gray-900">Visite du jour</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* ── Contenu scrollable ── */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6 pt-4 space-y-5">

          {/* ── Horodatage de la session ── */}
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
            <button
              type="button"
              onClick={handleAllStable}
              disabled={bulkSaving || bobos.length === 0}
              className={`w-full mt-2.5 flex items-center justify-center gap-2 font-bold text-sm py-3 rounded-xl border-2 cursor-pointer transition-colors ${
                bobos.length === 0
                  ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'border-gray-700 bg-gray-700 text-white hover:bg-gray-800 active:scale-[0.98]'
              } disabled:active:scale-100`}
            >
              <CheckCircle className="w-4 h-4" />
              {bulkSaving ? 'Enregistrement…' : 'Rien à signaler — bobos stables'}
            </button>
            {bulkError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
                {bulkError}
              </p>
            )}
          </section>

          {/* ── Approvisionnement ── */}
          <section>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Approvisionnement
            </p>
            {alertsLoading ? (
              <div className="flex gap-3">
                <div className="flex-1 h-12 bg-gray-100 rounded-xl animate-pulse" />
                <div className="flex-1 h-12 bg-gray-100 rounded-xl animate-pulse" />
              </div>
            ) : (
              <div className="flex gap-3">
                {/* Foin */}
                <button
                  type="button"
                  onClick={() => toggleAlert('foin')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-bold text-sm transition-all cursor-pointer ${
                    alerts['foin']
                      ? 'border-amber-400 bg-amber-50 text-amber-700'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <Wheat className="w-4 h-4" />
                  Foin
                  {alerts['foin'] && (
                    <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">!</span>
                  )}
                </button>

                {/* Eau */}
                <button
                  type="button"
                  onClick={() => toggleAlert('eau')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-bold text-sm transition-all cursor-pointer ${
                    alerts['eau']
                      ? 'border-amber-400 bg-amber-50 text-amber-700'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <Droplets className="w-4 h-4" />
                  Eau
                  {alerts['eau'] && (
                    <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">!</span>
                  )}
                </button>
              </div>
            )}
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
                      {/* Ligne fermée */}
                      <button
                        type="button"
                        onClick={() => setOpenBoboId(isOpen ? null : event.id)}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-left cursor-pointer hover:bg-gray-50/70 transition-colors"
                      >
                        {/* Badge cheval */}
                        {horse && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0"
                            style={{ backgroundColor: horseColor }}
                          >
                            {horse.name}
                          </span>
                        )}

                        {/* Titre */}
                        <span className="flex-1 min-w-0 text-xs font-bold text-gray-800 truncate">
                          {titre}
                        </span>

                        {/* Étoiles */}
                        <Stars count={currentSeverity} />

                        {/* Chevron */}
                        {isOpen
                          ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        }
                      </button>

                      {/* Panneau déplié */}
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

                          {/* Grid 2×2 : Aggravé / Amélioré / Stable / Résolu */}
                          <div className="grid grid-cols-2 gap-2">
                            {/* Haut-gauche : Aggravé */}
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => handleEvolution(bobo, 'Aggravé')}
                              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-red-200 bg-red-50 text-red-700 font-bold text-xs cursor-pointer hover:bg-red-100 transition-all active:scale-[0.97] disabled:opacity-50"
                            >
                              ↘ Aggravé
                            </button>

                            {/* Haut-droite : Amélioré */}
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => handleEvolution(bobo, 'Amélioré')}
                              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-blue-200 bg-blue-50 text-blue-700 font-bold text-xs cursor-pointer hover:bg-blue-100 transition-all active:scale-[0.97] disabled:opacity-50"
                            >
                              ↗ Amélioré
                            </button>

                            {/* Bas-gauche : Stable */}
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => handleEvolution(bobo, 'Stable')}
                              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-600 font-bold text-xs cursor-pointer hover:bg-gray-100 transition-all active:scale-[0.97] disabled:opacity-50"
                            >
                              → Stable
                            </button>

                            {/* Bas-droite : Résolu */}
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

                          {/* Lien suivi complet */}
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

            {/* ── Bouton Nouveau bobo ── */}
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="mt-4 w-full flex items-center justify-center gap-2 font-bold text-sm py-3 rounded-xl text-white shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
              style={{ backgroundColor: '#4A5FA0' }}
            >
              <Plus className="w-4 h-4" />
              Nouveau bobo
            </button>

            {/* ── Bouton Photo d'ambiance ── */}
            <label
              className="mt-2.5 w-full flex items-center justify-center gap-2 font-bold text-sm py-3 rounded-xl text-white shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
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
          </section>
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
