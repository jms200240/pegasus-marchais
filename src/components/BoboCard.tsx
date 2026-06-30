import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Horse, HealthEvent, HealthEventVisit, Pathology } from '../lib/types'
import { HORSE_COLORS, formatDateTime } from '../lib/types'
import { AlertCircle, Camera, CheckCircle, Clock, Info, Calendar, ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import { StarPicker, FichePathologie } from './BoboWizard'

// ─── Étoiles gravité (lecture seule) ────────────────────────────────────────
export function Stars({ count }: { count: number }) {
  return (
    <span className="text-amber-400 text-xs leading-none">
      {'★'.repeat(Math.min(count, 5))}
      <span className="text-gray-200">{'★'.repeat(Math.max(0, 5 - count))}</span>
    </span>
  )
}

// ─── Badge statut ────────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: 'open' | 'active' | 'closed' }) {
  if (status === 'closed') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
        <CheckCircle className="w-2.5 h-2.5" />Résolu
      </span>
    )
  }
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
        <AlertCircle className="w-2.5 h-2.5" />En cours
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
      <Clock className="w-2.5 h-2.5" />Signalé
    </span>
  )
}

// ─── Règle de titre partagée ─────────────────────────────────────────────────
export function getBoboTitle(event: HealthEvent, pathology: Pathology | null): string {
  if (event.pathology_id) {
    if (!pathology) {
      return "Pathologie..."
    }
    let title = pathology.name
    if (event.location) {
      let loc = event.location
      if (loc.startsWith("Membre – ")) {
        loc = loc.substring("Membre – ".length)
      }
      const parts = loc.split(" – ")
      if (parts.length > 0) {
        if (event.laterality) {
          if (parts.length > 1) {
            parts[parts.length - 2] = `${parts[parts.length - 2]} ${event.laterality}`
          } else {
            parts[0] = `${parts[0]} ${event.laterality}`
          }
        }
        title += ` — ${parts.join(', ')}`
      }
    } else if (event.laterality) {
      title += ` — ${event.laterality}`
    }
    return title
  } else {
    return event.note || "Bobo signalé"
  }
}

// ─── VisitModal ──────────────────────────────────────────────────────────────
// Composant exporté — réutilisé dans VisiteSheet.tsx (suivi complet avec photo)
interface VisitModalProps {
  event: HealthEvent
  currentSeverity: number      // sévérité de départ pré-remplie
  defaultVisitedAt?: string    // ISO timestamp ; si absent, utilise maintenant
  onClose: () => void
  onSaved: () => void
}

