interface PodiumEntryBase {
  userId: string
  name: string
}

const MEDAL_COLORS = ['#d4af37', '#adb5bd', '#b08d57'] // or / argent / bronze
const HEIGHTS = ['h-20', 'h-14', 'h-10']
const ORDER = [1, 0, 2] // affichage : 2e à gauche, 1er au centre, 3e à droite

export default function QuizPodium<T extends PodiumEntryBase>({
  entries,
  valueLabel,
  emptyLabel,
}: {
  entries: T[]
  valueLabel: (entry: T) => string
  emptyLabel: string
}) {
  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-xl p-5 text-center shadow-xs">
        <p className="text-sm font-semibold text-gray-700">{emptyLabel}</p>
      </div>
    )
  }

  return (
    <div className="flex items-end justify-center gap-2 bg-white rounded-2xl shadow-xs p-5 pt-8">
      {ORDER.map(i => {
        const entry = entries[i]
        if (!entry) return <div key={i} className="flex-1" />
        const rank = i + 1
        const initial = entry.name.charAt(0).toUpperCase()
        const color = MEDAL_COLORS[i]
        return (
          <div key={entry.userId} className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0"
              style={{ backgroundColor: color }}
            >
              {initial}
            </div>
            <p className="text-xs font-bold text-gray-800 truncate max-w-full">{entry.name}</p>
            <p className="text-[11px] font-semibold text-gray-500">{valueLabel(entry)}</p>
            <div
              className={`w-full ${HEIGHTS[i]} rounded-t-lg flex items-start justify-center pt-1`}
              style={{ backgroundColor: color }}
            >
              <span className="text-white font-black text-lg">{rank}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
