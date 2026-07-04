import type { Horse, Genealogy } from './types'

// Année de naissance connue via le fichier généalogique fourni, mais sans date
// exacte (born_at reste null en base pour ne pas fabriquer un jour précis).
// Utilisé uniquement pour l'affichage/tri de l'arbre, jamais écrit en base.
const BIRTH_YEAR_FALLBACK: Record<string, number> = {
  'Cerise (1977)': 1977,
  'Chataigne': 1990,
  'Cassis': 1990,
  'Nectarine': 2001,
  'Litchi': 1999,
  'Radis': 1983,
  'Capucine': 1990,
  'H': 1995,
  'Gamin': 1990,
  'Qualitat': 1982,
  'Azalée': 1988,
  'Harissa': 1995,
  'Hyacinthe': 1995,
  'Lichen': 1999,
  'Muscade': 2000,
}

export function getBirthYear(horse: Horse): number | null {
  if (horse.born_at) return new Date(horse.born_at).getFullYear()
  return BIRTH_YEAR_FALLBACK[horse.name] ?? null
}

export function getDeathYear(horse: Horse): number | null {
  return horse.died_at ? new Date(horse.died_at).getFullYear() : null
}

export interface TreeNode {
  horse: Horse
  row: number
  col: number
}

export interface TreeEdge {
  childId: string
  parentIds: string[] // 1 ou 2 parents internes (pere_id/mere_id résolus dans le sous-ensemble)
}

export interface TreeLayout {
  nodes: Map<string, TreeNode>
  edges: TreeEdge[]
  maxRow: number
  colsPerRow: Map<number, number>
}

// Ascendants + descendants directs (sang) d'un cheval, pour le mode "zoom".
// N'inclut pas les "beaux-parents" (l'autre parent d'un enfant du cheval ciblé).
export function collectBloodline(horseId: string, horses: Horse[], genealogy: Genealogy[]): Set<string> {
  const genByHorseId = new Map(genealogy.map(g => [g.horse_id, g]))
  const result = new Set<string>([horseId])

  function addAscendants(id: string) {
    const g = genByHorseId.get(id)
    if (!g) return
    for (const pid of [g.pere_id, g.mere_id]) {
      if (pid && !result.has(pid)) {
        result.add(pid)
        addAscendants(pid)
      }
    }
  }
  addAscendants(horseId)

  const childrenMap = new Map<string, string[]>()
  for (const h of horses) {
    const g = genByHorseId.get(h.id)
    if (!g) continue
    for (const pid of [g.pere_id, g.mere_id]) {
      if (pid) {
        if (!childrenMap.has(pid)) childrenMap.set(pid, [])
        childrenMap.get(pid)!.push(h.id)
      }
    }
  }
  function addDescendants(id: string) {
    for (const c of childrenMap.get(id) ?? []) {
      if (!result.has(c)) {
        result.add(c)
        addDescendants(c)
      }
    }
  }
  addDescendants(horseId)

  return result
}

// Calcule (génération, colonne) pour chaque cheval du sous-ensemble donné
// (ou tous si non précisé). Génération = profondeur de lignée (pere_id/mere_id
// uniquement, pdm exclu du calcul). Colonnes : méthode du barycentre (à la
// Sugiyama) — chaque cheval est positionné à la moyenne des colonnes de ses
// parents internes, rangée par rangée du haut vers le bas, ce qui rapproche
// naturellement les couples et évite qu'un cheval sans lien ne s'intercale
// visuellement entre deux parents reliés par un même enfant.
export function computeLayout(horses: Horse[], genealogy: Genealogy[], subsetIds?: Set<string>): TreeLayout {
  const genByHorseId = new Map(genealogy.map(g => [g.horse_id, g]))
  const include = (id: string) => !subsetIds || subsetIds.has(id)

  function internalParents(horseId: string): string[] {
    const g = genByHorseId.get(horseId)
    if (!g) return []
    return [g.pere_id, g.mere_id].filter((id): id is string => !!id && include(id))
  }

  const generationCache = new Map<string, number>()
  function generation(horseId: string): number {
    if (generationCache.has(horseId)) return generationCache.get(horseId)!
    const parents = internalParents(horseId)
    const gen = parents.length === 0 ? 0 : 1 + Math.max(...parents.map(generation))
    generationCache.set(horseId, gen)
    return gen
  }

  const relevantHorses = horses.filter(h => include(h.id))
  const sortKey = (h: Horse) => `${(getBirthYear(h) ?? 9999).toString().padStart(4, '0')}_${h.name}`

  const rowOf = new Map<string, number>()
  const byRow = new Map<number, Horse[]>()
  let maxRow = 0
  for (const h of relevantHorses) {
    const row = generation(h.id)
    rowOf.set(h.id, row)
    maxRow = Math.max(maxRow, row)
    if (!byRow.has(row)) byRow.set(row, [])
    byRow.get(row)!.push(h)
  }

  const colOf = new Map<string, number>()
  const colsPerRow = new Map<number, number>()

  for (let row = 0; row <= maxRow; row++) {
    const rowHorses = byRow.get(row) ?? []
    const ordered = rowHorses.slice().sort((a, b) => {
      if (row === 0) return sortKey(a).localeCompare(sortKey(b))
      const parentsA = internalParents(a.id).map(id => colOf.get(id) ?? 0)
      const parentsB = internalParents(b.id).map(id => colOf.get(id) ?? 0)
      const baryA = parentsA.length > 0 ? parentsA.reduce((s, v) => s + v, 0) / parentsA.length : Infinity
      const baryB = parentsB.length > 0 ? parentsB.reduce((s, v) => s + v, 0) / parentsB.length : Infinity
      if (baryA !== baryB) return baryA - baryB
      return sortKey(a).localeCompare(sortKey(b))
    })
    ordered.forEach((h, idx) => colOf.set(h.id, idx))
    colsPerRow.set(row, ordered.length)
  }

  const nodes = new Map<string, TreeNode>()
  for (const h of relevantHorses) {
    nodes.set(h.id, { horse: h, row: rowOf.get(h.id)!, col: colOf.get(h.id)! })
  }

  const edges: TreeEdge[] = relevantHorses
    .map(h => ({ childId: h.id, parentIds: internalParents(h.id) }))
    .filter(e => e.parentIds.length > 0)

  return { nodes, edges, maxRow, colsPerRow }
}
