import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Horse, Pathology } from '../lib/types'
import { CANONICAL_ORDER, HORSE_COLORS } from '../lib/types'
import { X, ChevronLeft, Camera, ExternalLink, Search } from 'lucide-react'

// ─── Fiche pathologie ─────────────────────────────────────────────────────
// Export nommé — réutilisé dans Soins.tsx (bouton Info)
export function FichePathologie({
  pathology,
  onClose,
}: {
  pathology: Pathology
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto no-scrollbar">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0 pr-3">
            <h2 className="text-lg font-black text-gray-900 leading-tight">{pathology.name}</h2>
            <span className="text-xs text-primary font-semibold">{pathology.category}</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-gray-100 cursor-pointer"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {pathology.is_urgent && (
          <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-600">
            ⚠️ Pathologie urgente — contacter un vétérinaire rapidement
          </div>
        )}

        {pathology.definition && <Section titre="Définition" texte={pathology.definition} />}
        {pathology.signs && <Section titre="Signes" texte={pathology.signs} />}
        {pathology.conduct && <Section titre="Conduite à tenir" texte={pathology.conduct} />}
        {pathology.prevention && <Section titre="Prévention" texte={pathology.prevention} />}

        {pathology.source_url && (
          <a
            href={pathology.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-primary font-semibold mt-3 hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
            Source : {pathology.source_name ?? pathology.source_url}
          </a>
        )}

        <button
          onClick={onClose}
          className="mt-5 w-full bg-primary text-white font-bold text-sm py-3 rounded-xl cursor-pointer active:scale-[0.98] transition-transform"
        >
          Fermer
        </button>
      </div>
    </div>
  )
}

function Section({ titre, texte }: { titre: string; texte: string }) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{titre}</p>
      <p className="text-sm text-gray-700 leading-relaxed">{texte}</p>
    </div>
  )
}

// ─── StarPicker ──────────────────────────────────────────────────────────
function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          className={`text-3xl leading-none cursor-pointer transition-colors ${
            i <= value ? 'text-amber-400' : 'text-gray-200'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

// ─── Indicateur de progression ────────────────────────────────────────────
function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 mb-4">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i + 1 === step
              ? 'w-5 h-2 bg-primary'
              : i + 1 < step
              ? 'w-2 h-2 bg-primary/50'
              : 'w-2 h-2 bg-gray-200'
          }`}
        />
      ))}
    </div>
  )
}

