import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Horse, HealthEvent } from '../lib/types'
import { CANONICAL_ORDER, HORSE_COLORS, formatDateTime } from '../lib/types'
import {
  AlertCircle, CheckCircle, Clock, Camera, X, Plus
} from 'lucide-react'

// ─── Spinner inline ────────────────────────────────────────────────────
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

// ─── Étoiles gravité (sélectionnables) ─────────────────────────────────
function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          className={`text-2xl leading-none cursor-pointer transition-colors ${
            i <= value ? 'text-amber-400' : 'text-gray-200'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

// ─── Étoiles gravité (lecture seule) ───────────────────────────────────
function Stars({ count }: { count: number }) {
  return (
    <span className="text-amber-400 text-xs leading-none">
      {'★'.repeat(Math.min(count, 5))}
      <span className="text-gray-200">{'★'.repeat(Math.max(0, 5 - count))}</span>
    </span>
  )
}

// ─── Badge statut ───────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === 'closed') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
        <CheckCircle className="w-2.5 h-2.5" />Résolu
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
      <AlertCircle className="w-2.5 h-2.5" />Actif
    </span>
  )
}

// ─── Formulaire de création ─────────────────────────────────────────────
function NewBoboForm({
  horses,
  onCreated,
}: {
  horses: Horse[]
  onCreated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [horseId, setHorseId] = useState('')
  const [note, setNote] = useState('')
  const [severity, setSeverity] = useState(2)
  const [photos, setPhotos] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sortedHorses = [...horses].sort((a, b) => {
    const ia = CANONICAL_ORDER.indexOf(a.name as typeof CANONICAL_ORDER[number])
    const ib = CANONICAL_ORDER.indexOf(b.name as typeof CANONICAL_ORDER[number])
    if (ia === -1 && ib === -1) return a.name.localeCompare(b.name)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })

  function resetForm() {
    setHorseId('')
    setNote('')
    setSeverity(2)
    setPhotos([])
    setError(null)
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setPhotos(prev => [...prev, ...files])
    e.target.value = ''
  }

  function removePhoto(idx: number) {
    setPhotos(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!horseId || !note.trim()) {
      setError('Cheval et note sont obligatoires.')
      return
    }
    setSaving(true)
    setError(null)

    try {
      // 1. Upload des photos (s'il y en a)
      const photoUrls: string[] = []
      for (const file of photos) {
        const path = `${horseId}/${Date.now()}-${file.name}`
        const { error: uploadErr } = await supabase.storage
          .from('bobo-photos')
          .upload(path, file)
        if (uploadErr) throw uploadErr

        const { data: signedData, error: signedErr } = await supabase.storage
          .from('bobo-photos')
          .createSignedUrl(path, 60 * 60 * 24 * 365) // 1 an
        if (signedErr) throw signedErr
        if (signedData?.signedUrl) photoUrls.push(signedData.signedUrl)
      }

      // 2. Création de l'événement médical
      const { error: insertErr } = await supabase.from('health_events').insert({
        horse_id: horseId,
        note: note.trim(),
        severity,
        photo_urls: photoUrls,
      })
      if (insertErr) throw insertErr

      resetForm()
      setOpen(false)
      onCreated()
    } catch (err: any) {
      setError(err?.message ?? err?.error_description ?? JSON.stringify(err))
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold text-sm py-3 rounded-xl shadow-sm active:scale-[0.98] transition-transform cursor-pointer mb-6"
      >
        <Plus className="w-4 h-4" />
        Signaler un bobo
      </button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl p-4 shadow-sm mb-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-800">Nouveau bobo</h2>
        <button
          type="button"
          onClick={() => { setOpen(false); resetForm() }}
          className="text-gray-400 hover:text-gray-600 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Cheval */}
      <div>
        <label className="text-xs font-semibold text-gray-500 block mb-1.5">Cheval *</label>
        <div className="flex flex-wrap gap-1.5">
          {sortedHorses.map(h => {
            const color = h.color_hex ?? HORSE_COLORS[h.name] ?? '#2f6b3f'
            const selected = horseId === h.id
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => setHorseId(h.id)}
                className={`text-xs font-bold px-3 py-1.5 rounded-full cursor-pointer transition-all ${
                  selected ? 'text-white ring-2 ring-offset-1 ring-gray-300' : 'text-white/90 opacity-60'
                }`}
                style={{ backgroundColor: color }}
              >
                {h.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Note */}
      <div>
        <label className="text-xs font-semibold text-gray-500 block mb-1.5">Note *</label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={3}
          placeholder="Ex : Petite plaie au paturon, surveillance..."
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
      </div>

      {/* Gravité */}
      <div>
        <label className="text-xs font-semibold text-gray-500 block mb-1.5">Gravité</label>
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
                onClick={() => removePhoto(idx)}
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
              onChange={handlePhotoSelect}
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

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-primary text-white font-bold text-sm py-2.5 rounded-xl shadow-sm active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-50"
      >
        {saving ? 'Enregistrement...' : 'Enregistrer le bobo'}
      </button>
    </form>
  )
}

// ─── Page principale ──────────────────────────────────────────────────
export default function Soins() {
  const [horses, setHorses] = useState<Horse[]>([])
  const [events, setEvents] = useState<HealthEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const [{ data: horsesData, error: horsesErr },
             { data: eventsData, error: eventsErr }] = await Promise.all([
        supabase.from('horses').select('*'),
        supabase.from('health_events').select('*').order('opened_at', { ascending: false }),
      ])
      if (horsesErr) throw horsesErr
      if (eventsErr) throw eventsErr

      setHorses(horsesData ?? [])
      setEvents(eventsData ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  async function markResolved(eventId: string) {
    const { error: updateErr } = await supabase
      .from('health_events')
      .update({ status: 'closed' })
      .eq('id', eventId)
    if (!updateErr) fetchData()
  }

  const horseById = (id: string) => horses.find(h => h.id === id) ?? null
  const activeEvents = events.filter(e => e.status !== 'closed')
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
    <div className="flex-1 flex flex-col">
      <div className="px-5 pt-5 pb-3">
        <h1 className="text-2xl font-bold text-gray-900 leading-tight">Soins</h1>
        <p className="text-xs text-gray-500 mt-0.5">Carnet de soins &amp; Bobos</p>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6">
        <NewBoboForm horses={horses} onCreated={fetchData} />

        {/* ── Bobos actifs ── */}
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
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
            {activeEvents.map(event => {
              const horse = horseById(event.horse_id)
              const color = horse?.color_hex ?? (horse ? HORSE_COLORS[horse.name] : null) ?? '#2f6b3f'
              return (
                <div key={event.id} className="bg-white rounded-xl p-4 shadow-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: color }}
                        >
                          {horse?.name ?? 'Cheval inconnu'}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-gray-800 leading-tight">{event.note}</p>
                    </div>
                    <StatusBadge status={event.status} />
                  </div>

                  {event.photo_urls && event.photo_urls.length > 0 && (
                    <div className="flex gap-1.5 mt-2.5 overflow-x-auto no-scrollbar">
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

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                    <Stars count={event.severity} />
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-[10px] text-gray-400">
                        <Clock className="w-2.5 h-2.5" />
                        {formatDateTime(event.opened_at)}
                      </div>
                      <button
                        onClick={() => markResolved(event.id)}
                        className="text-[10px] font-bold text-primary uppercase tracking-wider cursor-pointer hover:underline"
                      >
                        Marquer résolu
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Bobos résolus ── */}
        {resolvedEvents.length > 0 && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 bg-green-400 rounded-full"></span>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Historique résolus
              </span>
              <span className="text-xs text-gray-400">({resolvedEvents.length})</span>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {resolvedEvents.map((event, idx) => {
                const horse = horseById(event.horse_id)
                return (
                  <div
                    key={event.id}
                    className={`flex items-center gap-3 px-4 py-3 ${
                      idx < resolvedEvents.length - 1 ? 'border-b border-gray-100' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-gray-600 truncate block">
                        {event.note}
                      </span>
                      <span className="text-xs text-gray-400">
                        {horse?.name ?? 'Cheval inconnu'} · {formatDateTime(event.opened_at)}
                      </span>
                    </div>
                    <StatusBadge status={event.status} />
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
