export default function Chevaux() {
  return (
    <div className="flex-1 p-6 flex flex-col">
      <h1 className="text-2xl font-bold text-gray-900 mb-1 font-sans">Chevaux</h1>
      <p className="text-xs text-gray-500">Liste & fiches d'identité</p>
      
      <div className="mt-6 flex-1 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center p-6 text-center text-gray-400 bg-white/50">
        <div>
          <div className="w-12 h-12 rounded-full bg-primary/5 text-primary flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 20c3-1.5 5.5-3 8-3h4c2.5 0 4-1.5 4-4v-1c0-1.5-1.5-2.5-3-2.5h-1L13 6l-2-2H8c-2 0-3 1.5-3 3v8h-2" />
              <circle cx="11" cy="8" r="1" />
            </svg>
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider block text-gray-700">Module Chevaux</span>
          <span className="text-xs text-gray-400 block mt-1">Gestion des 7 chevaux actifs à venir.</span>
        </div>
      </div>
    </div>
  )
}
