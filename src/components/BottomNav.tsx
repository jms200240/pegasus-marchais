import { Home, Stethoscope, DollarSign, Image } from 'lucide-react'

// Horse head icon — traced from Pegasus reference logo (skeletonized + simplified)
const HorseIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M 13.58 3.67 L 12.35 3.8 L 10.68 4.32 L 9.33 4.96 L 7.72 6.18 L 5.79 8.5 L 4.64 11.26 L 4.38 12.87 L 4.7 15.44 L 5.28 16.73 L 6.24 18.08 L 7.53 19.36 L 9.07 20.46 L 10.81 21.29 L 12.74 21.74" />
    <path d="M 14.73 10.49 L 14.41 10.55 L 13.64 11.45 L 13.32 13.19 L 13.7 14.99 L 15.25 17.69 L 15.63 18.85 L 15.7 20.26 L 15.38 22.0" />
    <path d="M 14.86 10.49 L 16.28 11.84 L 17.24 12.42 L 18.14 12.68" />
    <path d="M 18.33 12.74 L 18.4 13.19 L 18.85 13.83 L 19.88 14.15 L 21.23 13.51 L 21.49 13.0 L 21.55 12.03 L 21.23 11.07 L 20.59 10.17 L 19.62 7.59 L 18.01 4.89 L 17.82 3.86 L 17.88 2.06" />
    <path d="M 15.44 3.61 L 16.21 2.58 L 17.05 2.13 L 17.82 2.0" />
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
    { id: 'soins' as TabType, label: 'Soins', icon: Stethoscope },
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
