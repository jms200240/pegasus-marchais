// ─── Domaine vaccins — cadences partagées entre VaccinSheet, VaccineReminders
// et le résumé "Prochains vaccins" de Soins.tsx. Cf. Fiches Vaccins pour le
// détail des protocoles (IFCE) qui ont fixé ces valeurs.
export type VaccineKey = 'Grippe' | 'Tetanos' | 'Rhino' | 'Rage'
export type VaccineDbType = 'grippe' | 'tetanos' | 'rhino' | 'rage'

export interface VaccineDef {
  key: VaccineKey
  label: string
  dbType: VaccineDbType
  cadence: number      // jours entre deux rappels
  alertWindow: number  // jours avant échéance déclenchant "à prévoir"
  tolerance: number    // jours de retard tolérés avant "primo à refaire"
}

export const VACCINES: VaccineDef[] = [
  { key: 'Grippe', label: 'Grippe', dbType: 'grippe', cadence: 365, alertWindow: 60, tolerance: 180 },
  { key: 'Tetanos', label: 'Tétanos', dbType: 'tetanos', cadence: 365, alertWindow: 60, tolerance: 180 },
  { key: 'Rhino', label: 'Rhinopneumonie', dbType: 'rhino', cadence: 180, alertWindow: 30, tolerance: 180 },
  { key: 'Rage', label: 'Rage', dbType: 'rage', cadence: 365, alertWindow: 60, tolerance: 180 },
]

export function vaccineByDbType(dbType: VaccineDbType): VaccineDef | undefined {
  return VACCINES.find(v => v.dbType === dbType)
}

export type VaccineStatus = 'a_jour' | 'a_prevoir' | 'en_retard' | 'primo_a_refaire' | 'non_suivi'

// yyyy-mm-dd + N jours → yyyy-mm-dd (arithmétique locale, pas de décalage UTC)
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function computeNextDueDate(injectionDate: string, cadenceDays: number): string {
  return addDaysYmd(injectionDate, cadenceDays)
}

// Résumé "prochain vaccin" affiché en tête de la page Soins — la date la
// plus proche parmi tous les rappels suivis (hors "non suivi"), et les
// chevaux concernés par cette échéance précise.
export interface VaccineSummary {
  date: string
  horseNames: string[]
  allActive: boolean
}

export function computeStatus(
  lastInjection: string | null,
  cadence: number,
  alertWindow: number,
  tolerance: number,
  overrideNextDue?: string | null
): { status: VaccineStatus; nextDue: string | null; daysLeft: number | null } {
  if (!lastInjection) {
    return { status: 'non_suivi', nextDue: null, daysLeft: null }
  }
  const due = overrideNextDue ? new Date(overrideNextDue) : new Date(computeNextDueDate(lastInjection, cadence))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const daysLeft = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  let status: VaccineStatus
  if (daysLeft > alertWindow) status = 'a_jour'
  else if (daysLeft >= 0) status = 'a_prevoir'
  else if (Math.abs(daysLeft) <= tolerance) status = 'en_retard'
  else status = 'primo_a_refaire'

  return { status, nextDue: due.toISOString().slice(0, 10), daysLeft }
}
