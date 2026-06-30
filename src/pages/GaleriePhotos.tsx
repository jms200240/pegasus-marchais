import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AmbiancePhoto, Horse, PhotoTag } from '../lib/types'
import { CANONICAL_ORDER, HORSE_COLORS, formatDateTime } from '../lib/types'
import { Image as ImageIcon, X, Share2, Download, Plus, Tag } from 'lucide-react'
// @ts-ignore — piexifjs n'a pas de types officiels à jour pour cette API, @types/piexifjs couvre l'essentiel
import piexif from 'piexifjs'

interface SimpleUser {
  id: string
  name: string | null
}

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

// ─── Écriture best-effort des tags dans l'EXIF du JPEG (hors app, portable) ──
async function embedTagsInJpeg(photo: AmbiancePhoto, tags: PhotoTag[]) {
  if (!photo.storage_path) return // Photo antérieure à cette fonctionnalité : pas de chemin connu
  const lowerPath = photo.storage_path.toLowerCase()
  if (!lowerPath.endsWith('.jpg') && !lowerPath.endsWith('.jpeg')) return // EXIF fiable en JPEG uniquement

  try {
    const response = await fetch(photo.photo_url)
    const blob = await response.blob()

    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Lecture du fichier impossible'))
      reader.readAsDataURL(blob)
    })

    const horseLabels = tags.filter(t => t.tag_type === 'horse').map(t => t.label)
    const humanLabels = tags.filter(t => t.tag_type === 'human').map(t => t.label)
    const description = [
      horseLabels.length ? `Chevaux: ${horseLabels.join(', ')}` : null,
      humanLabels.length ? `Humains: ${humanLabels.join(', ')}` : null,
    ].filter(Boolean).join(' | ') || 'Pegasus — Les Marchais'

    let exifObj: any
    try {
      exifObj = piexif.load(dataUrl)
    } catch {
      exifObj = { '0th': {}, Exif: {}, GPS: {} }
    }
    exifObj['0th'][piexif.ImageIFD.ImageDescription] = description
    const exifBytes = piexif.dump(exifObj)
    const newDataUrl = piexif.insert(exifBytes, dataUrl)

    const arr = newDataUrl.split(',')
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) u8arr[n] = bstr.charCodeAt(n)
    const newBlob = new Blob([u8arr], { type: 'image/jpeg' })

    await supabase.storage
      .from('ambiance-photos')
      .upload(photo.storage_path, newBlob, { upsert: true })
  } catch (err) {
    // Best-effort : l'échec de l'écriture EXIF ne doit jamais bloquer le tagging
    console.error('Écriture EXIF des tags impossible :', err)
  }
}

// ─── Chip générique ────────────────────────────────────────────────────────
function TagChip({
  label,
  color,
  onRemove,
}: {
  label: string
  color: string
  onRemove?: () => void
}) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full text-white"
      style={{ backgroundColor: color }}
    >
      {label}
      {onRemove && (
        <button type="button" onClick={onRemove} className="cursor-pointer">
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  )
}

