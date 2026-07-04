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

// ─── Disposition fixe, reprise de l'organigramme HTML source ────────────────
// L'utilisateur a demandé de reprendre telles quelles les positions relatives
// de cet organigramme (vérifié correct malgré son manque d'élégance visuelle)
// plutôt qu'un placement automatique — un algorithme générique (barycentre,
// DFS...) ne peut pas deviner qu'il faut laisser Harissa/H hors du passage du
// connecteur Haricot × Hyacinthe, par exemple. Chaque position ci-dessous a
// été vérifiée à la main pour qu'aucun connecteur ne passe au niveau d'un
// cheval qui lui est étranger. Hyacinthe est alignée sur la rangée de Haricot
// (son co-parent pour Lichen/Muscade) plutôt que sur sa profondeur de lignée
// stricte ; Epinard II passe en demi-rangée pour lui laisser la place.
const MASTER_POSITIONS: Record<string, { row: number; col: number }> = {
  // Rangée 0 — fondateurs / individus sans ascendance connue dans la cavalerie
  'Cerise (1977)': { row: 0, col: 0 },
  'Fitrio': { row: 0, col: 1 },
  'Olga': { row: 0, col: 2 },
  'Radis': { row: 0, col: 3 },
  'Qualitat': { row: 0, col: 4 },
  'Gamin': { row: 0, col: 5 },
  'Romarin': { row: 0, col: 6 },
  'Cerise': { row: 0, col: 7 },      // Cervoise de Champfort (active, Dartmoor)
  'Fraise': { row: 0, col: 8 },      // Faveur de Champfort (active, Dartmoor)
  'Azalée': { row: 0, col: 9 },
  'Capucine': { row: 0, col: 10 },

  // Demi-rangée — Epinard II (enfant d'Olga, avant Hyacinthe)
  'Epinard II': { row: 0.5, col: 2 },

  // Rangée 1
  'Pomme': { row: 1, col: 0 },
  'Haricot': { row: 1, col: 1 },
  'Hyacinthe': { row: 1, col: 2 },   // alignée sur Haricot, cf. note ci-dessus
  'Harissa': { row: 1, col: 9 },     // hors du passage du connecteur Haricot × Hyacinthe
  'H': { row: 1, col: 10 },

  // Rangée 2
  'Chataigne': { row: 2, col: 0 },
  'Litchi': { row: 2, col: 1 },      // Pomme × Haricot, adjacent à Kwetsche pour Nectarine
  'Kwetsche': { row: 2, col: 2 },
  'Cassis': { row: 2, col: 3 },
  'Haschich': { row: 2, col: 4 },
  'Lichen': { row: 2, col: 5 },      // Haricot × Hyacinthe
  'Muscade': { row: 2, col: 6 },     // Haricot × Hyacinthe

  // Rangée 3
  'Échalote': { row: 3, col: 0 },
  'Hakéa': { row: 3, col: 1 },
  'Nectarine': { row: 3, col: 2 },   // Kwetsche × Litchi

  // Rangée 4
  'Pamplemousse': { row: 4, col: 0 },
  'Pistache': { row: 4, col: 1 },
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

// Calcule (rangée, colonne) pour chaque cheval du sous-ensemble donné (ou
// tous si non précisé), à partir de la disposition fixe ci-dessus. Un cheval
// absent de la table (ne devrait pas arriver avec les 29 individus actuels)
// est replié en rangée 0, à la suite des colonnes déjà utilisées.
export function computeLayout(horses: Horse[], genealogy: Genealogy[], subsetIds?: Set<string>): TreeLayout {
  const genByHorseId = new Map(genealogy.map(g => [g.horse_id, g]))
  const include = (id: string) => !subsetIds || subsetIds.has(id)

  function internalParents(horseId: string): string[] {
    const g = genByHorseId.get(horseId)
    if (!g) return []
    return [g.pere_id, g.mere_id].filter((id): id is string => !!id && include(id))
  }

  const relevantHorses = horses.filter(h => include(h.id))

  let fallbackCol = Math.max(0, ...Object.values(MASTER_POSITIONS).filter(p => p.row === 0).map(p => p.col)) + 1
  const nodes = new Map<string, TreeNode>()
  let maxRow = 0
  const colsPerRow = new Map<number, number>()
  for (const h of relevantHorses) {
    const pos = MASTER_POSITIONS[h.name] ?? { row: 0, col: fallbackCol++ }
    nodes.set(h.id, { horse: h, row: pos.row, col: pos.col })
    maxRow = Math.max(maxRow, pos.row)
    colsPerRow.set(pos.row, Math.max(colsPerRow.get(pos.row) ?? 0, pos.col + 1))
  }

  const edges: TreeEdge[] = relevantHorses
    .map(h => ({ childId: h.id, parentIds: internalParents(h.id) }))
    .filter(e => e.parentIds.length > 0)

  return { nodes, edges, maxRow: Math.ceil(maxRow), colsPerRow }
}
