import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import BottomNav from './components/BottomNav'
import type { TabType } from './components/BottomNav'
import type { Session } from '@supabase/supabase-js'

// Importation des pages
import Accueil from './pages/Accueil'
import Soins from './pages/Soins'
import Chevaux from './pages/Chevaux'
import Finances from './pages/Finances'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('accueil')

  useEffect(() => {
    // Récupérer la session active au chargement
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Écouter les changements d'état d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const renderActivePage = () => {
    switch (activeTab) {
      case 'accueil':
        return <Accueil />
      case 'soins':
        return <Soins />
      case 'chevaux':
        return <Chevaux />
      case 'finances':
        return <Finances />
      default:
        return <Accueil />
    }
  }

  if (loading) {
    return (
      <div className="mobile-container flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm text-gray-500 font-medium">Chargement de la session...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mobile-container min-h-screen flex flex-col justify-between">
      {!session ? (
        <Login onLoginSuccess={() => supabase.auth.getSession().then(({ data: { session } }) => setSession(session))} />
      ) : (
        <>
          {/* Header de l'application */}
          <header className="flex justify-between items-center p-4 bg-white border-b border-gray-100/80 shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
            <div>
              <h1 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-1.5 font-sans">
                <span className="w-2.5 h-2.5 bg-primary rounded-full inline-block"></span>
                Pegasus
              </h1>
              <p className="text-[10px] text-gray-400 font-medium truncate max-w-[180px]">{session.user.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-700 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer border border-gray-200/50"
            >
              Quitter
            </button>
          </header>

          {/* Pages */}
          <main className="flex-1 flex flex-col overflow-y-auto no-scrollbar">
            {renderActivePage()}
          </main>

          {/* Bottom Navigation */}
          <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
        </>
      )}
    </div>
  )
}

export default App
