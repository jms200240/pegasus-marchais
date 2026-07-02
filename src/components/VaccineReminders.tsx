import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ChevronDown, ChevronUp, Syringe, X, CheckCircle2 } from 'lucide-react'
import type { Horse } from '../lib/types'

type VaccineKey = 'Grippe' | 'Tetanos' | 'Rhino' | 'Rage'
type VaccineDbType = 'grippe' | 'tetanos' | 'rhino' | 'rage'

interface VaccinationRow {
  horse_id: string
  injection_date: string
  vaccine_type: VaccineDbType
}

interface ExclusionRow {
  horse_id: string
  vaccine: VaccineKey
}

type Status = 'a_jour' | 'a_prevoir' | 'en_retard' | 'primo_a_refaire' | 'non_suivi'

interface HorseStatus {
  horse: Horse
  status: Status
  lastInjection: string | null
  nextDue: string | null
  daysLeft: number | null
}

const VACCINES: { key: VaccineKey; label: string; dbType: VaccineDbType; cadence: number; alertWindow: number; tolerance: number }[] = [
  { key: 'Grippe', label: 'Grippe', dbType: 'grippe', cadence: 365, alertWindow: 60, tolerance: 180 },
  { key: 'Tetanos', label: 'Tétanos', dbType: 'tetanos', cadence: 365, alertWindow: 60, tolerance: 180 },
  { key: 'Rhino', label: 'Rhinopneumonie', dbType: 'rhino', cadence: 180, alertWindow: 30, tolerance: 180 },
  { key: 'Rage', label: 'Rage', dbType: 'rage', cadence: 365, alertWindow: 60, tolerance: 180 },
]

const STATUS_STYLE: Record<Status, { label: string; bg: string; text: string }> = {
  a_jour: { label: 'À jour', bg: 'bg-green-50', text: 'text-green-700' },
  a_prevoir: { label: 'À prévoir', bg: 'bg-amber-50', text: 'text-amber-700' },
  en_retard: { label: 'En retard', bg: 'bg-red-50', text: 'text-red-700' },
  primo_a_refaire: { label: 'Primo à refaire', bg: 'bg-red-100', text: 'text-red-800' },
  non_suivi: { label: 'Non suivi', bg: 'bg-gray-100', text: 'text-gray-500' },
}

function computeStatus(lastInjection: string | null, cadence: number, alertWindow: number, tolerance: number) {
  if (!lastInjection) {
    return { status: 'non_suivi' as Status, nextDue: null, daysLeft: null }
  }
  const last = new Date(lastInjection)
  const due = new Date(last)
  due.setDate(due.getDate() + cadence)
  const today = new Date()
  const daysLeft = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  let status: Status
  if (daysLeft > alertWindow) status = 'a_jour'
  else if (daysLeft >= 0) status = 'a_prevoir'
  else if (Math.abs(daysLeft) <= tolerance) status = 'en_retard'
  else status = 'primo_a_refaire'

  return { status, nextDue: due.toISOString().slice(0, 10), daysLeft }
}

