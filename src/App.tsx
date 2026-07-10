import { useState, useEffect } from 'react'
import { Settings, KeyRound } from 'lucide-react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import BottomNav from './components/BottomNav'
import type { TabType } from './components/BottomNav'
import type { Session } from '@supabase/supabase-js'
import { useUserRole } from './lib/useUserRole'
import { ADMIN_USERS_LAST_SEEN_KEY, newestCreatedAt } from './lib/adminNotifications'
import type { AdminUser } from './lib/types'
import ChangePasswordModal from './components/ChangePasswordModal'

// Pages
import Accueil from './pages/Accueil'
import Soins from './pages/Soins'
import Chevaux from './pages/Chevaux'
import FicheCheval from './pages/FicheCheval'
import Finances from './pages/Finances'
import GaleriePhotos from './pages/GaleriePhotos'
import Quiz from './pages/Quiz'
import AdminSettings from './pages/AdminSettings'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('accueil')
  const role = useUserRole(session)
  // Le groom hérite du mode lecture seule (écriture bobos/soins/photos réservée
  // à Famille/Admin) — seule exception : son propre check-in, géré à part dans Accueil.
  const readOnly = role === 'visiteur' || role === 'groom'
  const isGroom = role === 'groom'
  // Admin a toujours accès à tout ce que Famille a (+ les commandes d'administration)
  const hasFamilyAccess = role === 'famille' || role === 'admin'

  // Navigation "intra-onglet" pour le module Chevaux
  // null = liste, string = id du cheval sélectionné
  const [selectedHorseId, setSelectedHorseId] = useState<string | null>(null)

  // Panneau Administration — ouvert depuis la roue crantée de l'en-tête (rôle admin uniquement)
  const [adminOpen, setAdminOpen] = useState(false)

  // Pastille de notification — nouveau compte créé depuis la dernière consultation de "Gestion des accès"
  const [hasNewUser, setHasNewUser] = useState(false)

  // Modale "Changer mon mot de passe" — accessible à tout utilisateur connecté
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)

  useEffect(() => {
    if (role !== 'admin') return
    supabase.rpc('admin_list_users').then(({ data }) => {
      const list = (data as AdminUser[]) ?? []
      const newest = newestCreatedAt(list)
      if (!newest) return
      const lastSeen = localStorage.getItem(ADMIN_USERS_LAST_SEEN_KEY)
      if (!lastSeen) {
        // Premier passage : on ne signale pas rétroactivement les comptes déjà existants
        localStorage.setItem(ADMIN_USERS_LAST_SEEN_KEY, newest)
        return
      }
      setHasNewUser(newest > lastSeen)
    })
  }, [role])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Quand on change d'onglet, on réinitialise la navigation intra-onglet
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    setSelectedHorseId(null)
    setAdminOpen(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const renderActivePage = () => {
    switch (activeTab) {
      case 'accueil':
        return <Accueil readOnly={readOnly} isGroom={isGroom} userId={session?.user.id ?? ''} />
      case 'soins':
        return <Soins readOnly={readOnly} />
      case 'chevaux':
        // Routing intra-onglet : liste ou fiche
        if (selectedHorseId) {
          return (
            <FicheCheval
              horseId={selectedHorseId}
              onBack={() => setSelectedHorseId(null)}
              onSelectHorse={(id) => setSelectedHorseId(id)}
            />
          )
        }
        return <Chevaux onSelectHorse={(id) => setSelectedHorseId(id)} />
      case 'galerie':
        return <GaleriePhotos readOnly={readOnly} />
      case 'quiz':
        return <Quiz userId={session?.user.id ?? ''} />
      case 'finances':
        return hasFamilyAccess ? <Finances /> : <Accueil readOnly={readOnly} />
      default:
        return <Accueil readOnly={readOnly} />
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
          <span className="text-sm text-gray-500 font-medium">Chargement...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mobile-container min-h-screen flex flex-col">
      {!session ? (
        <Login
          onLoginSuccess={() =>
            supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
          }
        />
      ) : (
        <>
          {/* Header — visible uniquement sur l'Accueil, retiré des autres pages pour gagner de la place */}
          {activeTab === 'accueil' && (
            <header className="flex justify-between items-center p-4 bg-white border-b border-gray-100/80 shadow-[0_2px_8px_rgba(0,0,0,0.01)] flex-shrink-0">
              <div>
                <h1 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-primary rounded-full inline-block"></span>
                  Pegasus
                </h1>
                <p className="text-[10px] text-gray-400 font-medium truncate max-w-[180px]">
                  {session.user.email}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {role === 'admin' && (
                  <button
                    onClick={() => { setAdminOpen(true); setHasNewUser(false) }}
                    aria-label="Administration"
                    className="relative w-7 h-7 flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-700 rounded-lg transition-colors cursor-pointer border border-gray-200/50"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    {hasNewUser && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
                    )}
                  </button>
                )}
                <button
                  onClick={() => setChangePasswordOpen(true)}
                  aria-label="Changer mon mot de passe"
                  className="w-7 h-7 flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-700 rounded-lg transition-colors cursor-pointer border border-gray-200/50"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleSignOut}
                  className="px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-700 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer border border-gray-200/50"
                >
                  Quitter
                </button>
              </div>
            </header>
          )}

          {changePasswordOpen && (
            <ChangePasswordModal onClose={() => setChangePasswordOpen(false)} />
          )}

          {/* Contenu principal — padding bas pour ne jamais passer sous la nav flottante */}
          <main className="flex-1 flex flex-col overflow-y-auto no-scrollbar min-h-0 pb-24">
            {adminOpen && role === 'admin' ? (
              <AdminSettings onBack={() => setAdminOpen(false)} />
            ) : (
              renderActivePage()
            )}
          </main>

          {/* Bottom nav — TOUJOURS visible, flottante au-dessus de tous les écrans (y compris les overlays) */}
          <div
            className="fixed bottom-0 left-0 right-0 z-[100] w-full max-w-[390px] mx-auto"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <BottomNav activeTab={activeTab} setActiveTab={handleTabChange} showFinances={hasFamilyAccess} />
          </div>
        </>
      )}
    </div>
  )
}

export default App
