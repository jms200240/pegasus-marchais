export default function Finances() {
  return (
    <div className="flex-1 p-6 flex flex-col">
      <h1 className="text-2xl font-bold text-gray-900 mb-1 font-sans">Finances</h1>
      <p className="text-xs text-gray-500">Suivi des comptes & factures</p>
      
      <div className="mt-6 flex-1 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center p-6 text-center text-gray-400 bg-white/50">
        <div>
          <div className="w-12 h-12 rounded-full bg-primary/5 text-primary flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider block text-gray-700">Module Finances</span>
          <span className="text-xs text-gray-400 block mt-1">Gestion des dépenses TTC et facturation à venir.</span>
        </div>
      </div>
    </div>
  )
}
