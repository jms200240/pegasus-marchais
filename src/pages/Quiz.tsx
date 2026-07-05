import { useEffect, useState } from 'react'
import { Play } from 'lucide-react'
import { supabase } from '../lib/supabase'
import QuizPodium from '../components/QuizPodium'
import QuizPlay from '../components/QuizPlay'

interface QuizProps {
  userId: string
}

interface LeaderboardEntry {
  userId: string
  name: string
  points: number
  attempts: number
  correct: number
  accuracy: number // 0-100
}

// Nombre minimum de réponses pour apparaître au classement "taux de bonnes
// réponses" — évite qu'une seule bonne réponse (100%) écrase le classement.
const MIN_ATTEMPTS_FOR_ACCURACY = 5

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <svg className="animate-spin h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    </div>
  )
}

export default function Quiz({ userId }: QuizProps) {
  const [view, setView] = useState<'menu' | 'jouer'>('menu')
  const [loading, setLoading] = useState(true)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  async function fetchLeaderboard() {
    setLoading(true)
    const [{ data: attempts }, { data: users }] = await Promise.all([
      supabase.from('quiz_attempts').select('user_id, is_correct, points_earned'),
      supabase.from('users').select('id, name'),
    ])
    const usersById = new Map((users ?? []).map((u: { id: string; name: string }) => [u.id, u.name]))
    const byUser = new Map<string, { points: number; attempts: number; correct: number }>()
    for (const a of (attempts as { user_id: string; is_correct: boolean; points_earned: number }[]) ?? []) {
      const cur = byUser.get(a.user_id) ?? { points: 0, attempts: 0, correct: 0 }
      cur.points += a.points_earned
      cur.attempts += 1
      if (a.is_correct) cur.correct += 1
      byUser.set(a.user_id, cur)
    }
    const entries: LeaderboardEntry[] = Array.from(byUser.entries()).map(([id, v]) => ({
      userId: id,
      name: usersById.get(id) ?? 'Inconnu',
      points: v.points,
      attempts: v.attempts,
      correct: v.correct,
      accuracy: v.attempts > 0 ? Math.round((v.correct / v.attempts) * 100) : 0,
    }))
    setLeaderboard(entries)
    setLoading(false)
  }

  useEffect(() => {
    if (view === 'menu') fetchLeaderboard()
  }, [view])

  if (view === 'jouer') {
    return <QuizPlay userId={userId} onFinish={() => setView('menu')} />
  }

  const byPoints = [...leaderboard].sort((a, b) => b.points - a.points).slice(0, 3)
  const byAccuracy = [...leaderboard]
    .filter(e => e.attempts >= MIN_ATTEMPTS_FOR_ACCURACY)
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 3)

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-5 pt-5 pb-3">
        <h1 className="text-2xl font-bold text-gray-900 leading-tight">Quiz</h1>
        <p className="text-xs text-gray-500 mt-0.5">Teste tes connaissances sur la cavalerie</p>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6 space-y-5">
        <button
          type="button"
          onClick={() => setView('jouer')}
          className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold text-sm py-3.5 rounded-xl shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
        >
          <Play className="w-4 h-4" />
          Jouer
        </button>

        {loading ? (
          <Spinner />
        ) : (
          <>
            <section>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Classement — Points
              </p>
              <QuizPodium
                entries={byPoints}
                valueLabel={e => `${e.points} pt${e.points > 1 ? 's' : ''}`}
                emptyLabel="Aucune partie jouée pour l'instant"
              />
            </section>

            <section>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Classement — Taux de bonnes réponses
              </p>
              <QuizPodium
                entries={byAccuracy}
                valueLabel={e => `${e.accuracy}%`}
                emptyLabel={`Pas assez de parties jouées (minimum ${MIN_ATTEMPTS_FOR_ACCURACY} réponses)`}
              />
            </section>
          </>
        )}
      </div>
    </div>
  )
}
