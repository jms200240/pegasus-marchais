export default function Accueil() {
  return (
    <div className="flex-1 p-6 flex flex-col">
      <h1 className="text-2xl font-bold text-gray-900 mb-1 font-sans">Accueil</h1>
      <p className="text-xs text-gray-500">Tableau de bord — Élevage Scalbert</p>
      
      <div className="mt-6 flex-1 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center p-6 text-center text-gray-400 bg-white/50">
        <div>
          <div className="w-12 h-12 rounded-full bg-primary/5 text-primary flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider block text-gray-700">Module Accueil</span>
          <span className="text-xs text-gray-400 block mt-1">Données et statistiques de l'élevage à venir.</span>
        </div>
      </div>
    </div>
  )
}
