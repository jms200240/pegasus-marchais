import { useEffect, useState } from 'react'
import { X, Check, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { QuizQuestion, QuizAnswer, Pathology, Horse } from '../lib/types'
import { ANSWER_KEYS, shuffle, resourceTypeForCategorie, resolveVaccineDbType, slugify } from '../lib/quizUtils'
import { FichePathologie } from './BoboWizard'
import VaccinFiches from './VaccinFiches'
import FicheCheval from '../pages/FicheCheval'

const SESSION_SIZE = 10

interface QuizPlayProps {
  userId: string
  onFinish: () => void
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <svg className="animate-spin h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    </div>
  )
}

function choiceText(q: QuizQuestion, key: QuizAnswer): string {
  return { A: q.reponse_a, B: q.reponse_b, C: q.reponse_c, D: q.reponse_d }[key]
}

export default function QuizPlay({ userId, onFinish }: QuizPlayProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [horses, setHorses] = useState<Horse[]>([])
  const [loading, setLoading] = useState(true)
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<QuizAnswer | null>(null)
  const [validated, setValidated] = useState(false)
  const [finished, setFinished] = useState(false)
  const [sessionScore, setSessionScore] = useState(0)
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [answeredCount, setAnsweredCount] = useState(0)

  // Fiche ressource — ouverte au clic sur "Voir la fiche" après validation
  const [pathologyOpen, setPathologyOpen] = useState<Pathology | null>(null)
  const [vaccinFichesOpen, setVaccinFichesOpen] = useState(false)
  const [ficheChevalHorseId, setFicheChevalHorseId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: qData }, { data: hData }] = await Promise.all([
        supabase.from('quiz_questions').select('*').eq('is_active', true),
        supabase.from('horses').select('*'),
      ])
      setQuestions(shuffle((qData as QuizQuestion[]) ?? []).slice(0, SESSION_SIZE))
      setHorses((hData as Horse[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const current = questions[index]
  const isLast = index === questions.length - 1

  async function handleValidate() {
    if (!selected || !current) return
    const isCorrect = selected === current.bonne_reponse
    const pointsEarned = isCorrect ? current.points : 0
    setValidated(true)
    setSessionScore(s => s + pointsEarned)
    setAnsweredCount(c => c + 1)
    if (isCorrect) setSessionCorrect(c => c + 1)
    await supabase.from('quiz_attempts').insert({
      user_id: userId,
      question_id: current.id,
      chosen_reponse: selected,
      is_correct: isCorrect,
      points_earned: pointsEarned,
    })
  }

  function handleNext() {
    setSelected(null)
    setValidated(false)
    setIndex(i => i + 1)
  }

  function resourceType() {
    return current ? resourceTypeForCategorie(current.categorie) : null
  }

  function hasResource(): boolean {
    if (!current?.source_id) return false
    const type = resourceType()
    if (type === 'vaccin') return resolveVaccineDbType(current.source_id) !== null
    if (type === 'cheval') return horses.some(h => slugify(h.name) === slugify(current.source_id!))
    return type === 'pathologie'
  }

  async function openResource() {
    if (!current?.source_id) return
    const type = resourceType()
    if (type === 'pathologie') {
      const { data } = await supabase.from('pathologies').select('*').eq('id', current.source_id).single()
      if (data) setPathologyOpen(data as Pathology)
    } else if (type === 'vaccin') {
      if (resolveVaccineDbType(current.source_id)) setVaccinFichesOpen(true)
    } else if (type === 'cheval') {
      const horse = horses.find(h => slugify(h.name) === slugify(current.source_id!))
      if (horse) setFicheChevalHorseId(horse.id)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col">
        <Spinner />
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 text-center">
        <p className="text-sm text-gray-500">Aucune question disponible pour l'instant.</p>
        <button
          type="button"
          onClick={onFinish}
          className="text-primary font-bold text-sm cursor-pointer"
        >
          Retour
        </button>
      </div>
    )
  }

  if (finished || !current) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 text-center">
        <p className="text-2xl font-black text-gray-900">Partie terminée !</p>
        <div className="bg-white rounded-2xl shadow-xs p-6 w-full max-w-xs">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Score</p>
          <p className="text-3xl font-black" style={{ color: '#2f6b3f' }}>
            {sessionScore} pt{sessionScore > 1 ? 's' : ''}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            {sessionCorrect}/{answeredCount} bonne{sessionCorrect > 1 ? 's' : ''} réponse{sessionCorrect > 1 ? 's' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onFinish}
          className="w-full max-w-xs font-bold text-sm py-3.5 rounded-xl text-white shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
          style={{ backgroundColor: '#2f6b3f' }}
        >
          Retour au menu
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between flex-shrink-0">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          Question {index + 1}/{questions.length}
        </p>
        <button type="button" onClick={onFinish} className="text-gray-400 cursor-pointer hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-4 space-y-4">
        <div className="bg-white rounded-2xl shadow-xs p-5">
          <span
            className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-2"
            style={
              current.niveau === 'Facile'
                ? { backgroundColor: '#f0fbf4', color: '#2f6b3f' }
                : { backgroundColor: '#fff7ed', color: '#c2611d' }
            }
          >
            {current.niveau} · {current.points} pt{current.points > 1 ? 's' : ''}
          </span>
          <p className="text-base font-bold text-gray-900">{current.question}</p>
        </div>

        <div className="space-y-2">
          {ANSWER_KEYS.map(key => {
            const isSelected = selected === key
            const isCorrectAnswer = key === current.bonne_reponse
            let border = '#e5e7eb'
            let bg = 'white'
            let text = '#374151'
            if (validated && isCorrectAnswer) {
              border = '#2f6b3f'; bg = '#f0fbf4'; text = '#2f6b3f'
            } else if (validated && isSelected) {
              border = '#dc2626'; bg = '#fef2f2'; text = '#dc2626'
            } else if (!validated && isSelected) {
              border = '#2f6b3f'; bg = '#f0fbf4'; text = '#2f6b3f'
            }
            return (
              <button
                key={key}
                type="button"
                disabled={validated}
                onClick={() => setSelected(key)}
                className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-xl border-2 transition-all cursor-pointer disabled:cursor-default"
                style={{ borderColor: border, backgroundColor: bg, color: text }}
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 text-white"
                  style={{ backgroundColor: text === '#374151' ? '#9ca3af' : text }}
                >
                  {key}
                </span>
                <span className="text-sm font-semibold flex-1">{choiceText(current, key)}</span>
                {validated && isCorrectAnswer && <Check className="w-4 h-4 flex-shrink-0" />}
              </button>
            )
          })}
        </div>

        {validated && hasResource() && (
          <button
            type="button"
            onClick={openResource}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-bold underline underline-offset-2 cursor-pointer"
            style={{ color: '#2f6b3f' }}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Voir la fiche
          </button>
        )}
      </div>

      <div
        className="px-5 pt-3 flex-shrink-0 border-t border-gray-200/60 bg-white/70 backdrop-blur-sm"
        style={{ paddingBottom: 'calc(1rem + 64px + env(safe-area-inset-bottom))' }}
      >
        {!validated ? (
          <button
            type="button"
            onClick={handleValidate}
            disabled={!selected}
            className="w-full font-bold text-sm py-3.5 rounded-xl text-white shadow-sm active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-40"
            style={{ backgroundColor: '#2f6b3f' }}
          >
            Valider
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFinished(true)}
              className="flex-1 font-bold text-sm py-3.5 rounded-xl cursor-pointer transition-all active:scale-[0.98]"
              style={{ backgroundColor: '#f3f4f6', color: '#4b5563' }}
            >
              Terminer
            </button>
            {!isLast && (
              <button
                type="button"
                onClick={handleNext}
                className="flex-1 font-bold text-sm py-3.5 rounded-xl text-white shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
                style={{ backgroundColor: '#2f6b3f' }}
              >
                Question suivante
              </button>
            )}
          </div>
        )}
      </div>

      {pathologyOpen && <FichePathologie pathology={pathologyOpen} onClose={() => setPathologyOpen(null)} />}
      {vaccinFichesOpen && <VaccinFiches onClose={() => setVaccinFichesOpen(false)} />}
      {ficheChevalHorseId && (
        <div className="fixed inset-0 z-[80] bg-[#F6F2EC] flex flex-col">
          <FicheCheval
            horseId={ficheChevalHorseId}
            onBack={() => setFicheChevalHorseId(null)}
            onSelectHorse={id => setFicheChevalHorseId(id)}
          />
        </div>
      )}
    </div>
  )
}
