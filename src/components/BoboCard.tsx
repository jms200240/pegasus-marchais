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
