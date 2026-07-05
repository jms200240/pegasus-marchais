import type { Horse } from './types'
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

// Ventile un TTC par part — chaque montant est calculé et arrondi indépendamment.
// Si l'écart résultant entre la somme des montants et le TTC ciblé reste
// inférieur à 5 centimes (bruit d'arrondi), il est absorbé par le dernier
// cheval de la liste des chevaux sélectionnés pour cette ligne — jamais par
// la part "Autre" (OTHER_KEY, hors suivi chevaux). Au-delà de 5 centimes,
// l'écart est laissé tel quel (signe d'un problème de ventilation réel).
export function splitTtcByShares(ttc: number, shares: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {}
  for (const id of Object.keys(shares)) {
    result[id] = round2((ttc * (shares[id] || 0)) / 100)
  }

  const sum = round2(Object.values(result).reduce((s, v) => s + v, 0))
  const diff = round2(ttc - sum)
  if (Math.abs(diff) < 0.05) {
    const horseIds = Object.keys(shares).filter(id => id !== OTHER_KEY)
    const lastHorseId = horseIds[horseIds.length - 1]
    if (lastHorseId) {
      result[lastHorseId] = round2(result[lastHorseId] + diff)
    }
  }
  return result
}
