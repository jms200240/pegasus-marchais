import { useEffect, useState } from 'react'
import { X, Plus, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import drFredericAuge from '../assets/veterinaires/dr-frederic-auge.jpg'
import drAndreaMichoux from '../assets/veterinaires/dr-andrea-michoux.jpg'
import drMartinVellard from '../assets/veterinaires/dr-martin-vellard.jpg'
import drLeaHirschauer from '../assets/veterinaires/dr-lea-hirschauer.jpg'
import drNadegeGruest from '../assets/veterinaires/dr-nadege-gruest.jpg'
import drMelissaPayet from '../assets/veterinaires/dr-melissa-payet.jpeg'
import drSophieVellard from '../assets/veterinaires/dr-sophie-vellard.jpeg'
import drElsaCharpentier from '../assets/veterinaires/dr-elsa-charpentier.jpg'
import drPaulLucas from '../assets/veterinaires/dr-paul-lucas.jpg'

// Photos statiques pour les 9 vétérinaires historiques (rang 1 à 9) — zéro latence.
// Les vétérinaires ajoutés ensuite (rang >= 10) n'ont pas de photo, juste un avatar initiales.
const STATIC_PHOTOS: Record<number, string> = {
  1: drFredericAuge,
  2: drAndreaMichoux,
  3: drMartinVellard,
  4: drLeaHirschauer,
  5: drNadegeGruest,
  6: drMelissaPayet,
  7: drSophieVellard,
  8: drElsaCharpentier,
  9: drPaulLucas,
}

interface VeterinaireRow {
  id: string
  rang: number
  nom: string
  photo_url: string | null
}

function getInitiales(nom: string): string {
  const mots = nom.replace(/^Dr\.?\s*/i, '').split(' ').filter(Boolean)
  return mots.map(m => m[0]).join('').toUpperCase().slice(0, 2)
}

interface VeterinairePickerProps {
  onSelect: (nom: string) => void
  onClose: () => void
}

export default function VeterinairePicker({ onSelect, onClose }: VeterinairePickerProps) {
  const [vets, setVets] = useState<VeterinaireRow[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [newNom, setNewNom] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function fetchVets() {
    setLoading(true)
    const { data } = await supabase
      .from('veterinaires')
      .select('*')
      .order('rang', { ascending: true })
    setVets((data as VeterinaireRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchVets() }, [])

  async function handleAdd() {
    const nom = newNom.trim()
    if (!nom) return
    setSaving(true)
    setSaveError(null)
    try {
      const nextRang = vets.length > 0 ? Math.max(...vets.map(v => v.rang)) + 1 : 1
      const { error } = await supabase
        .from('veterinaires')
        .insert({ rang: nextRang, nom })
      if (error) throw error
      setNewNom('')
      setAddOpen(false)
      await fetchVets()
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex justify-center bg-black/40">
      <div className="w-full max-w-[390px] bg-[#F6F2EC] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0 border-b border-gray-200/60 bg-white/70 backdrop-blur-sm">
          <h2 className="text-base font-black text-gray-900">Vétérinaire présent</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Grille 3 colonnes, triée par rang */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-4 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {vets.map(vet => {
                const photo = STATIC_PHOTOS[vet.rang] ?? vet.photo_url
                return (
                  <button
                    key={vet.id}
                    type="button"
                    onClick={() => onSelect(vet.nom)}
                    className="flex flex-col items-center gap-1.5 cursor-pointer group"
                  >
                    <div className="w-full aspect-square rounded-full overflow-hidden border-2 border-transparent group-hover:border-green-300 group-active:scale-95 transition-all bg-white shadow-xs flex items-center justify-center">
                      {photo ? (
                        <img src={photo} alt={vet.nom} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-black" style={{ color: '#2f6b3f' }}>
                          {getInitiales(vet.nom)}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-semibold text-gray-700 text-center leading-tight">
                      {vet.nom}
                    </span>
                  </button>
                )
              })}

              {/* Vignette "+" ajouter un vétérinaire */}
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="flex flex-col items-center gap-1.5 cursor-pointer group"
              >
                <div className="w-full aspect-square rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center group-hover:border-green-300 group-active:scale-95 transition-all bg-white">
                  <Plus className="w-6 h-6 text-gray-400" />
                </div>
                <span className="text-[10px] font-semibold text-gray-400 text-center leading-tight">
                  Ajouter
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Popup ajout ── */}
      {addOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-6">
          <div className="bg-white rounded-xl p-5 w-full max-w-xs">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-900">Nouveau vétérinaire</p>
              <button onClick={() => setAddOpen(false)} className="cursor-pointer">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <input
              type="text"
              value={newNom}
              onChange={e => setNewNom(e.target.value)}
              placeholder="Dr Prénom NOM"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 mb-3 focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
            />
            {saveError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                {saveError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setAddOpen(false)}
                className="flex-1 py-2 rounded-lg text-xs font-bold text-gray-500 bg-gray-50 cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleAdd}
                disabled={saving || !newNom.trim()}
                className="flex-1 py-2 rounded-lg text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: '#2f6b3f' }}
              >
                {saving ? 'Ajout…' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
