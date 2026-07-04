import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AmbiancePhoto, Horse, PhotoTag } from '../lib/types'
import { CANONICAL_ORDER, HORSE_COLORS, formatDateTime } from '../lib/types'
import { resizeImageToBlob, THUMBNAIL_MAX_DIM, THUMBNAIL_QUALITY } from '../lib/imageResize'
import { Image as ImageIcon, X, Share2, Download, Plus, Tag, Filter, ChevronLeft, Trash2, RefreshCw } from 'lucide-react'
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

// ─── Écran de filtre par tags (nuage de mots) ──────────────────────────────
interface TagFreq {
  key: string        // `${tagType}:${label}`
  label: string
  tagType: 'horse' | 'human'
  count: number
}

function TagFilterScreen({
  tags,
  selected,
  onToggle,
  onClear,
  onClose,
}: {
  tags: TagFreq[]
  selected: Set<string>
  onToggle: (key: string) => void
  onClear: () => void
  onClose: () => void
}) {
  const maxCount = Math.max(1, ...tags.map(t => t.count))
  const horseTags = tags.filter(t => t.tagType === 'horse')
  const humanTags = tags.filter(t => t.tagType === 'human')

  function sizeClass(count: number) {
    const ratio = count / maxCount
    if (ratio > 0.66) return 'text-lg font-black'
    if (ratio > 0.33) return 'text-sm font-bold'
    return 'text-xs font-semibold'
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-center bg-black/5">
      <div className="w-full max-w-[390px] bg-[#F6F2EC] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0 border-b border-gray-200/60 bg-white/70 backdrop-blur-sm">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 text-sm font-bold text-gray-500 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            Retour
          </button>
          <h2 className="text-sm font-black text-gray-900">Filtrer par tag</h2>
          <div className="w-14" />
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-4 space-y-5">
          {tags.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">
              Aucun tag pour l'instant — taguez des photos pour les retrouver ici.
            </p>
          ) : (
            <>
              {horseTags.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Chevaux
                  </p>
                  <div className="flex flex-wrap gap-x-2 gap-y-2.5 leading-loose">
                    {horseTags.map(t => {
                      const isSel = selected.has(t.key)
                      return (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => onToggle(t.key)}
                          className={`${sizeClass(t.count)} cursor-pointer px-2 py-0.5 rounded-lg transition-all ${
                            isSel
                              ? 'bg-primary text-white shadow-sm'
                              : 'text-gray-700 bg-white hover:bg-primary/10 hover:text-primary'
                          }`}
                        >
                          {t.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {humanTags.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Humains
                  </p>
                  <div className="flex flex-wrap gap-x-2 gap-y-2.5 leading-loose">
                    {humanTags.map(t => {
                      const isSel = selected.has(t.key)
                      return (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => onToggle(t.key)}
                          className={`${sizeClass(t.count)} cursor-pointer px-2 py-0.5 rounded-lg transition-all ${
                            isSel
                              ? 'bg-gray-700 text-white shadow-sm'
                              : 'text-gray-700 bg-white hover:bg-gray-200'
                          }`}
                        >
                          {t.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {selected.size > 0 && (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full bg-primary text-white font-bold text-sm py-2.5 rounded-xl shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
                >
                  Photos triées
                </button>
              )}
            </>
          )}
        </div>

        {/* Barre du bas */}
        <div className="flex items-center justify-center px-5 py-4 border-t border-gray-200/60 bg-white/70 flex-shrink-0 backdrop-blur-sm">
          <button
            type="button"
            onClick={onClear}
            disabled={selected.size === 0}
            className="text-sm font-bold text-gray-400 px-3 py-2.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Tout effacer
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Visionneuse plein écran : partage + tagging ───────────────────────────
function PhotoViewer({
  photo,
  horses,
  users,
  readOnly = false,
  onClose,
  onDeleted,
}: {
  photo: AmbiancePhoto
  horses: Horse[]
  users: SimpleUser[]
  readOnly?: boolean
  onClose: () => void
  onDeleted: (photoId: string) => void
}) {
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

  const [tags, setTags] = useState<PhotoTag[]>([])
  const [tagsLoading, setTagsLoading] = useState(true)
  const [horseSuggestions, setHorseSuggestions] = useState<string[]>([])
  const [humanSuggestions, setHumanSuggestions] = useState<string[]>([])
  const [showHorsePicker, setShowHorsePicker] = useState(false)
  const [showHumanPicker, setShowHumanPicker] = useState(false)

  // ── Suppression (Famille) ──────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const { error: tagsErr } = await supabase.from('photo_tags').delete().eq('photo_id', photo.id)
      if (tagsErr) throw tagsErr
      const { error: photoErr } = await supabase.from('ambiance_photos').delete().eq('id', photo.id)
      if (photoErr) throw photoErr

      // Nettoyage du stockage — best-effort, une facture/photo déjà retirée de
      // la base ne doit pas rester bloquée par un échec de suppression fichier.
      if (photo.storage_path) {
        await supabase.storage.from('ambiance-photos').remove([photo.storage_path])
        await supabase.storage.from('ambiance-photos').remove([`thumb/${photo.storage_path}`])
      }

      onDeleted(photo.id)
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Erreur lors de la suppression.')
      setDeleting(false)
    }
  }

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

  // Extension cohérente avec le vrai type MIME reçu (les photos ne sont pas
  // toutes des JPEG malgré le suffixe .jpg par défaut du nom de fichier).
  function extensionForMime(mime: string): string {
    if (mime.includes('png')) return 'png'
    if (mime.includes('heic')) return 'heic'
    if (mime.includes('webp')) return 'webp'
    return 'jpg'
  }

  async function handleShare() {
    setSharing(true)
    setShareError(null)
    try {
      const response = await fetch(photo.photo_url)
      const blob = await response.blob()
      const mime = blob.type || 'image/jpeg'
      const file = new File([blob], `pegasus-ambiance-${photo.id}.${extensionForMime(mime)}`, { type: mime })

      // navigator.share avec "files" est ce qui fait apparaître "Enregistrer
      // dans Google Photos" dans la feuille de partage Android — priorité 1.
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Photo Pegasus — Élevage Scalbert' })
      } else {
        const objectUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = objectUrl
        link.download = file.name
        link.click()
        URL.revokeObjectURL(objectUrl)
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

  async function handleDownload() {
    // Le fichier étant cross-origin (Supabase Storage), l'attribut "download"
    // est ignoré par la plupart des navigateurs sur une URL directe — on
    // passe donc par un blob local (même origine) pour forcer le téléchargement.
    try {
      const response = await fetch(photo.photo_url)
      const blob = await response.blob()
      const mime = blob.type || 'image/jpeg'
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = `pegasus-ambiance-${photo.id}.${extensionForMime(mime)}`
      link.click()
      URL.revokeObjectURL(objectUrl)
    } catch {
      setShareError('Téléchargement impossible.')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-center bg-black/90">
      <div className="w-full max-w-[390px] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <span className="text-xs font-bold text-white/80">
            {formatDateTime(photo.visited_at)}
          </span>
          <div className="flex items-center gap-2">
            {!readOnly && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 cursor-pointer hover:bg-red-500/30"
              >
                <Trash2 className="w-4 h-4 text-white" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 cursor-pointer hover:bg-white/20"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
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
                        onRemove={readOnly ? undefined : () => removeTag(t.id)}
                      />
                    ))}
                    {!readOnly && !showHorsePicker && (
                      <button
                        type="button"
                        onClick={() => setShowHorsePicker(true)}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-full cursor-pointer bg-white/15 text-white flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Cheval
                      </button>
                    )}
                  </div>
                  {!readOnly && showHorsePicker && (
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
                      <TagChip key={t.id} label={t.label} color="#6B7280" onRemove={readOnly ? undefined : () => removeTag(t.id)} />
                    ))}
                    {!readOnly && !showHumanPicker && (
                      <button
                        type="button"
                        onClick={() => setShowHumanPicker(true)}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-full cursor-pointer bg-white/15 text-white flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Humain
                      </button>
                    )}
                  </div>
                  {!readOnly && showHumanPicker && (
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

      {/* ── Popup confirmation suppression ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-6">
          <div className="bg-white rounded-xl p-5 w-full max-w-xs">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-900">Supprimer cette photo ?</p>
              <button onClick={() => setConfirmDelete(false)} className="cursor-pointer">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Action définitive — la photo et ses tags seront supprimés.
            </p>
            {deleteError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                {deleteError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg text-xs font-bold text-gray-500 bg-gray-50 cursor-pointer disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg text-xs font-bold text-white bg-red-600 cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page Galerie ─────────────────────────────────────────────────────────────
export default function GaleriePhotos({ readOnly = false }: { readOnly?: boolean }) {
  const [photos, setPhotos] = useState<AmbiancePhoto[]>([])
  const [horses, setHorses] = useState<Horse[]>([])
  const [users, setUsers] = useState<SimpleUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<AmbiancePhoto | null>(null)

  // ── Génération rétroactive des miniatures manquantes ──────────────────────
  const [generatingThumbs, setGeneratingThumbs] = useState(false)
  const [thumbProgress, setThumbProgress] = useState<{ done: number; total: number } | null>(null)

  // ── Filtre par tags ───────────────────────────────────────────────────────
  const [showFilter, setShowFilter] = useState(false)
  const [tagFreqs, setTagFreqs] = useState<TagFreq[]>([])
  const [photoTagKeys, setPhotoTagKeys] = useState<Record<string, Set<string>>>({})
  const [selectedFilterKeys, setSelectedFilterKeys] = useState<Set<string>>(new Set())

  async function fetchAllTags() {
    const { data } = await supabase.from('photo_tags').select('photo_id, tag_type, label')
    if (!data) return

    const freqMap = new Map<string, TagFreq>()
    const byPhoto: Record<string, Set<string>> = {}

    for (const row of data as { photo_id: string; tag_type: 'horse' | 'human'; label: string }[]) {
      const key = `${row.tag_type}:${row.label}`
      const existing = freqMap.get(key)
      if (existing) {
        existing.count += 1
      } else {
        freqMap.set(key, { key, label: row.label, tagType: row.tag_type, count: 1 })
      }
      if (!byPhoto[row.photo_id]) byPhoto[row.photo_id] = new Set()
      byPhoto[row.photo_id].add(key)
    }

    setTagFreqs([...freqMap.values()].sort((a, b) => b.count - a.count))
    setPhotoTagKeys(byPhoto)
  }

  function toggleFilterKey(key: string) {
    setSelectedFilterKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

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

      const { data: horsesData } = await supabase.from('horses').select('*').eq('is_active', true)
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

  useEffect(() => {
    fetchAll()
    fetchAllTags()
  }, [])

  function handlePhotoDeleted(photoId: string) {
    setPhotos(prev => prev.filter(p => p.id !== photoId))
    setSelectedPhoto(null)
  }

  // Régénère les miniatures des photos déjà en ligne avant l'ajout de
  // thumbnail_url — best-effort, une photo par photo pour ne pas saturer.
  async function handleGenerateMissingThumbnails() {
    const targets = photos.filter(p => !p.thumbnail_url && p.storage_path)
    if (targets.length === 0) return
    setGeneratingThumbs(true)
    setThumbProgress({ done: 0, total: targets.length })
    for (let i = 0; i < targets.length; i++) {
      const photo = targets[i]
      try {
        const response = await fetch(photo.photo_url)
        const blob = await response.blob()
        const thumbBlob = await resizeImageToBlob(blob, THUMBNAIL_MAX_DIM, THUMBNAIL_QUALITY)
        const thumbPath = `thumb/${photo.storage_path}`
        const { error: uploadErr } = await supabase.storage
          .from('ambiance-photos')
          .upload(thumbPath, thumbBlob, { upsert: true })
        if (!uploadErr) {
          const { data: signedData } = await supabase.storage
            .from('ambiance-photos')
            .createSignedUrl(thumbPath, 60 * 60 * 24 * 365)
          if (signedData?.signedUrl) {
            await supabase.from('ambiance_photos').update({ thumbnail_url: signedData.signedUrl }).eq('id', photo.id)
          }
        }
      } catch (err) {
        console.error('Génération miniature impossible pour', photo.id, err)
      }
      setThumbProgress({ done: i + 1, total: targets.length })
    }
    await fetchAll()
    setGeneratingThumbs(false)
    setThumbProgress(null)
  }

  const filteredPhotos = selectedFilterKeys.size === 0
    ? photos
    : photos.filter(p => {
        const keys = photoTagKeys[p.id]
        if (!keys) return false
        for (const k of selectedFilterKeys) {
          if (!keys.has(k)) return false
        }
        return true
      })

  const missingThumbCount = photos.filter(p => !p.thumbnail_url && p.storage_path).length

  return (
    <>
      <div className="flex-1 flex flex-col">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">Galerie</h1>
            <p className="text-xs text-gray-500 mt-0.5">Photos d'ambiance — Élevage Scalbert</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {selectedFilterKeys.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedFilterKeys(new Set())}
                className="text-xs font-bold px-3 py-2 rounded-full cursor-pointer text-gray-500 hover:text-gray-700"
              >
                Effacer les filtres
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowFilter(true)}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full cursor-pointer transition-colors flex-shrink-0 ${
                selectedFilterKeys.size > 0
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filtre{selectedFilterKeys.size > 0 ? ` (${selectedFilterKeys.size})` : ''}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6">
          {!readOnly && !loading && missingThumbCount > 0 && (
            <button
              type="button"
              onClick={handleGenerateMissingThumbnails}
              disabled={generatingThumbs}
              className="w-full flex items-center justify-center gap-2 text-xs font-bold text-gray-500 bg-white border border-gray-200 rounded-xl py-2.5 mb-4 cursor-pointer hover:border-primary/40 disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generatingThumbs ? 'animate-spin' : ''}`} />
              {generatingThumbs && thumbProgress
                ? `Génération des miniatures… ${thumbProgress.done}/${thumbProgress.total}`
                : `Générer les miniatures manquantes (${missingThumbCount})`}
            </button>
          )}
          {loading ? (
            <Spinner />
          ) : error ? (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <p className="font-semibold mb-1">Impossible de charger les photos</p>
              <p className="text-xs font-mono">{error}</p>
            </div>
          ) : filteredPhotos.length === 0 ? (
            <div className="bg-white rounded-xl p-6 shadow-xs text-center mt-4">
              <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-700">
                {photos.length === 0 ? "Aucune photo pour l'instant" : 'Aucune photo pour ce filtre'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {photos.length === 0
                  ? 'Ajoutez des photos d\'ambiance depuis "Démarrer une visite".'
                  : 'Essayez un autre tag, ou effacez le filtre.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {filteredPhotos.map(photo => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setSelectedPhoto(photo)}
                  className="aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer"
                >
                  <img
                    src={photo.thumbnail_url ?? photo.photo_url}
                    alt="Photo d'ambiance"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </button>
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
          readOnly={readOnly}
          onClose={() => setSelectedPhoto(null)}
          onDeleted={handlePhotoDeleted}
        />
      )}

      {showFilter && (
        <TagFilterScreen
          tags={tagFreqs}
          selected={selectedFilterKeys}
          onToggle={toggleFilterKey}
          onClear={() => setSelectedFilterKeys(new Set())}
          onClose={() => setShowFilter(false)}
        />
      )}
    </>
  )
}
