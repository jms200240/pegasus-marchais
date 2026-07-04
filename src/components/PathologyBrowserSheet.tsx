import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Pathology } from '../lib/types'
import { X, Search } from 'lucide-react'
import { FichePathologie } from './BoboWizard'

export default function PathologyBrowserSheet({ onClose }: { onClose: () => void }) {
  const [pathologies, setPathologies] = useState<Pathology[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPathology, setSelectedPathology] = useState<Pathology | null>(null)

  useEffect(() => {
    supabase
      .from('pathologies')
      .select('*')
      .order('freq_score', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setPathologies(data)
        setLoading(false)
      })
  }, [])

  const filteredPathologies = pathologies.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.variants ?? []).some(v => v.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (filteredPathologies.length === 1) {
      setSelectedPathology(filteredPathologies[0])
    }
  }

  return (
    <>
      {/* Overlay plein écran */}
      <div className="fixed inset-0 z-[60] flex justify-center bg-black/5">
        <div className="w-full max-w-[390px] bg-[#F6F2EC] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-2 flex-shrink-0">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Fiches maladies
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-sm cursor-pointer hover:bg-gray-50"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Contenu scrollable */}
          <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-4">
            <h2 className="text-base font-black text-gray-900 mb-1">Quelle pathologie ?</h2>
            <p className="text-xs text-gray-400 mb-3">
              Touche un terme du nuage, ou recherche puis valide.
            </p>

            {/* Champ de recherche */}
            <form onSubmit={handleSearchSubmit} className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher une pathologie…"
                className="w-full text-sm border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </form>

            {/* Nuage de mots — taille proportionnelle à freq_score */}
            {loading ? (
              <div className="text-xs text-gray-400 text-center py-6">
                Chargement des pathologies…
              </div>
            ) : (
              <div className="flex flex-wrap gap-x-2 gap-y-2.5 leading-loose">
                {filteredPathologies.map(p => {
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
                      onClick={() => setSelectedPathology(p)}
                      className={`${sizeClass} cursor-pointer px-2 py-0.5 rounded-lg transition-all ${
                        p.is_urgent
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
          </div>
        </div>
      </div>

      {/* Fiche pathologie sélectionnée */}
      {selectedPathology && (
        <FichePathologie
          pathology={selectedPathology}
          onClose={() => setSelectedPathology(null)}
        />
      )}
    </>
  )
}
