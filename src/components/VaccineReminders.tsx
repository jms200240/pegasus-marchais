import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ChevronDown, ChevronUp, Syringe, X, CheckCircle2 } from 'lucide-react'
import type { Horse, Vaccination } from '../lib/types'
import { VACCINES, computeStatus, type VaccineKey, type VaccineStatus } from '../lib/vaccineUtils'
import VaccinFiches from './VaccinFiches'

type VaccinationRow = Pick<Vaccination, 'id' | 'horse_id' | 'injection_date' | 'vaccine_type'> & {
  next_reminder_override?: string | null
}

interface ExclusionRow {
  horse_id: string
  vaccine: VaccineKey
}

type Status = VaccineStatus

interface HorseStatus {
  horse: Horse
  status: Status
  lastInjection: string | null
  nextDue: string | null
  daysLeft: number | null
  lastRowId: string | null
}

interface ReminderGroup {
  date: string
  vaccineLabels: string[]
  horseNames: string[]
  allActive: boolean
  rowIds: string[]
}

const STATUS_STYLE: Record<Status, { label: string; bg: string; text: string }> = {
  a_jour: { label: 'À jour', bg: 'bg-green-50', text: 'text-green-700' },
  a_prevoir: { label: 'À prévoir', bg: 'bg-amber-50', text: 'text-amber-700' },
  en_retard: { label: 'En retard', bg: 'bg-red-50', text: 'text-red-700' },
  primo_a_refaire: { label: 'Primo à refaire', bg: 'bg-red-100', text: 'text-red-800' },
  non_suivi: { label: 'Non suivi', bg: 'bg-gray-100', text: 'text-gray-500' },
}