export function VisitModal({
  event,
  currentSeverity,
  defaultVisitedAt,
  onClose,
  onSaved,
}: VisitModalProps) {
  const [note, setNote] = useState('')
  const [severity, setSeverity] = useState(currentSeverity)
  const [photos, setPhotos] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(newStatus: 'active' | 'closed') {
    setSubmitting(true)
    setError(null)
    try {
      // 1. Upload photos vers bucket bobo-photos (URL signée 1 an)
      const photoUrls: string[] = []
      for (const file of photos) {
        const path = `${event.horse_id}/${Date.now()}-${file.name}`
        const { error: uploadErr } = await supabase.storage
          .from('bobo-photos')
          .upload(path, file)
        if (uploadErr) throw uploadErr
        const { data: signedData, error: signedErr } = await supabase.storage
          .from('bobo-photos')
          .createSignedUrl(path, 60 * 60 * 24 * 365)
        if (signedErr) throw signedErr
        if (signedData?.signedUrl) photoUrls.push(signedData.signedUrl)
      }

      // 2. Insert dans health_event_visits
      const { error: insertErr } = await supabase
        .from('health_event_visits')
        .insert({
          health_event_id: event.id,
          status:          newStatus,
          severity,
          note:            note.trim() || null,
          visited_at:      defaultVisitedAt ?? new Date().toISOString(),
          photo_urls:      photoUrls.length > 0 ? photoUrls : null,
        })
      if (insertErr) throw insertErr

      // 3. Update health_events (status, severity, closed_at si fermé)
      const updateFields: {
        status: 'active' | 'closed'
        severity: number
        closed_at: string | null
      } = {
        status:    newStatus,
        severity,
        closed_at: newStatus === 'closed' ? new Date().toISOString() : null,
      }
      const { error: updateErr } = await supabase
        .from('health_events')
        .update(updateFields)
        .eq('id', event.id)
      if (updateErr) throw updateErr

      onSaved()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : JSON.stringify(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto no-scrollbar space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800">Ajouter un suivi</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center cursor-pointer text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Note */}
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1.5">
              Que constatez-vous aujourd'hui ?
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="Note de suivi, soins appliqués, évolution..."
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none text-gray-700"
            />
          </div>

          {/* Gravité */}
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1.5">
              Gravité
            </label>
            <StarPicker value={severity} onChange={setSeverity} />
          </div>

          {/* Photos */}
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1.5">
              Photos <span className="font-normal text-gray-400">(optionnel)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {photos.map((file, idx) => (
                <div key={idx} className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Photo ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 rounded-full flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-2.5 h-2.5 text-white" />
                  </button>
                </div>
              ))}
              <label className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer text-gray-400 hover:text-primary hover:border-primary/40 transition-colors">
                <Camera className="w-5 h-5" />
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={e => {
                    const files = Array.from(e.target.files ?? [])
                    setPhotos(prev => [...prev, ...files])
                    e.target.value = ''
                  }}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => handleSave('active')}
              disabled={submitting}
              className="flex-1 bg-amber-500 text-white font-bold text-xs py-2.5 rounded-xl shadow-xs active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Enregistrement…' : 'Enregistrer · En cours'}
            </button>
            <button
              type="button"
              onClick={() => handleSave('closed')}
              disabled={submitting}
              className="flex-1 bg-green-600 text-white font-bold text-xs py-2.5 rounded-xl shadow-xs active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-50"
            >
              {submitting ? '…' : 'Enregistrer · Résolu'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── BoboCard ────────────────────────────────────────────────────────────────
interface BoboCardProps {
  event: HealthEvent
  horse: Horse | null
  pathology: Pathology | null
  showHorseBadge?: boolean
  onUpdated: () => void
}

export default function BoboCard({
  event,
  horse,
  pathology,
  showHorseBadge = true,
  onUpdated,
}: BoboCardProps) {
  const [showVisits, setShowVisits] = useState(false)
  const [visits, setVisits] = useState<HealthEventVisit[]>([])
  const [showModifyModal, setShowModifyModal] = useState(false)
  const [ficheOuverte, setFicheOuverte] = useState(false)

  const horseColor = horse?.color_hex ?? (horse ? HORSE_COLORS[horse.name] : null) ?? '#2f6b3f'
  const titre = getBoboTitle(event, pathology)
  const sousTitre = pathology && event.location ? event.location : null

  async function fetchVisits() {
    try {
      const { data, error } = await supabase
        .from('health_event_visits')
        .select('*')
        .eq('health_event_id', event.id)
        .order('visited_at', { ascending: false })
      if (!error && data) {
        setVisits(data)
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchVisits()
  }, [event.id])

  const totalEntries = visits.length + (event.note ? 1 : 0)
  const hasInitialEntry = !!event.note
  const currentSeverity = visits.length > 0 ? visits[0].severity : event.severity

  return (
    <div className="bg-white rounded-xl p-4 shadow-xs space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {showHorseBadge && horse && (
            <div className="flex items-center gap-1.5 mb-1.5">
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: horseColor }}
              >
                {horse.name}
              </span>
            </div>
          )}
          <h3 className="text-sm font-bold text-gray-800 leading-tight">{titre}</h3>
          {sousTitre && <p className="text-xs text-gray-400 mt-0.5">{sousTitre}</p>}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {pathology && (
            <button
              type="button"
              onClick={() => setFicheOuverte(true)}
              className="text-primary/50 hover:text-primary cursor-pointer transition-colors p-1"
              title={`Fiche : ${pathology.name}`}
            >
              <Info className="w-4 h-4" />
            </button>
          )}
          <StatusBadge status={event.status} />
        </div>
      </div>

      {event.photo_urls && event.photo_urls.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {event.photo_urls.map((url, idx) => (
            <img
              key={idx}
              src={url}
              alt={`Photo ${idx + 1}`}
              className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
            />
          ))}
        </div>
      )}

      {/* Barre d'action basse de la carte */}
      <div className="flex items-center justify-between pt-2.5 border-t border-gray-100 text-xs">
        <div className="flex flex-col gap-0.5">
          <Stars count={event.severity} />
          <span className="text-[9px] text-gray-400 flex items-center gap-1">
            <Calendar className="w-2.5 h-2.5" />
            {formatDateTime(event.opened_at)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {totalEntries > 0 && (
            <button
              type="button"
              onClick={() => setShowVisits(!showVisits)}
              className="text-[10px] font-bold text-gray-500 hover:text-gray-700 flex items-center gap-1 cursor-pointer"
            >
              Journal ({totalEntries})
              {showVisits ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowModifyModal(true)}
            className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1 hover:underline cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            Suivi
          </button>
        </div>
      </div>

      {/* Journal des visites dépliant */}
      {showVisits && totalEntries > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100/70 space-y-2 max-h-60 overflow-y-auto no-scrollbar">
          {/* Vraies visites (récentes d'abord) */}
          {visits.map(v => (
            <div key={v.id} className="text-xs bg-gray-50 rounded-lg p-2.5 space-y-1">
              <div className="flex justify-between items-center text-[9px] text-gray-400">
                <span>{formatDateTime(v.visited_at)}</span>
                <div className="flex items-center gap-1.5">
                  <Stars count={v.severity} />
                  <StatusBadge status={v.status} />
                </div>
              </div>
              {v.note && <p className="text-gray-700 leading-normal">{v.note}</p>}
              {v.photo_urls && v.photo_urls.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-1">
                  {v.photo_urls.map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt={`Photo visite ${idx + 1}`}
                      className="w-12 h-12 rounded-md object-cover flex-shrink-0"
                    />
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Entrée virtuelle initiale (la plus ancienne) */}
          {hasInitialEntry && (
            <div className="text-xs bg-gray-50/50 rounded-lg p-2.5 space-y-1 border border-dashed border-gray-200">
              <div className="flex justify-between items-center text-[9px] text-gray-400">
                <span className="font-semibold text-primary/70">Ouverture du bobo</span>
                <span>{formatDateTime(event.opened_at)}</span>
              </div>
              <div className="flex justify-between items-center text-[9px] text-gray-400">
                <span className="italic">Note initiale</span>
                <div className="flex items-center gap-1.5">
                  <Stars count={event.severity} />
                  <StatusBadge status="open" />
                </div>
              </div>
              <p className="text-gray-600 leading-normal italic">{event.note}</p>
            </div>
          )}
        </div>
      )}

      {/* Fiche Pathologie Modale */}
      {ficheOuverte && pathology && (
        <FichePathologie pathology={pathology} onClose={() => setFicheOuverte(false)} />
      )}

      {/* Modale de modification / suivi — délégué à VisitModal */}
      {showModifyModal && (
        <VisitModal
          event={event}
          currentSeverity={currentSeverity}
          onClose={() => setShowModifyModal(false)}
          onSaved={() => { fetchVisits(); onUpdated() }}
        />
      )}
    </div>
  )
}