export default function VaccineReminders() {
  const [horses, setHorses] = useState<Horse[]>([])
  const [vaccinations, setVaccinations] = useState<VaccinationRow[]>([])
  const [exclusions, setExclusions] = useState<ExclusionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<VaccineKey | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<{ horse: Horse; vaccine: VaccineKey } | null>(null)

  async function fetchData() {
    setLoading(true)
    const [{ data: horsesData, error: horsesErr }, { data: vaccData, error: vaccErr }, { data: exclData, error: exclErr }] = await Promise.all([
      supabase.from('horses').select('*').eq('is_active', true),
      supabase.from('vaccinations').select('horse_id, injection_date, vaccine_type'),
      supabase.from('vaccine_exclusions').select('horse_id, vaccine').eq('excluded', true),
    ])
    if (horsesErr) console.error('Erreur chargement chevaux (vaccins):', horsesErr)
    if (vaccErr) console.error('Erreur chargement vaccinations:', vaccErr)
    if (exclErr) console.error('Erreur chargement exclusions vaccins:', exclErr)
    setHorses((horsesData as Horse[]) ?? [])
    setVaccinations((vaccData as VaccinationRow[]) ?? [])
    setExclusions((exclData as ExclusionRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  function isExcluded(horseId: string, vaccine: VaccineKey) {
    return exclusions.some(e => e.horse_id === horseId && e.vaccine === vaccine)
  }

  function getHorseStatuses(vaccine: (typeof VACCINES)[number]): HorseStatus[] {
    return horses
      .filter(h => !isExcluded(h.id, vaccine.key))
      .map(h => {
        const rows = vaccinations.filter(v => v.horse_id === h.id && v.vaccine_type === vaccine.dbType)
        const lastInjection = rows.length > 0
          ? rows.reduce((max, r) => (r.injection_date > max ? r.injection_date : max), rows[0].injection_date)
          : null
        const { status, nextDue, daysLeft } = computeStatus(lastInjection, vaccine.cadence, vaccine.alertWindow, vaccine.tolerance)
        return { horse: h, status, lastInjection, nextDue, daysLeft }
      })
  }

  async function handleConfirmExclusion() {
    if (!confirmTarget) return
    await supabase.from('vaccine_exclusions').upsert(
      { horse_id: confirmTarget.horse.id, vaccine: confirmTarget.vaccine, excluded: true },
      { onConflict: 'horse_id,vaccine' }
    )
    setConfirmTarget(null)
    fetchData()
  }

  if (loading) return null

  // ── Précalcul par vaccin, pour savoir si tout est à jour ──
  const perVaccine = VACCINES.map(vaccine => {
    const statuses = getHorseStatuses(vaccine)
    const concerned = statuses.filter(s => s.status !== 'a_jour' && s.status !== 'non_suivi')
    return { vaccine, statuses, concerned }
  })
  const totalConcerned = perVaccine.reduce((sum, v) => sum + v.concerned.length, 0)

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Syringe className="w-4 h-4 text-gray-500" />
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Rappels vaccins</span>
        </div>
        <button
          type="button"
          className="text-[10px] text-gray-400 underline underline-offset-2 cursor-not-allowed"
          title="Fiches vaccins — bientôt disponible"
        >
          Voir les fiches Vaccins
        </button>
      </div>

      {totalConcerned === 0 ? (
        <div className="flex items-center gap-2.5 bg-white rounded-xl px-4 py-3 shadow-xs">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#2f6b3f' }} />
          <span className="text-sm font-semibold text-gray-700">Vaccins à jour</span>
        </div>
      ) : (
        <div className="space-y-2">
          {perVaccine.map(({ vaccine, concerned }) => {
            if (concerned.length === 0) return null

            const worst = concerned.some(s => s.status === 'primo_a_refaire')
              ? 'primo_a_refaire'
              : concerned.some(s => s.status === 'en_retard')
              ? 'en_retard'
              : 'a_prevoir'

            const earliestDue = concerned
              .map(s => s.nextDue)
              .filter((d): d is string => !!d)
              .sort()[0]

            const isOpen = expanded === vaccine.key
            const allActive = concerned.length === horses.length

            return (
              <div key={vaccine.key} className="bg-white rounded-xl shadow-xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : vaccine.key)}
                  className="w-full flex items-center justify-between px-4 py-3 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[worst].bg} ${STATUS_STYLE[worst].text}`}>
                      {STATUS_STYLE[worst].label}
                    </span>
                    <span className="text-sm font-semibold text-gray-800">{vaccine.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-400">
                      {allActive ? 'Tous les chevaux' : `${concerned.length}/${horses.length} chevaux`}
                      {earliestDue ? ` · éch. ${new Date(earliestDue).toLocaleDateString('fr-FR')}` : ''}
                    </span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {concerned.map(s => (
                      <div key={s.horse.id} className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.horse.color_hex ?? undefined }} />
                          <span className="text-sm text-gray-700">{s.horse.name}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${STATUS_STYLE[s.status].bg} ${STATUS_STYLE[s.status].text}`}>
                            {STATUS_STYLE[s.status].label}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setConfirmTarget({ horse: s.horse, vaccine: vaccine.key })}
                          className="text-[10px] font-bold text-gray-400 hover:text-red-600 uppercase tracking-wide cursor-pointer"
                        >
                          Annuler le rappel
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Popup confirmation annulation ── */}
      {confirmTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-6">
          <div className="bg-white rounded-xl p-5 w-full max-w-xs">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-900">Annuler définitivement ?</p>
              <button onClick={() => setConfirmTarget(null)} className="cursor-pointer">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Le rappel <span className="font-semibold">{confirmTarget.vaccine}</span> ne sera plus proposé pour{' '}
              <span className="font-semibold">{confirmTarget.horse.name}</span>. Cette action est définitive et modifiable uniquement via Supabase.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmTarget(null)}
                className="flex-1 py-2 rounded-lg text-xs font-bold text-gray-500 bg-gray-50 cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmExclusion}
                className="flex-1 py-2 rounded-lg text-xs font-bold text-white bg-red-600 cursor-pointer"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