// Jointure "française" d'une liste : "A", "A et B", "A, B et C"
function joinFr(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`
}

export default function VaccineReminders({ readOnly = false }: { readOnly?: boolean }) {
  const [horses, setHorses] = useState<Horse[]>([])
  const [vaccinations, setVaccinations] = useState<VaccinationRow[]>([])
  const [exclusions, setExclusions] = useState<ExclusionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<VaccineKey | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<{ horse: Horse; vaccine: VaccineKey } | null>(null)
  const [fichesOpen, setFichesOpen] = useState(false)

  // ── Édition de la date d'un groupe "Prochains vaccins" ────────────────────
  const [pendingEdit, setPendingEdit] = useState<{ rowIds: string[]; date: string; label: string } | null>(null)
  const [savingOverride, setSavingOverride] = useState(false)

  async function fetchData() {
    setLoading(true)
    const [{ data: horsesData, error: horsesErr }, { data: vaccData, error: vaccErr }, { data: exclData, error: exclErr }] = await Promise.all([
      supabase.from('horses').select('*').eq('is_active', true),
      supabase.from('vaccinations').select('id, horse_id, injection_date, vaccine_type, next_reminder_override'),
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
        const lastRow = rows.length > 0
          ? rows.reduce((max, r) => (r.injection_date > max.injection_date ? r : max), rows[0])
          : null
        const lastInjection = lastRow?.injection_date ?? null
        const { status, nextDue, daysLeft } = computeStatus(
          lastInjection,
          vaccine.cadence,
          vaccine.alertWindow,
          vaccine.tolerance,
          lastRow?.next_reminder_override ?? null
        )
        return { horse: h, status, lastInjection, nextDue, daysLeft, lastRowId: lastRow?.id ?? null }
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

  async function handleConfirmDateEdit() {
    if (!pendingEdit) return
    setSavingOverride(true)
    try {
      const { error } = await supabase
        .from('vaccinations')
        .update({ next_reminder_override: pendingEdit.date })
        .in('id', pendingEdit.rowIds)
      if (error) throw error
      setPendingEdit(null)
      await fetchData()
    } catch (err) {
      console.error('Erreur mise à jour du rappel:', err)
    } finally {
      setSavingOverride(false)
    }
  }

  // ── Précalcul par vaccin, pour savoir si tout est à jour ──
  const perVaccine = VACCINES.map(vaccine => {
    const statuses = getHorseStatuses(vaccine)
    const concerned = statuses.filter(s => s.status !== 'a_jour' && s.status !== 'non_suivi')
    return { vaccine, statuses, concerned }
  })
  const totalConcerned = perVaccine.reduce((sum, v) => sum + v.concerned.length, 0)

  // ── Date de la dernière injection connue, par vaccin (toutes cavalerie confondue) ──
  const lastInjectionDates = VACCINES
    .map(vaccine => {
      const rows = vaccinations.filter(v => v.vaccine_type === vaccine.dbType)
      if (rows.length === 0) return null
      const last = rows.reduce((max, r) => (r.injection_date > max ? r.injection_date : max), rows[0].injection_date)
      return { label: vaccine.label, last }
    })
    .filter((d): d is { label: string; last: string } => !!d)
    .sort((a, b) => b.last.localeCompare(a.last))

  // ── Groupes "Prochains vaccins", triés par échéance croissante ────────────
  // (toutes les échéances connues, pas seulement celles proches — l'urgence
  // reste visible via l'accordéon par statut ci-dessous)
  const groupMap = new Map<string, { vaccineKeys: Set<VaccineKey>; horseNames: Set<string>; rowIds: Set<string> }>()
  for (const { vaccine, statuses } of perVaccine) {
    for (const s of statuses) {
      if (!s.nextDue) continue
      if (!groupMap.has(s.nextDue)) groupMap.set(s.nextDue, { vaccineKeys: new Set(), horseNames: new Set(), rowIds: new Set() })
      const g = groupMap.get(s.nextDue)!
      g.vaccineKeys.add(vaccine.key)
      g.horseNames.add(s.horse.name)
      if (s.lastRowId) g.rowIds.add(s.lastRowId)
    }
  }
  const reminderGroups: ReminderGroup[] = [...groupMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, g]) => ({
      date,
      vaccineLabels: VACCINES.filter(v => g.vaccineKeys.has(v.key)).map(v => v.label),
      horseNames: [...g.horseNames],
      allActive: g.horseNames.size === horses.length,
      rowIds: [...g.rowIds],
    }))

  if (loading) return null

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Syringe className="w-4 h-4 text-gray-500" />
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Rappels vaccins</span>
        </div>
        <button
          type="button"
          onClick={() => setFichesOpen(true)}
          className="text-[10px] text-gray-400 underline underline-offset-2 cursor-pointer hover:text-gray-600 transition-colors"
        >
          Voir les fiches Vaccins
        </button>
      </div>

      {/* ── Prochains vaccins, détaillé, triés par échéance croissante ── */}
      {reminderGroups.length > 0 && (
        <div className="space-y-2 mb-3">
          {reminderGroups.map(group => (
            <div key={group.date} className="bg-white rounded-xl shadow-xs px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{joinFr(group.vaccineLabels)}</p>
                  <p className="text-[11px] text-gray-400 truncate">
                    {group.allActive ? 'Tous' : group.horseNames.join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[11px] text-gray-500">avant le</span>
                  <input
                    type="date"
                    value={group.date}
                    disabled={readOnly}
                    onChange={e =>
                      setPendingEdit({
                        rowIds: group.rowIds,
                        date: e.target.value,
                        label: `${joinFr(group.vaccineLabels)} — ${group.allActive ? 'Tous' : group.horseNames.join(', ')}`,
                      })
                    }
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700 disabled:opacity-60 disabled:bg-gray-50"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalConcerned === 0 ? (
        <div className="bg-white rounded-xl shadow-xs overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#2f6b3f' }} />
            <span className="text-sm font-semibold text-gray-700">Vaccins à jour</span>
          </div>
          {lastInjectionDates.length > 0 && (
            <div className="border-t border-gray-100 divide-y divide-gray-50">
              {lastInjectionDates.map(d => (
                <div key={d.label} className="flex items-center justify-between px-4 py-2">
                  <span className="text-xs text-gray-500">{d.label}</span>
                  <span className="text-xs font-semibold text-gray-700">
                    {new Date(d.last + 'T00:00:00').toLocaleDateString('fr-FR')}
                  </span>
                </div>
              ))}
            </div>
          )}
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
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => setConfirmTarget({ horse: s.horse, vaccine: vaccine.key })}
                            className="text-[10px] font-bold text-gray-400 hover:text-red-600 uppercase tracking-wide cursor-pointer"
                          >
                            Annuler le rappel
                          </button>
                        )}
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

      {/* ── Popup confirmation nouvelle date de rappel ── */}
      {pendingEdit && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-6">
          <div className="bg-white rounded-xl p-5 w-full max-w-xs">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-900">Date validée avec le vétérinaire ?</p>
              <button onClick={() => setPendingEdit(null)} className="cursor-pointer">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              <span className="font-semibold">{pendingEdit.label}</span> — nouvelle échéance :{' '}
              <span className="font-semibold">
                {new Date(pendingEdit.date + 'T00:00:00').toLocaleDateString('fr-FR')}
              </span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPendingEdit(null)}
                disabled={savingOverride}
                className="flex-1 py-2 rounded-lg text-xs font-bold text-gray-500 bg-gray-50 cursor-pointer disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmDateEdit}
                disabled={savingOverride}
                className="flex-1 py-2 rounded-lg text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: '#2f6b3f' }}
              >
                {savingOverride ? 'Enregistrement…' : 'Valider'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Fiches Vaccins ── */}
      {fichesOpen && <VaccinFiches onClose={() => setFichesOpen(false)} />}
    </section>
  )
}
