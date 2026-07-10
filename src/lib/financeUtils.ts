import type { Horse, GroomVisit } from './types'
import { CANONICAL_ORDER } from './types'

// ─── Domaine intervenant — aligné sur HealthEvent.type pour rester cohérent ──
export type IntervenantType = 'veterinaire' | 'marechal' | 'dentiste' | 'osteo' | 'groom'

export const INTERVENANT_LABELS: Record<IntervenantType, string> = {
  veterinaire: 'Vétérinaire',
  marechal: 'Maréchal-ferrant',
  dentiste: 'Dentiste',
  osteo: 'Ostéopathe',
  groom: 'Groom',
}

export const INTERVENANT_ORDER: IntervenantType[] = ['veterinaire', 'marechal', 'dentiste', 'osteo', 'groom']

export const INTERVENANT_COLORS: Record<IntervenantType, string> = {
  veterinaire: '#2f6b3f',
  marechal: '#8B5E34',
  dentiste: '#4A5FA0',
  osteo: '#7B93D4',
  groom: '#C0392B',
}

// Clé de ventilation spéciale : part d'une ligne hors suivi chevaux (ex. un
// animal non suivi par l'app facturé par erreur sur la même facture). Compte
// dans le total de vérification, mais ne génère jamais de ligne `expenses`.
export const OTHER_KEY = '__autre__'