// ─── Chip bouton générique ────────────────────────────────────────────────
function Chip({
  label,
  selected,
  onClick,
}: {
  label: string
  selected?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-all border ${
        selected
          ? 'bg-primary border-primary text-white shadow-sm'
          : 'border-gray-200 bg-white text-gray-700 hover:border-primary/40'
      }`}
    >
      {label}
    </button>
  )
}

// ─── Données de localisation ──────────────────────────────────────────────
const ZONES = [
  'Membre',
  'Tête',
  'Encolure',
  'Dos / garrot',
  'Ventre / flancs',
  'Croupe / arrière-main',
  'Queue / péri-anal',
  'Général / systémique',
]

const LATERALITES_MEMBRE = [
  { label: 'Antérieur Gauche (AVG)', code: 'AVG' },
  { label: 'Antérieur Droit (AVD)', code: 'AVD' },
  { label: 'Postérieur Gauche (PG)',  code: 'PG'  },
  { label: 'Postérieur Droit (PD)',   code: 'PD'  },
]

const REGIONS_MEMBRE = [
  'Sabot / pied',
  'Paturon / couronne',
  'Canon',
  'Boulet',
  'Tendons / ligaments',
  'Genou / Grasset',
  'Jarret',
  'Épaule / Hanche',
]

const REGIONS_TETE: { label: string; lat: string | null }[] = [
  { label: 'Œil droit',        lat: 'D' },
  { label: 'Œil gauche',       lat: 'G' },
  { label: 'Naseaux',          lat: null },
  { label: 'Oreilles',         lat: null },
  { label: 'Bouche / dents',   lat: null },
  { label: 'Chanfrein / joues',lat: null },
]

const FACES_MEMBRE = [
  'Face interne',
  'Face externe',
  'Face antérieure',
  'Face postérieure',
]

const LIBELLES_GRAVITE = ['', 'Légère', 'Modérée', 'Notable', 'Sérieuse', 'Urgente']

// ─── BoboWizard (export par défaut) ──────────────────────────────────────
interface BoboWizardProps {
  horses: Horse[]
  onCreated: () => void
  onClose: () => void
}

export default function BoboWizard({ horses, onCreated, onClose }: BoboWizardProps) {
  const TOTAL_STEPS = 5

  // ── Navigation ──────────────────────────────────────────────────────────
  const [step, setStep] = useState(1)

  // ── Étape 1 — Cheval ───────────────────────────────────────────────────
  const [horseId, setHorseId] = useState('')

  // ── Étape 2 — Pathologie ──────────────────────────────────────────────
  const [pathologies, setPathologies] = useState<Pathology[]>([])
  const [loadingPath, setLoadingPath] = useState(true)
  const [selectedPathology, setSelectedPathology] = useState<Pathology | null>(null)
  const [isAutre, setIsAutre] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // ── Étape 3 — Localisation ────────────────────────────────────────────
  const [zone, setZone] = useState('')
  const [lateraliteCode, setLateraliteCode] = useState<string | null>(null)
  const [region, setRegion] = useState('')
  const [face, setFace] = useState('')

  // ── Étape 4 — Gravité ─────────────────────────────────────────────────
  const [severity, setSeverity] = useState(2)

  // ── Étape 5 — Note + Photos ───────────────────────────────────────────
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState<File[]>([])

  // ── Enregistrement ────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Post-save : fiche pathologie ──────────────────────────────────────
  const [showFiche, setShowFiche] = useState(false)
  const [savedPathology, setSavedPathology] = useState<Pathology | null>(null)

  // Fetch toutes les pathologies au montage (tri freq_score desc)
  useEffect(() => {
    supabase
      .from('pathologies')
      .select('*')
      .order('freq_score', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setPathologies(data)
        setLoadingPath(false)
      })
  }, [])

  // Pré-remplir la gravité dès que la pathologie change
  useEffect(() => {
    if (selectedPathology?.default_severity) {
      setSeverity(selectedPathology.default_severity)
    } else if (isAutre) {
      setSeverity(2)
    }
  }, [selectedPathology, isAutre])

  // Tri canonique des chevaux
  const sortedHorses = [...horses].sort((a, b) => {
    const ia = CANONICAL_ORDER.indexOf(a.name as typeof CANONICAL_ORDER[number])
    const ib = CANONICAL_ORDER.indexOf(b.name as typeof CANONICAL_ORDER[number])
    if (ia === -1 && ib === -1) return a.name.localeCompare(b.name)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })

  // Filtre texte sur le nuage de mots (nom + variantes)
  const filteredPathologies = pathologies.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.variants ?? []).some(v => v.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Construction de la chaîne lisible de localisation
  function buildLocation(): string {
    const parts: string[] = []
    if (zone) parts.push(zone)
    if (zone === 'Tête' && region) parts.push(region)
    if (zone === 'Membre' && region) parts.push(region)
    if (zone === 'Membre' && face) parts.push(face)
    return parts.join(' – ')
  }

  // Validation de l'étape courante pour débloquer "Suivant"
  function canGoNext(): boolean {
    switch (step) {
      case 1: return !!horseId
      case 2: return !!selectedPathology || isAutre
      case 3: {
        if (!selectedPathology?.has_laterality) return true
        return !!lateraliteCode
      }
      case 4: return true
      case 5: return true
      default: return false
    }
  }

  // Navigation suivant — skip étape 3 si "Autre"
  function handleNext() {
    if (step === 2 && isAutre) { setStep(4); return }
    if (step < TOTAL_STEPS) setStep(s => s + 1)
  }

  // Navigation précédent — retour étape 2 si on vient de 4 en mode Autre
  function handlePrev() {
    if (step === 4 && isAutre) { setStep(2); return }
    if (step > 1) setStep(s => s - 1)
  }

  // Reset sous-niveaux quand la zone change
  function handleZoneSelect(z: string) {
    setZone(z)
    setLateraliteCode(null)
    setRegion('')
    setFace('')
  }

  // Enregistrement final
  async function handleSubmit() {
    setSaving(true)
    setSaveError(null)
    try {
      // 1. Upload photos vers bucket bobo-photos (URL signée 1 an)
      const photoUrls: string[] = []
      for (const file of photos) {
        const path = `${horseId}/${Date.now()}-${file.name}`
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

      // 2. Localisation
      const locationStr = buildLocation() || null
      const lateralityStr = lateraliteCode ?? null

      // 3. Note finale (préfixe "Autre : " pour les cas libres)
      let finalNote: string | null = note.trim() || null
      if (isAutre && finalNote) finalNote = `Autre : ${finalNote}`

      // 4. Insert dans health_events (pas de title, status, opened_at — valeurs Supabase)
      const { error: insertErr } = await supabase.from('health_events').insert({
        horse_id: horseId,
        pathology_id: selectedPathology?.id ?? null,
        location: locationStr,
        laterality: lateralityStr,
        severity,
        note: finalNote,
        photo_urls: photoUrls.length > 0 ? photoUrls : null,
      })
      if (insertErr) throw insertErr

      // 5. Post-save : afficher fiche si pathologie du référentiel
      if (selectedPathology) {
        setSavedPathology(selectedPathology)
        setShowFiche(true)
      } else {
        onCreated()
        onClose()
      }
    } catch (err: any) {
      setSaveError(err?.message ?? err?.error_description ?? JSON.stringify(err))
    } finally {
      setSaving(false)
    }
  }

  // ─── Rendu de l'étape courante ────────────────────────────────────────
  function renderStep() {
    switch (step) {

      // ── 1 — Cheval ────────────────────────────────────────────────────
      case 1:
        return (
          <div>
            <h2 className="text-base font-black text-gray-900 mb-1">Quel cheval ?</h2>
            <p className="text-xs text-gray-400 mb-5">Sélectionne le cheval concerné.</p>
            <div className="flex flex-wrap gap-2.5">
              {sortedHorses.map(h => {
                const color = h.color_hex ?? HORSE_COLORS[h.name] ?? '#2f6b3f'
                const selected = horseId === h.id
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setHorseId(h.id)}
                    className={`text-sm font-bold px-4 py-2 rounded-full cursor-pointer transition-all text-white ${
                      selected
                        ? 'ring-2 ring-offset-2 ring-gray-400 scale-105 shadow-md'
                        : 'opacity-55 hover:opacity-80'
                    }`}
                    style={{ backgroundColor: color }}
                  >
                    {h.name}
                  </button>
                )
              })}
            </div>
          </div>
        )

      // ── 2 — Pathologie ────────────────────────────────────────────────
      case 2:
        return (
          <div>
            <h2 className="text-base font-black text-gray-900 mb-1">Quelle pathologie ?</h2>
            <p className="text-xs text-gray-400 mb-3">
              Touche un terme du nuage pour le sélectionner.
            </p>

            {/* Champ de recherche */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher une pathologie…"
                className="w-full text-sm border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Chip "Autre / non répertorié" */}
            <div className="mb-4">
              <button
                type="button"
                onClick={() => { setIsAutre(true); setSelectedPathology(null) }}
                className={`text-xs font-bold px-3 py-1.5 rounded-full cursor-pointer transition-all border ${
                  isAutre
                    ? 'bg-gray-800 border-gray-800 text-white shadow-sm'
                    : 'border-gray-300 bg-white text-gray-600 hover:border-gray-500'
                }`}
              >
                Autre / non répertorié
              </button>
            </div>

            {/* Nuage de mots — taille proportionnelle à freq_score */}
            {loadingPath ? (
              <div className="text-xs text-gray-400 text-center py-6">
                Chargement des pathologies…
              </div>
            ) : (
              <div className="flex flex-wrap gap-x-2 gap-y-2.5 leading-loose">
                {filteredPathologies.map(p => {
                  const sel = selectedPathology?.id === p.id
                  const score = p.freq_score ?? 1
                  const sizeClass =
                    score === 3
                      ? 'text-base font-black'
                      : score === 2
                      ? 'text-sm font-bold'
                      : 'text-xs font-semibold'
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setSelectedPathology(p); setIsAutre(false) }}
                      className={`${sizeClass} cursor-pointer px-2 py-0.5 rounded-lg transition-all ${
                        sel
                          ? 'bg-primary text-white shadow-sm'
                          : p.is_urgent
                          ? 'text-red-600 bg-red-50 hover:bg-red-100'
                          : 'text-gray-700 bg-gray-100 hover:bg-primary/10 hover:text-primary'
                      }`}
                    >
                      {p.name}
                    </button>
                  )
                })}
                {filteredPathologies.length === 0 && (
                  <p className="text-xs text-gray-400 italic">Aucun résultat.</p>
                )}
              </div>
            )}

            {/* Récapitulatif sélection */}
            {selectedPathology && (
              <div className="mt-4 px-3 py-2.5 bg-primary/5 border border-primary/20 rounded-xl">
                <p className="text-xs font-bold text-primary">{selectedPathology.name}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{selectedPathology.category}</p>
                {selectedPathology.is_urgent && (
                  <p className="text-[10px] text-red-500 font-bold mt-0.5">⚠️ Urgente</p>
                )}
              </div>
            )}
          </div>
        )

      // ── 3 — Localisation ──────────────────────────────────────────────
      case 3: {
        const hasLat = selectedPathology?.has_laterality ?? false
        const locStr = buildLocation()

        return (
          <div>
            <h2 className="text-base font-black text-gray-900 mb-1">Localisation</h2>
            <p className="text-xs text-gray-400 mb-4">
              {hasLat
                ? 'La latéralité est obligatoire pour cette pathologie.'
                : 'Optionnel — utilise "Passer" si non applicable.'}
            </p>

            {/* Niveau 1 — Zone */}
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Zone
            </p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {ZONES.map(z => (
                <Chip key={z} label={z} selected={zone === z} onClick={() => handleZoneSelect(z)} />
              ))}
            </div>

            {/* Niveau 2a — Latéralité Membre */}
            {zone === 'Membre' && (
              <>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Membre concerné
                </p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {LATERALITES_MEMBRE.map(l => (
                    <Chip
                      key={l.code}
                      label={l.label}
                      selected={lateraliteCode === l.code}
                      onClick={() => {
                        setLateraliteCode(l.code)
                        setRegion('')
                        setFace('')
                      }}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Niveau 2b — Région Membre (après latéralité) */}
            {zone === 'Membre' && lateraliteCode && (
              <>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Région
                </p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {REGIONS_MEMBRE.map(r => (
                    <Chip
                      key={r}
                      label={r}
                      selected={region === r}
                      onClick={() => { setRegion(r); setFace('') }}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Niveau 2 — Région Tête (avec latéralité pour les yeux) */}
            {zone === 'Tête' && (
              <>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Région
                </p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {REGIONS_TETE.map(r => (
                    <Chip
                      key={r.label}
                      label={r.label}
                      selected={region === r.label}
                      onClick={() => {
                        setRegion(r.label)
                        setLateraliteCode(r.lat)
                      }}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Niveau 3 — Face Membre (optionnel, toggle) */}
            {zone === 'Membre' && region && (
              <>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Face{' '}
                  <span className="normal-case font-normal text-gray-300">(optionnel)</span>
                </p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {FACES_MEMBRE.map(f => (
                    <Chip
                      key={f}
                      label={f}
                      selected={face === f}
                      onClick={() => setFace(face === f ? '' : f)}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Récapitulatif */}
            {locStr && (
              <div className="mt-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                <p className="text-xs font-bold text-gray-800">{locStr}</p>
                {lateraliteCode && (
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Latéralité : {lateraliteCode}
                  </p>
                )}
              </div>
            )}
          </div>
        )
      }

      // ── 4 — Gravité ───────────────────────────────────────────────────
      case 4:
        return (
          <div>
            <h2 className="text-base font-black text-gray-900 mb-1">Gravité</h2>
            <p className="text-xs text-gray-400 mb-8">
              {selectedPathology?.default_severity
                ? "Pré-remplie d'après la pathologie — modifiable."
                : "Évalue de 1 (légère) à 5 (urgence vitale)."}
            </p>
            <div className="flex flex-col items-center gap-3">
              <StarPicker value={severity} onChange={setSeverity} />
              <p className="text-sm font-bold text-gray-600">{LIBELLES_GRAVITE[severity]}</p>
            </div>
          </div>
        )

      // ── 5 — Note + Photos ─────────────────────────────────────────────
      case 5:
        return (
          <div>
            <h2 className="text-base font-black text-gray-900 mb-1">Commentaire &amp; Photos</h2>
            <p className="text-xs text-gray-400 mb-4">
              {isAutre
                ? 'Décris le bobo observé (enregistré comme "Autre : …").'
                : "Optionnel — la pathologie et la localisation portent déjà l'essentiel."}
            </p>

            {/* Note */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-gray-500 block mb-1.5">
                Note{' '}
                {!isAutre && (
                  <span className="font-normal text-gray-400">(optionnel)</span>
                )}
              </label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={3}
                placeholder={
                  isAutre
                    ? 'Décris le bobo observé…'
                    : 'Observations complémentaires…'
                }
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            {/* Photos */}
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1.5">
                Photos{' '}
                <span className="font-normal text-gray-400">(optionnel)</span>
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

            {saveError && (
              <p className="mt-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {saveError}
              </p>
            )}
          </div>
        )

      default:
        return null
    }
  }

  const nextDisabled = !canGoNext() || saving
  const isLastStep = step === TOTAL_STEPS
  // Bouton "Passer" visible à l'étape 3 uniquement si latéralité non obligatoire
  const showSkipLoc = step === 3 && !(selectedPathology?.has_laterality)

  return (
    <>
      {/* Overlay plein écran */}
      <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end justify-center">
        <div className="w-full max-w-md bg-[#F6F2EC] rounded-t-3xl flex flex-col max-h-[92dvh]">

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-2 flex-shrink-0">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Étape {step}/{TOTAL_STEPS}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-sm cursor-pointer hover:bg-gray-50"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Indicateur de progression */}
          <div className="px-5 flex-shrink-0">
            <ProgressDots step={step} total={TOTAL_STEPS} />
          </div>

          {/* Contenu scrollable */}
          <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-4">
            {renderStep()}
          </div>

          {/* Barre de navigation */}
          <div className="flex items-center gap-2 px-5 py-4 border-t border-gray-200/60 bg-white/70 flex-shrink-0 backdrop-blur-sm">
            {step > 1 ? (
              <button
                type="button"
                onClick={handlePrev}
                className="flex items-center gap-1 text-sm font-bold text-gray-500 px-3 py-2.5 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Retour
              </button>
            ) : (
              <div className="w-16" />
            )}

            {/* Bouton "Passer" pour étape 3 sans latéralité obligatoire */}
            {showSkipLoc && (
              <button
                type="button"
                onClick={() => {
                  setZone('')
                  setLateraliteCode(null)
                  setRegion('')
                  setFace('')
                  setStep(s => s + 1)
                }}
                className="flex-1 text-sm font-bold text-gray-400 py-2.5 rounded-xl border border-gray-200 bg-white cursor-pointer hover:bg-gray-50 transition-colors"
              >
                Passer
              </button>
            )}

            <button
              type="button"
              onClick={isLastStep ? handleSubmit : handleNext}
              disabled={nextDisabled}
              className={`flex-1 font-bold text-sm py-2.5 rounded-xl transition-all ${
                nextDisabled
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-primary text-white shadow-sm active:scale-[0.98] cursor-pointer'
              }`}
            >
              {saving ? 'Enregistrement…' : isLastStep ? 'Enregistrer le bobo' : 'Suivant →'}
            </button>
          </div>
        </div>
      </div>

      {/* Fiche pathologie post-enregistrement */}
      {showFiche && savedPathology && (
        <FichePathologie
          pathology={savedPathology}
          onClose={() => {
            setShowFiche(false)
            onCreated()
            onClose()
          }}
        />
      )}
    </>
  )
}
