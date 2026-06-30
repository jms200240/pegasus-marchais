import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AmbiancePhoto } from '../lib/types'
import { formatDateTime } from '../lib/types'
import { Image as ImageIcon, X, Share2, Download } from 'lucide-react'

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

// ─── Visionneuse plein écran avec partage natif (Google Photos via share sheet) ──
function PhotoViewer({ photo, onClose }: { photo: AmbiancePhoto; onClose: () => void }) {
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

  async function handleShare() {
    setSharing(true)
    setShareError(null)
    try {
      const response = await fetch(photo.photo_url)
      const blob = await response.blob()
      const file = new File([blob], `pegasus-ambiance-${photo.id}.jpg`, { type: blob.type || 'image/jpeg' })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Photo Pegasus',
        })
      } else {
        // Pas de partage natif disponible (souvent le cas sur desktop) : on télécharge
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `pegasus-ambiance-${photo.id}.jpg`
        link.click()
        URL.revokeObjectURL(link.href)
      }
    } catch (err: unknown) {
      // L'utilisateur peut annuler le partage — ce n'est pas une vraie erreur
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

        <div className="flex-1 flex items-center justify-center px-3">
          <img
            src={photo.photo_url}
            alt="Photo d'ambiance"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
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
              {sharing ? 'Partage…' : 'Partager (vers Google Photos…)'}
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
            "Partager" ouvre le menu de votre téléphone — choisissez "Google Photos"
            (ou "Importer dans Photos") pour l'enregistrer dans votre compte.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Page Galerie ─────────────────────────────────────────────────────────────
export default function GaleriePhotos() {
  const [photos, setPhotos] = useState<AmbiancePhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<AmbiancePhoto | null>(null)

  useEffect(() => {
    async function fetchPhotos() {
      setLoading(true)
      setError(null)
      try {
        const { data, error: fetchErr } = await supabase
          .from('ambiance_photos')
          .select('*')
          .order('visited_at', { ascending: false })
        if (fetchErr) throw fetchErr
        setPhotos(data ?? [])
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        setLoading(false)
      }
    }
    fetchPhotos()
  }, [])

  // Regroupement par date (jour) pour un affichage chronologique lisible
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
        <PhotoViewer photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} />
      )}
    </>
  )
}