// ─── Utilitaires date (évite les décalages UTC des champs date-only) ────────
export function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function formatDateOnlyFr(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

// Clé année-mois ("YYYY-MM") extraite d'une date-only — sert à regrouper les
// jours de visite groom par mois calendaire.
export function ymKey(ymd: string): string {
  return ymd.slice(0, 7)
}

export function monthLabelFr(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const label = new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

// "Lundi 06/07" — jour de semaine + date sans année, pour la liste dépliante
// des visites groom.
export function weekdayDateFr(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const wd = new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'long' })
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${pad(d)}/${pad(m)}`
}

// Mois calendaire suivant une clé "YYYY-MM".
function nextYm(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m, 1) // m (1-indexé) devient l'index 0-indexé du mois suivant
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

// Un mois déjà utilisé pour un règlement (paid_month) ne peut pas resservir —
// une visite datée dans un mois déjà soldé (règlement anticipé en cours de
// mois) est reportée sur le mois suivant disponible.
export function effectivePeriodYm(ym: string, usedPeriods: Set<string>): string {
  let period = ym
  while (usedPeriods.has(period)) period = nextYm(period)
  return period
}

export interface UnsettledGroomPeriod {
  ym: string
  days: number
  proposedAmount: number
  visitIds: string[]
  visitDates: string[] // dates distinctes facturables, triées
}

// Regroupe les visites non soldées par période effective (mois calendaire, ou
// reporté si ce mois a déjà fait l'objet d'un règlement). Une 2e visite le
// même jour ne compte ni dans `days` ni dans `proposedAmount` (seule la plus
// ancienne du jour est retenue), mais son id reste dans `visitIds` pour être
// soldée avec le reste de la période.
export function groupUnsettledGroomVisits(visits: GroomVisit[], usedPeriods: Set<string>): UnsettledGroomPeriod[] {
  const byPeriod = new Map<string, GroomVisit[]>()
  visits.forEach(v => {
    const period = effectivePeriodYm(ymKey(v.visit_date), usedPeriods)
    if (!byPeriod.has(period)) byPeriod.set(period, [])
    byPeriod.get(period)!.push(v)
  })

  const result: UnsettledGroomPeriod[] = []
  for (const [ym, rows] of byPeriod.entries()) {
    const byDay = new Map<string, GroomVisit[]>()
    rows.forEach(v => {
      if (!byDay.has(v.visit_date)) byDay.set(v.visit_date, [])
      byDay.get(v.visit_date)!.push(v)
    })
    let proposedAmount = 0
    byDay.forEach(dayRows => {
      const earliest = dayRows.reduce((a, b) => (a.created_at < b.created_at ? a : b))
      proposedAmount = round2(proposedAmount + earliest.amount_ttc)
    })
    result.push({
      ym,
      days: byDay.size,
      proposedAmount,
      visitIds: rows.map(v => v.id),
      visitDates: Array.from(byDay.keys()).sort(),
    })
  }
  return result.sort((a, b) => a.ym.localeCompare(b.ym))
}

export function yearBoundsYmd(): { first: string; last: string; label: string } {
  const now = new Date()
  const y = now.getFullYear()
  return { first: `${y}-01-01`, last: `${y}-12-31`, label: String(y) }
}

export function formatEuro(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ─── Calcul métier ────────────────────────────────────────────────────────
export function sortByCanonicalOrder(horses: Horse[]): Horse[] {
  return [...horses].sort((a, b) => {
    const ia = CANONICAL_ORDER.indexOf(a.name as typeof CANONICAL_ORDER[number])
    const ib = CANONICAL_ORDER.indexOf(b.name as typeof CANONICAL_ORDER[number])
    if (ia === -1 && ib === -1) return a.name.localeCompare(b.name)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}

// Répartition égale entre les éléments — chaque part est simplement arrondie
// à 2 décimales, sans allocation du reliquat d'arrondi à un élément en particulier.
export function equalSplit(ids: string[]): Record<string, number> {
  const n = ids.length
  if (n === 0) return {}
  const share = round2(100 / n)
  const shares: Record<string, number> = {}
  ids.forEach(id => { shares[id] = share })
  return shares
}

// Tolérance d'arrondi absorbée automatiquement (bruit d'arrondi pur, pas un
// problème de ventilation réel). Avec 7 chevaux en répartition égale
// (14.29% × 7 = 100.03%), l'écart monétaire dépasse 5 cts dès qu'une ligne
// dépasse ~167€ — 10 cts couvre ce cas courant.
export const SHARE_ROUNDING_TOLERANCE = 0.10

export interface EffectiveShares {
  shares: Record<string, number> // parts éventuellement corrigées
  adjustedHorseId: string | null // cheval ayant reçu la correction, si applicable
  adjustedCents: number // valeur absolue en centimes, 0 si aucune correction
}

// Calcule la part "idéale" du dernier cheval de la liste (hors "Autre") pour
// que la somme atteigne exactement 100%, et l'applique si l'écart monétaire
// que cela représente pour le TTC de la ligne reste sous SHARE_ROUNDING_TOLERANCE
// (sinon les parts sont laissées telles quelles — écart trop important pour
// être un simple bruit d'arrondi).
export function effectiveShares(rawShares: Record<string, number>, ttc: number): EffectiveShares {
  const horseIds = Object.keys(rawShares).filter(id => id !== OTHER_KEY)
  const lastHorseId = horseIds[horseIds.length - 1]
  if (!lastHorseId || ttc <= 0) {
    return { shares: rawShares, adjustedHorseId: null, adjustedCents: 0 }
  }

  const othersSum = round2(
    Object.keys(rawShares)
      .filter(id => id !== lastHorseId)
      .reduce((s, id) => s + (rawShares[id] || 0), 0)
  )
  const idealLastShare = round2(100 - othersSum)
  const pctDiff = round2(idealLastShare - (rawShares[lastHorseId] || 0))
  if (pctDiff === 0) {
    return { shares: rawShares, adjustedHorseId: null, adjustedCents: 0 }
  }

  const monetaryDiff = round2((ttc * pctDiff) / 100)
  if (Math.abs(monetaryDiff) >= SHARE_ROUNDING_TOLERANCE) {
    return { shares: rawShares, adjustedHorseId: null, adjustedCents: 0 }
  }

  return {
    shares: { ...rawShares, [lastHorseId]: idealLastShare },
    adjustedHorseId: lastHorseId,
    adjustedCents: Math.round(Math.abs(monetaryDiff) * 100),
  }
}

// Ventile un TTC par part — les parts sont d'abord normalisées via
// effectiveShares (correction du dernier cheval si l'écart est un simple bruit
// d'arrondi), puis chaque montant est arrondi indépendamment. Filet de
// sécurité : si un reliquat monétaire subsiste malgré tout (< SHARE_ROUNDING_TOLERANCE),
// il est absorbé sur ce même dernier cheval — jamais sur la part "Autre".
export function splitTtcByShares(ttc: number, rawShares: Record<string, number>): Record<string, number> {
  const { shares } = effectiveShares(rawShares, ttc)
  const result: Record<string, number> = {}
  for (const id of Object.keys(shares)) {
    result[id] = round2((ttc * (shares[id] || 0)) / 100)
  }

  const sum = round2(Object.values(result).reduce((s, v) => s + v, 0))
  const diff = round2(ttc - sum)
  if (Math.abs(diff) < SHARE_ROUNDING_TOLERANCE) {
    const horseIds = Object.keys(shares).filter(id => id !== OTHER_KEY)
    const lastHorseId = horseIds[horseIds.length - 1]
    if (lastHorseId) {
      result[lastHorseId] = round2(result[lastHorseId] + diff)
    }
  }
  return result
}
