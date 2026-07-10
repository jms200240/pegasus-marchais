import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AmbiancePhoto, FarmAlert } from '../lib/types'
import { formatDateTime } from '../lib/types'
import { Wheat, Droplets, CalendarCheck, Image as ImageIcon, Stethoscope } from 'lucide-react'
import { todayYmd } from '../lib/financeUtils'
import VisiteSheet from '../components/VisiteSheet'
import VisiteProSheet from '../components/VisiteProSheet'

// ─── Spinner inline ──────────────────────────────────────────────────────────
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

// ─── Page Accueil ─────────────────────────────────────────────────────────────
export default function Accueil({
  readOnly = false,
  isGroom = false,
  userId = '',
}: {
  readOnly?: boolean
  isGroom?: boolean
  userId?: string
}) {
  const [alerts, setAlerts] = useState<Record<string, boolean>>({ foin: false, eau: false })
  const [randomPhoto, setRandomPhoto] = useState<AmbiancePhoto | null>(null)
  const [loading, setLoading] = useState(true)
  const [visiteOpen, setVisiteOpen] = useState(false)
  const [visiteProOpen, setVisiteProOpen] = useState(false)

  // Écran identique à la Famille pour le groom — le check-in (comptage des
  // jours payés) est silencieux, greffé sur le clic "Démarrer une visite".
  function handleStartVisite() {
    if (isGroom && userId) {
      // amount_ttc utilise le défaut base (7.00 €) ; paid_month vide tant
      // que le mois n'a pas été soldé par la Famille (colonne NOT NULL sans défaut).
      supabase.from('groom_visits').insert({ user_id: userId, visit_date: todayYmd(), paid_month: '' })
        .then(({ error }) => { if (error) console.error('Erreur enregistrement visite groom:', error) })
    }
    setVisiteOpen(true)
  }

  async function fetchData() {
    setLoading(true)
    try {
      const [
        { data: alertsData, error: alertsErr },
        { data: photosData, error: photosErr },
      ] = await Promise.all([
        supabase.from('farm_alerts').select('*'),
        supabase.from('ambiance_photos').select('*'),
      ])
      if (alertsErr) throw alertsErr
      if (photosErr) throw photosErr

      const map: Record<string, boolean> = {}
      ;(alertsData as FarmAlert[] ?? []).forEach(a => { map[a.key] = a.active })
      setAlerts(map)

      // Photo aléatoire, retirée à chaque ouverture de la page (pas la dernière).
      const photos = (photosData as AmbiancePhoto[]) ?? []
      setRandomPhoto(photos.length > 0 ? photos[Math.floor(Math.random() * photos.length)] : null)
    } catch (err) {
      console.error('Erreur chargement Accueil:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  // Rafraîchit les données à la fermeture de VisiteSheet
  function handleVisiteClose() {
    setVisiteOpen(false)
    fetchData()
  }

  // Rafraîchit les données à la fermeture de VisiteProSheet
  function handleVisiteProClose() {
    setVisiteProOpen(false)
    fetchData()
  }

  const foinActif = alerts['foin'] === true
  const eauActive = alerts['eau'] === true

  // ─── Rendu ──────────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex-1 flex flex-col">
        {/* En-tête */}
        <div className="px-5 pt-5 pb-3">
          <h1 className="text-2xl font-bold text-gray-900 leading-tight font-sans">Accueil</h1>
          <p className="text-xs text-gray-500 mt-0.5">Tableau de bord — Élevage Scalbert</p>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6 space-y-4">

          {loading ? (
            <Spinner />
          ) : (
            <>
              {/* ── Bannières d'alerte (lecture seule) ── */}
              {(foinActif || eauActive) && (
                <div className="space-y-2">
                  {foinActif && (
                    <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl">
                      <Wheat className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <p className="text-xs font-bold text-amber-700">Alerte foin — commander une botte</p>
                    </div>
                  )}
                  {eauActive && (
                    <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl">
                      <Droplets className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <p className="text-xs font-bold text-amber-700">Alerte eau — vérifier la bassine</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Bouton Démarrer une visite (identique Famille/Groom — check-in silencieux pour le groom) ── */}
              {(!readOnly || isGroom) && (
                <button
                  type="button"
                  onClick={handleStartVisite}
                  className="w-full flex items-center justify-center gap-2.5 font-bold text-sm text-white rounded-xl shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
                  style={{ backgroundColor: '#2f6b3f', minHeight: '56px' }}
                >
                  <CalendarCheck className="w-5 h-5" />
                  Démarrer une visite
                </button>
              )}

              {/* ── Photo d'ambiance (aléatoire à chaque ouverture) ── */}
              <section>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Photo d'ambiance
                </p>

                {randomPhoto ? (
                  <div className="bg-white rounded-xl overflow-hidden shadow-xs">
                    <img
                      src={randomPhoto.thumbnail_url ?? randomPhoto.photo_url}
                      alt="Photo d'ambiance"
                      className="w-full aspect-[4/3] object-cover"
                    />
                    <p className="text-[10px] text-gray-400 px-3 py-2">
                      {formatDateTime(randomPhoto.visited_at)}
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl p-5 shadow-xs text-center">
                    <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-gray-700">Aucune photo pour l'instant</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Ajoutez-en une depuis "Démarrer une visite".
                    </p>
                  </div>
                )}
              </section>

              {/* ── Bouton Démarrer une visite pro ── */}
              {(!readOnly || isGroom) && (
                <button
                  type="button"
                  onClick={() => setVisiteProOpen(true)}
                  className="w-full flex items-center justify-center gap-2 font-bold text-xs text-white rounded-xl shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
                  style={{ backgroundColor: '#4A5FA0', minHeight: '40px' }}
                >
                  <Stethoscope className="w-4 h-4" />
                  Démarrer une visite pro
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── VisiteSheet ── */}
      {visiteOpen && <VisiteSheet onClose={handleVisiteClose} />}

      {/* ── VisiteProSheet ── */}
      {visiteProOpen && <VisiteProSheet onClose={handleVisiteProClose} />}
    </>
  )
}
