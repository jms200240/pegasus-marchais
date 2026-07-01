import { Home, Heart, DollarSign, Image } from 'lucide-react'

// Custom horseshoe icon matching the Pegasus logo and branding
const HorseIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M7 3v9a5 5 0 0 0 10 0V3" />
  </svg>
)

export type TabType = 'accueil' | 'soins' | 'chevaux' | 'galerie' | 'finances'

interface BottomNavProps {
  activeTab: TabType
  setActiveTab: (tab: TabType) => void
}

export default function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  const tabs = [
    { id: 'accueil' as TabType, label: 'Accueil', icon: Home },
    { id: 'soins' as TabType, label: 'Soins', icon: Heart },
    { id: 'chevaux' as TabType, label: 'Chevaux', icon: HorseIcon },
    { id: 'galerie' as TabType, label: 'Galerie', icon: Image },
    { id: 'finances' as TabType, label: 'Finances', icon: DollarSign },
  ]

  return (
    <nav className="w-full bg-white border-t border-gray-100/80 flex items-center justify-around py-2 px-1 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] z-50">
      {tabs.map((tab) => {
        const IconComponent = tab.icon
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all relative cursor-pointer ${
              isActive ? 'text-primary scale-105' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <IconComponent className="w-5 h-5 mb-0.5 stroke-[2.25]" />
            <span className="text-[9px] font-bold tracking-wider uppercase">
              {tab.label}
            </span>
            {isActive && (
              <span className="absolute bottom-0 w-8 h-0.75 bg-primary rounded-full" />
            )}
          </button>
        )
      })}
    </nav>
  )
}