// ─── Sélecteur d'ajout (cheval ou humain) ──────────────────────────────────
function TagPicker({
  options,
  suggestions,
  onPick,
  onPickOther,
  otherLabel,
}: {
  options: { id: string | null; label: string; color?: string }[]
  suggestions: string[]
  onPick: (label: string, refId: string | null) => void
  onPickOther: (label: string) => void
  otherLabel: string
}) {
  const [showOther, setShowOther] = useState(false)
  const [otherValue, setOtherValue] = useState('')

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {options.map(opt => (
        <button
          key={opt.id ?? opt.label}
          type="button"
          onClick={() => onPick(opt.label, opt.id)}
          className="text-[11px] font-bold px-2.5 py-1 rounded-full cursor-pointer text-white"
          style={{ backgroundColor: opt.color ?? '#9CA3AF' }}
        >
          {opt.label}
        </button>
      ))}

      {suggestions.map(s => (
        <button
          key={s}
          type="button"
          onClick={() => onPickOther(s)}
          className="text-[11px] font-bold px-2.5 py-1 rounded-full cursor-pointer bg-gray-200 text-gray-700"
        >
          {s}
        </button>
      ))}

      {!showOther ? (
        <button
          type="button"
          onClick={() => setShowOther(true)}
          className="text-[11px] font-bold px-2.5 py-1 rounded-full cursor-pointer border-2 border-dashed border-gray-300 text-gray-500"
        >
          + {otherLabel}
        </button>
      ) : (
        <div className="flex items-center gap-1.5 w-full mt-1">
          <input
            type="text"
            value={otherValue}
            onChange={e => setOtherValue(e.target.value)}
            placeholder={otherLabel}
            autoFocus
            className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="button"
            onClick={() => {
              if (otherValue.trim()) {
                onPickOther(otherValue.trim())
                setOtherValue('')
                setShowOther(false)
              }
            }}
            className="text-xs font-bold text-primary px-2 cursor-pointer"
          >
            OK
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Visionneuse plein écran : partage + tagging ───────────────────────────
function PhotoViewer({
  photo,
  horses,
  users,
  onClose,
}: {
  photo: AmbiancePhoto
  horses: Horse[]
  users: SimpleUser[]
  onClose: () => void
}) {
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

  const [tags, setTags] = useState<PhotoTag[]>([])
  const [tagsLoading, setTagsLoading] = useState(true)
  const [horseSuggestions, setHorseSuggestions] = useState<string[]>([])
  const [humanSuggestions, setHumanSuggestions] = useState<string[]>([])
  const [showHorsePicker, setShowHorsePicker] = useState(false)
  const [showHumanPicker, setShowHumanPicker] = useState(false)

  async function fetchTags() {
    setTagsLoading(true)
    const { data, error } = await supabase
      .from('photo_tags')
      .select('*')
      .eq('photo_id', photo.id)
    if (!error && data) setTags(data)
    setTagsLoading(false)
  }

  async function fetchSuggestions() {
    const [{ data: horseTags }, { data: humanTags }] = await Promise.all([
      supabase.from('photo_tags').select('label').eq('tag_type', 'horse').is('horse_id', null),
      supabase.from('photo_tags').select('label').eq('tag_type', 'human').is('user_id', null),
    ])
    setHorseSuggestions([...new Set((horseTags ?? []).map((t: { label: string }) => t.label))])
    setHumanSuggestions([...new Set((humanTags ?? []).map((t: { label: string }) => t.label))])
  }

  useEffect(() => {
    fetchTags()
    fetchSuggestions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo.id])

  async function addTag(tagType: 'horse' | 'human', label: string, refId: string | null) {
    const row: {
      photo_id: string
      tag_type: 'horse' | 'human'
      label: string
      horse_id?: string
      user_id?: string
    } = { photo_id: photo.id, tag_type: tagType, label }
    if (tagType === 'horse' && refId) row.horse_id = refId
    if (tagType === 'human' && refId) row.user_id = refId

    const { error } = await supabase.from('photo_tags').insert(row)
    if (!error) {
      await fetchTags()
      await fetchSuggestions()
      setShowHorsePicker(false)
      setShowHumanPicker(false)
      const { data: freshTags } = await supabase.from('photo_tags').select('*').eq('photo_id', photo.id)
      if (freshTags) embedTagsInJpeg(photo, freshTags)
    }
  }

  async function removeTag(tagId: string) {
    const { error } = await supabase.from('photo_tags').delete().eq('id', tagId)
    if (!error) {
      await fetchTags()
      const { data: freshTags } = await supabase.from('photo_tags').select('*').eq('photo_id', photo.id)
      if (freshTags) embedTagsInJpeg(photo, freshTags)
    }
  }

  const sortedHorses = [...horses].sort((a, b) => {
    const ia = CANONICAL_ORDER.indexOf(a.name as typeof CANONICAL_ORDER[number])
    const ib = CANONICAL_ORDER.indexOf(b.name as typeof CANONICAL_ORDER[number])
    if (ia === -1 && ib === -1) return a.name.localeCompare(b.name)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })

  const horseTags = tags.filter(t => t.tag_type === 'horse')
  const humanTags = tags.filter(t => t.tag_type === 'human')

  async function handleShare() {
    setSharing(true)
    setShareError(null)
    try {
      const response = await fetch(photo.photo_url)
      const blob = await response.blob()
      const file = new File([blob], `pegasus-ambiance-${photo.id}.jpg`, { type: blob.type || 'image/jpeg' })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Photo Pegasus' })
      } else {
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `pegasus-ambiance-${photo.id}.jpg`
        link.click()
        URL.revokeObjectURL(link.href)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (!msg.toLowerCase().includes('abort')) {
        setShareError("Impossible de partager cette photo. Essayez le téléchargement.")
      }
    } finally {
      setSharing(false)
    }
  }

  function handleDownload() {
    const link = document.createElement('a')
    link.href = photo.photo_url
    link.download = `pegasus-ambiance-${photo.id}.jpg`
    link.target = '_blank'
    link.click()
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-center bg-black/90">
      <div className="w-full max-w-[390px] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <span className="text-xs font-bold text-white/80">
            {formatDateTime(photo.visited_at)}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 cursor-pointer hover:bg-white/20"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-3">
          <img
            src={photo.photo_url}
            alt="Photo d'ambiance"
            className="w-full rounded-lg object-contain"
          />

          {/* ── Tags ── */}
          <div className="mt-4 bg-white/10 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center gap-1.5 text-white/70">
              <Tag className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Tags</span>
            </div>

            {tagsLoading ? (
              <p className="text-xs text-white/50">Chargement…</p>
            ) : (
              <>
                {/* Chevaux */}
                <div>
                  <p className="text-[10px] text-white/50 mb-1.5">Chevaux</p>
                  <div className="flex flex-wrap gap-1.5">
                    {horseTags.map(t => (
                      <TagChip
                        key={t.id}
                        label={t.label}
                        color={HORSE_COLORS[t.label] ?? '#2f6b3f'}
                        onRemove={() => removeTag(t.id)}
                      />
                    ))}
                    {!showHorsePicker && (
                      <button
                        type="button"
                        onClick={() => setShowHorsePicker(true)}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-full cursor-pointer bg-white/15 text-white flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Cheval
                      </button>
                    )}
                  </div>
                  {showHorsePicker && (
                    <TagPicker
                      options={sortedHorses.map(h => ({
                        id: h.id,
                        label: h.name,
                        color: h.color_hex ?? HORSE_COLORS[h.name] ?? '#2f6b3f',
                      }))}
                      suggestions={horseSuggestions}
                      onPick={(label, id) => addTag('horse', label, id)}
                      onPickOther={(label) => addTag('horse', label, null)}
                      otherLabel="Autre cheval"
                    />
                  )}
                </div>

                {/* Humains */}
                <div>
                  <p className="text-[10px] text-white/50 mb-1.5">Humains</p>
                  <div className="flex flex-wrap gap-1.5">
                    {humanTags.map(t => (
                      <TagChip key={t.id} label={t.label} color="#6B7280" onRemove={() => removeTag(t.id)} />
                    ))}
                    {!showHumanPicker && (
                      <button
                        type="button"
                        onClick={() => setShowHumanPicker(true)}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-full cursor-pointer bg-white/15 text-white flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Humain
                      </button>
                    )}
                  </div>
                  {showHumanPicker && (
                    <TagPicker
                      options={users.map(u => ({ id: u.id, label: u.name ?? 'Sans nom', color: '#6B7280' }))}
                      suggestions={humanSuggestions}
                      onPick={(label, id) => addTag('human', label, id)}
                      onPickOther={(label) => addTag('human', label, null)}
                      otherLabel="Autre humain"
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="px-5 py-5 flex-shrink-0 space-y-2">
          {shareError && (
            <p className="text-xs text-red-300 text-center">{shareError}</p>
          )}
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={handleShare}
              disabled={sharing}
              className="flex-1 flex items-center justify-center gap-2 bg-white text-gray-900 font-bold text-sm py-3 rounded-xl cursor-pointer active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              <Share2 className="w-4 h-4" />
              {sharing ? 'Partage…' : 'Partager'}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="w-12 flex items-center justify-center bg-white/10 rounded-xl cursor-pointer hover:bg-white/20"
            >
              <Download className="w-4 h-4 text-white" />
            </button>
          </div>
          <p className="text-[10px] text-white/50 text-center">
            "Partager" ouvre le menu de votre téléphone — sur Android avec
            Google Photos installé, "Enregistrer dans Photos" y apparaît.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Page Galerie ─────────────────────────────────────────────────────────────
export default function GaleriePhotos() {
  const [photos, setPhotos] = useState<AmbiancePhoto[]>([])
  const [horses, setHorses] = useState<Horse[]>([])
  const [users, setUsers] = useState<SimpleUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<AmbiancePhoto | null>(null)

  useEffect(() => {
    async function fetchAll() {
      setLoading(true)
      setError(null)
      try {
        const { data: photosData, error: photosErr } = await supabase
          .from('ambiance_photos')
          .select('*')
          .order('visited_at', { ascending: false })
        if (photosErr) throw photosErr
        setPhotos(photosData ?? [])

        const { data: horsesData } = await supabase.from('horses').select('*')
        setHorses(horsesData ?? [])

        // La lecture de public.users peut être restreinte selon les policies —
        // en cas d'échec on continue simplement sans suggestions "humain" prédéfinies.
        try {
          const { data: usersData } = await supabase.from('users').select('id, name')
          setUsers(usersData ?? [])
        } catch {
          setUsers([])
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const grouped: { dateLabel: string; items: AmbiancePhoto[] }[] = []
  for (const photo of photos) {
    const dateLabel = new Date(photo.visited_at).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
    const group = grouped.find(g => g.dateLabel === dateLabel)
    if (group) {
      group.items.push(photo)
    } else {
      grouped.push({ dateLabel, items: [photo] })
    }
  }

  return (
    <>
      <div className="flex-1 flex flex-col">
        <div className="px-5 pt-5 pb-3">
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">Galerie</h1>
          <p className="text-xs text-gray-500 mt-0.5">Photos d'ambiance — Élevage Scalbert</p>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6">
          {loading ? (
            <Spinner />
          ) : error ? (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <p className="font-semibold mb-1">Impossible de charger les photos</p>
              <p className="text-xs font-mono">{error}</p>
            </div>
          ) : photos.length === 0 ? (
            <div className="bg-white rounded-xl p-6 shadow-xs text-center mt-4">
              <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-700">Aucune photo pour l'instant</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Ajoutez des photos d'ambiance depuis "Démarrer une visite".
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {grouped.map(group => (
                <div key={group.dateLabel}>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    {group.dateLabel}
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {group.items.map(photo => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => setSelectedPhoto(photo)}
                        className="aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer"
                      >
                        <img
                          src={photo.photo_url}
                          alt="Photo d'ambiance"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedPhoto && (
        <PhotoViewer
          photo={selectedPhoto}
          horses={horses}
          users={users}
          onClose={() => setSelectedPhoto(null)}
        />
      )}
    </>
  )
}
