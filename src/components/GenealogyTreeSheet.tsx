import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Horse, Genealogy } from '../lib/types'
import { HORSE_COLORS } from '../lib/types'
import { HORSE_PHOTOS } from '../lib/horsePhotos'
import { computeLayout, collectBloodline, getBirthYear, getDeathYear, type TreeNode } from '../lib/genealogyLayout'
import { X } from 'lucide-react'

interface GenealogyTreeSheetProps {
  onClose: () => void
  onSelectHorse: (id: string) => void
  focusHorseId?: string
}

// ─── Constantes de layout ───────────────────────────────────────────────────
const BOX_W = 90
const BOX_H = 56
const COL_GAP = 22
const ROW_GAP = 46
const COL_W = BOX_W + COL_GAP
const ROW_H = BOX_H + ROW_GAP
const MARGIN = 24

function boxX(node: TreeNode) { return MARGIN + node.col * COL_W }
function boxY(node: TreeNode) { return MARGIN + node.row * ROW_H }
function centerX(node: TreeNode) { return boxX(node) + BOX_W / 2 }
function bottomY(node: TreeNode) { return boxY(node) + BOX_H }
function topY(node: TreeNode) { return boxY(node) }

function yearLabel(horse: Horse): string {
  const born = getBirthYear(horse)
  const died = getDeathYear(horse)
  if (!born) return ''
  return died ? `${born}-${died}` : `${born}`
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

export default function GenealogyTreeSheet({ onClose, onSelectHorse, focusHorseId }: GenealogyTreeSheetProps) {
  const [horses, setHorses] = useState<Horse[]>([])
  const [genealogy, setGenealogy] = useState<Genealogy[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const [{ data: horsesData }, { data: genData }] = await Promise.all([
        supabase.from('horses').select('*'),
        supabase.from('genealogy').select('*'),
      ])
      setHorses((horsesData as Horse[]) ?? [])
      setGenealogy((genData as Genealogy[]) ?? [])
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="fixed inset-0 z-[90] flex justify-center bg-black/5">
        <div className="w-full max-w-[390px] bg-[#F6F2EC] flex flex-col">
          <Header onClose={onClose} title="Arbre généalogique" />
          <Spinner />
        </div>
      </div>
    )
  }

  const subsetIds = focusHorseId ? collectBloodline(focusHorseId, horses, genealogy) : undefined
  const { nodes, edges, maxRow, colsPerRow } = computeLayout(horses, genealogy, subsetIds)

  const maxCols = Math.max(1, ...Array.from(colsPerRow.values()))
  const canvasWidth = MARGIN * 2 + maxCols * COL_W - COL_GAP
  const canvasHeight = MARGIN * 2 + (maxRow + 1) * ROW_H - ROW_GAP

  // ── Regroupement des connecteurs par ancre (parent seul ou couple) ──
  // Un couple (2 parents internes) est traité comme tel dès que la relation
  // est déclarée, que les deux parents partagent ou non la même génération
  // (ex. Haricot × Hyacinthe — parents de Lichen/Muscade — ne sont pas au
  // même niveau de lignée, mais forment bien un couple d'après l'organigramme
  // source). Chaque parent descend vers un bus commun avant de rejoindre l'enfant.
  interface Group {
    anchorX: number
    anchorY: number
    coupleParents?: { x: number; y: number }[]
    children: { x: number; y: number }[]
  }
  const groups = new Map<string, Group>()

  function addChild(key: string, anchorX: number, anchorY: number, coupleParents: Group['coupleParents'], childPt: { x: number; y: number }) {
    let g = groups.get(key)
    if (!g) {
      g = { anchorX, anchorY, coupleParents, children: [] }
      groups.set(key, g)
    }
    g.children.push(childPt)
  }

  for (const edge of edges) {
    const childNode = nodes.get(edge.childId)
    if (!childNode) continue
    const childPt = { x: centerX(childNode), y: topY(childNode) }
    const parentNodes = edge.parentIds.map(id => nodes.get(id)).filter((n): n is TreeNode => !!n)

    if (parentNodes.length === 1) {
      const p = parentNodes[0]
      addChild('single:' + p.horse.id, centerX(p), bottomY(p), undefined, childPt)
    } else if (parentNodes.length === 2) {
      const [a, b] = parentNodes
      const midX = (centerX(a) + centerX(b)) / 2
      const key = 'couple:' + [a.horse.id, b.horse.id].sort().join('+')
      addChild(key, midX, Math.max(bottomY(a), bottomY(b)), [
        { x: centerX(a), y: bottomY(a) },
        { x: centerX(b), y: bottomY(b) },
      ], childPt)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex justify-center bg-black/5">
      <div className="w-full max-w-[390px] bg-[#F6F2EC] flex flex-col">
        <Header onClose={onClose} title={focusHorseId ? 'Généalogie ciblée' : 'Arbre généalogique'} />

        <div className="flex-1 overflow-auto">
          <div className="relative" style={{ width: canvasWidth, height: canvasHeight }}>
            <svg
              className="absolute inset-0 pointer-events-none"
              width={canvasWidth}
              height={canvasHeight}
            >
              {Array.from(groups.values()).map((g, idx) => {
                const childRowY = g.children[0]?.y ?? g.anchorY
                const isCouple = !!g.coupleParents
                // Les couples routent leur bus au milieu de l'intervalle entre
                // rangées (plutôt que sur le bord des boîtes enfants) — et ce,
                // même si les deux parents ne sont pas au même niveau de lignée
                // (ex. Haricot × Hyacinthe pour Lichen/Muscade).
                const busY = isCouple ? childRowY - ROW_GAP / 2 : childRowY
                const spreadXs = [
                  ...(g.coupleParents ? g.coupleParents.map(p => p.x) : [g.anchorX]),
                  ...g.children.map(c => c.x),
                ]
                const minX = Math.min(...spreadXs)
                const maxX = Math.max(...spreadXs)
                return (
                  <g key={idx} stroke="#C0B4A6" strokeWidth={1.8} fill="none">
                    {g.coupleParents ? (
                      g.coupleParents.map((p, i) => (
                        <line key={'p' + i} x1={p.x} y1={p.y} x2={p.x} y2={busY} />
                      ))
                    ) : (
                      <line x1={g.anchorX} y1={g.anchorY} x2={g.anchorX} y2={busY} />
                    )}
                    {minX !== maxX && <line x1={minX} y1={busY} x2={maxX} y2={busY} />}
                    {isCouple && g.children.map((c, i) => (
                      <line key={'c' + i} x1={c.x} y1={busY} x2={c.x} y2={c.y} />
                    ))}
                  </g>
                )
              })}
            </svg>

            {Array.from(nodes.values()).map(node => {
              const horse = node.horse
              const color = horse.color_hex ?? HORSE_COLORS[horse.name] ?? null
              const photo = HORSE_PHOTOS[horse.name] ?? horse.photo_url
              const isFocus = horse.id === focusHorseId
              const sexSymbol = horse.sex === 'F' ? '♀' : horse.sex === 'M' ? '♂' : ''
              return (
                <button
                  key={horse.id}
                  type="button"
                  onClick={() => onSelectHorse(horse.id)}
                  className="absolute flex flex-col items-center justify-center rounded-xl px-1.5 py-1 cursor-pointer transition-transform active:scale-95 overflow-hidden"
                  style={{
                    left: boxX(node),
                    top: boxY(node),
                    width: BOX_W,
                    height: BOX_H,
                    backgroundColor: horse.is_active ? (color ?? '#2f6b3f') : '#FDFAF6',
                    border: horse.is_active ? 'none' : '1.5px dashed #C8B8A0',
                    boxShadow: isFocus ? '0 0 0 3px #4A5FA0' : undefined,
                  }}
                  title={horse.name}
                >
                  {photo && horse.is_active ? (
                    <img src={photo} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
                  ) : null}
                  <span
                    className={`relative font-bold leading-[1.1] px-0.5 text-center ${
                      horse.name.length > 9 ? 'text-[8.5px]' : 'text-[10px]'
                    } ${horse.is_active ? 'text-white' : 'text-gray-700'}`}
                  >
                    {horse.name}
                  </span>
                  <span
                    className={`relative text-[8.5px] leading-tight ${
                      horse.is_active ? 'text-white/85' : 'text-gray-500'
                    }`}
                  >
                    {sexSymbol} {yearLabel(horse)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Légende ── */}
        <div
          className="flex-shrink-0 flex items-center justify-center gap-4 px-4 py-2.5 border-t border-gray-200/60 bg-white/70 backdrop-blur-sm text-[10px] text-gray-500"
          style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
        >
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: '#2f6b3f' }} />
            Cavalerie active
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#FDFAF6]" style={{ border: '1.5px dashed #C8B8A0' }} />
            Historique
          </span>
        </div>
      </div>
    </div>
  )
}

function Header({ onClose, title }: { onClose: () => void; title: string }) {
  return (
    <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0 border-b border-gray-200/60 bg-white/70 backdrop-blur-sm">
      <h2 className="text-base font-black text-gray-900">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors flex-shrink-0"
      >
        <X className="w-4 h-4 text-gray-500" />
      </button>
    </div>
  )
}
