import { Check, AlertCircle } from 'lucide-react'
import type { Horse } from '../lib/types'
import { HORSE_COLORS } from '../lib/types'
import { OTHER_KEY, round2, effectiveShares } from '../lib/financeUtils'

export type VentilationMode = 'single' | 'multiple'

export function shareSum(shares: Record<string, number>): number {
  return round2(Object.values(shares).reduce((s, v) => s + (v || 0), 0))
}

// Ventilation exactement à 100% — ou, si le TTC est connu, dont le dernier
// cheval peut être ajusté à 100% avec un bruit d'arrondi absorbable (cf. effectiveShares).
export function isSharesValid(shares: Record<string, number>, ttc = 0): boolean {
  if (Object.keys(shares).length === 0) return false
  if (Math.round(shareSum(shares) * 100) === 10000) return true
  return effectiveShares(shares, ttc).adjustedHorseId !== null
}

// ─── Ventilation par cheval — factorisé pour être réutilisé (facture, groom) ──
export function LineVentilation({
  horses,
  ventilationMode,
  singleHorseName,
  horseShares,
  autreLabel,
  ttc,
  onToggleHorse,
  onClearAll,
  onShareChange,
  onAutreLabelChange,
}: {
  horses: Horse[]
  ventilationMode: VentilationMode
  singleHorseName: string | null
  horseShares: Record<string, number>
  autreLabel: string
  ttc?: number
  onToggleHorse: (horseId: string) => void
  onClearAll: () => void
  onShareChange: (horseId: string, value: number) => void
  onAutreLabelChange: (value: string) => void
}) {
  const includedIds = Object.keys(horseShares)
  const rawSum = shareSum(horseShares)
  const isExact = Math.round(rawSum * 100) === 10000
  const eff = effectiveShares(horseShares, ttc ?? 0)
  const displayShares = isExact ? horseShares : eff.shares
  const sum = shareSum(displayShares)
  const valid = isSharesValid(horseShares, ttc ?? 0)
  const adjustedHorseName = eff.adjustedHorseId ? horses.find(h => h.id === eff.adjustedHorseId)?.name : null

  if (ventilationMode === 'single') {
    return (
      <div className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: '#2f6b3f' }}>
        <Check className="w-3.5 h-3.5" />
        Ventilation : 100% {singleHorseName ?? '— choisis un cheval ci-dessus'}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Ventilation</p>
        {includedIds.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-[10px] font-semibold text-gray-400 underline underline-offset-2 cursor-pointer hover:text-red-500 transition-colors"
          >
            Désélectionner tout
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {horses.map(horse => {
          const included = includedIds.includes(horse.id)
          const color = horse.color_hex ?? HORSE_COLORS[horse.name] ?? '#2f6b3f'
          return (
            <button
              key={horse.id}
              type="button"
              onClick={() => onToggleHorse(horse.id)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold cursor-pointer transition-all active:scale-[0.97] border-2"
              style={
                included
                  ? { backgroundColor: color, borderColor: color, color: 'white' }
                  : { backgroundColor: 'white', borderColor: '#e5e7eb', color: '#4b5563' }
              }
            >
              {included && <Check className="w-3 h-3" />}
              {horse.name}
            </button>
          )
        })}

        {/* ── Autre (hors suivi chevaux) ── */}
        <button
          type="button"
          onClick={() => onToggleHorse(OTHER_KEY)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold cursor-pointer transition-all active:scale-[0.97] border-2 border-dashed"
          style={
            includedIds.includes(OTHER_KEY)
              ? { backgroundColor: '#6b7280', borderColor: '#6b7280', borderStyle: 'solid', color: 'white' }
              : { backgroundColor: 'white', borderColor: '#d1d5db', color: '#6b7280' }
          }
        >
          {includedIds.includes(OTHER_KEY) && <Check className="w-3 h-3" />}
          Autre
        </button>
      </div>

      {includedIds.length > 0 && (
        <div className="space-y-1.5">
          {includedIds.map(horseId => {
            if (horseId === OTHER_KEY) {
              return (
                <div key={horseId} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={autreLabel}
                    onChange={e => onAutreLabelChange(e.target.value)}
                    placeholder="Nom (ex. Scoubidou)"
                    className="flex-1 min-w-0 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      value={displayShares[OTHER_KEY]}
                      onChange={e => onShareChange(OTHER_KEY, parseFloat(e.target.value))}
                      className="w-16 text-xs text-right border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700"
                    />
                    <span className="text-xs text-gray-400">%</span>
                  </div>
                </div>
              )
            }
            const horse = horses.find(h => h.id === horseId)
            if (!horse) return null
            return (
              <div key={horseId} className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-600 flex-1 truncate">{horse.name}</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={displayShares[horseId]}
                    onChange={e => onShareChange(horseId, parseFloat(e.target.value))}
                    className="w-16 text-xs text-right border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700"
                  />
                  <span className="text-xs text-gray-400">%</span>
                </div>
              </div>
            )
          })}

          <div
            className="flex items-center gap-1.5 text-[11px] font-bold pt-1"
            style={{ color: valid ? '#2f6b3f' : '#dc2626' }}
          >
            {valid ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            Somme : {sum}% {!valid && '— doit être exactement 100%'}
          </div>

          {valid && adjustedHorseName && eff.adjustedCents > 0 && (
            <div
              className="flex items-center gap-1.5 text-[11px] font-semibold rounded-lg px-2.5 py-1.5"
              style={{ backgroundColor: '#fff7ed', color: '#c2611d' }}
            >
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              Arrondi : {eff.adjustedCents} cent{eff.adjustedCents > 1 ? 's' : ''} alloué{eff.adjustedCents > 1 ? 's' : ''} à {adjustedHorseName}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
