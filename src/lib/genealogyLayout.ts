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
// (ou tous si non précisé), en clusterisant les familles par parcours DFS
// trié par année de naissance — approche générique qui retombe naturellement
// sur un layout lisible sans coordonnées codées en dur.
export function computeLayout(horses: Horse[], genealogy: Genealogy[], subsetIds?: Set<string>): TreeLayout {
  const horseById = new Map(horses.map(h => [h.id, h]))
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

  const childrenOf = new Map<string, string[]>()
  for (const h of relevantHorses) {
    for (const p of internalParents(h.id)) {
      if (!childrenOf.has(p)) childrenOf.set(p, [])
      childrenOf.get(p)!.push(h.id)
    }
  }
  for (const arr of childrenOf.values()) {
    arr.sort((a, b) => (getBirthYear(horseById.get(a)!) ?? 9999) - (getBirthYear(horseById.get(b)!) ?? 9999))
  }

  const roots = relevantHorses
    .filter(h => internalParents(h.id).length === 0)
    .sort((a, b) => (getBirthYear(a) ?? 9999) - (getBirthYear(b) ?? 9999))

  const colOf = new Map<string, number>()
  const rowOf = new Map<string, number>()
  const nextColByRow = new Map<number, number>()

  function visit(horseId: string) {
    if (colOf.has(horseId)) return
    const row = generation(horseId)
    const col = nextColByRow.get(row) ?? 0
    nextColByRow.set(row, col + 1)
    colOf.set(horseId, col)
    rowOf.set(horseId, row)
    for (const childId of childrenOf.get(horseId) ?? []) visit(childId)
  }
  for (const r of roots) visit(r.id)
  for (const h of relevantHorses) visit(h.id) // filet de sécurité, ne devrait rien ajouter

  const nodes = new Map<string, TreeNode>()
  let maxRow = 0
  const colsPerRow = new Map<number, number>()
  for (const h of relevantHorses) {
    const row = rowOf.get(h.id)!
    const col = colOf.get(h.id)!
    nodes.set(h.id, { horse: h, row, col })
    maxRow = Math.max(maxRow, row)
    colsPerRow.set(row, Math.max(colsPerRow.get(row) ?? 0, col + 1))
  }

  const edges: TreeEdge[] = relevantHorses
    .map(h => ({ childId: h.id, parentIds: internalParents(h.id) }))
    .filter(e => e.parentIds.length > 0)

  return { nodes, edges, maxRow, colsPerRow }
}
