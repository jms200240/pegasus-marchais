export default function Soins() {
  return (
    <div className="flex-1 p-6 flex flex-col">
      <h1 className="text-2xl font-bold text-gray-900 mb-1 font-sans">Soins</h1>
      <p className="text-xs text-gray-500">Carnet de soins & Bobos</p>
      
      <div className="mt-6 flex-1 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center p-6 text-center text-gray-400 bg-white/50">
        <div>
          <div className="w-12 h-12 rounded-full bg-primary/5 text-primary flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider block text-gray-700">Module Soins / Bobos</span>
          <span className="text-xs text-gray-400 block mt-1">Suivi médical des chevaux à venir.</span>
        </div>
      </div>
    </div>
  )
}
