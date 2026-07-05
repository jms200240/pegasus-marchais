import type { QuizAnswer } from './types'
import type { VaccineDbType } from './vaccineUtils'

// ─── Résolution de la ressource liée à une question (source_id polymorphe) ───
// Le type de ressource se déduit de `categorie` : Maladies/Parasites -> fiche
// pathologie (source_id = pathologies.id), Vaccins -> fiche vaccin (source_id
// = nom du vaccin en texte libre), Généalogie -> fiche cheval (source_id =
// slug du nom du cheval). 'multi' (Vaccins) ou un ancêtre externe non présent
// dans notre cavalerie (Généalogie) ne donnent aucun lien.
export type QuizResourceType = 'pathologie' | 'vaccin' | 'cheval'

export function resourceTypeForCategorie(categorie: string): QuizResourceType | null {
  if (categorie === 'Maladies' || categorie === 'Parasites') return 'pathologie'
  if (categorie === 'Vaccins') return 'vaccin'
  if (categorie === 'Généalogie') return 'cheval'
  return null
}

// Normalise un nom de cheval pour le comparer à un slug (minuscules, sans accents).
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

// Retrouve la clé vaccin (VACCINES) depuis le texte libre source_id — tolérant
// aux variantes de formulation entre lots de questions. Retourne null pour
// 'multi' (question de comparaison, sans vaccin unique) ou texte non reconnu.
export function resolveVaccineDbType(sourceId: string): VaccineDbType | null {
  const s = slugify(sourceId)
  if (s.includes('grippe')) return 'grippe'
  if (s.includes('tetanos')) return 'tetanos'
  if (s.includes('rhino')) return 'rhino'
  if (s.includes('rage')) return 'rage'
  return null
}

export const ANSWER_KEYS: QuizAnswer[] = ['A', 'B', 'C', 'D']

export function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
