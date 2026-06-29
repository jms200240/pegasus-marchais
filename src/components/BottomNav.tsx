import { Home, Heart, DollarSign } from 'lucide-react'

// Custom horse icon matching the Pegasus logo and branding
const HorseIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 20c3-1.5 5.5-3 8-3h4c2.5 0 4-1.5 4-4v-1c0-1.5-1.5-2.5-3-2.5h-1L13 6l-2-2H8c-2 0-3 1.5-3 3v8h-2" />
    <circle cx="11" cy="8" r="1" />
  </svg>
)

export type TabType = 'accueil' | 'soins' | 'chevaux' | 'finances'

interface BottomNavProps {
  activeTab: TabType
  setActiveTab: (tab: TabType) => void
}

export default function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  const tabs = [
    { id: 'accueil' as TabType, label: 'Accueil', icon: Home },
    { id: 'soins' as TabType, label: 'Soins', icon: Heart },
    { id: 'chevaux' as TabType, label: 'Chevaux', icon: HorseIcon },
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
