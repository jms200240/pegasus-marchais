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
        if (signedErr)
