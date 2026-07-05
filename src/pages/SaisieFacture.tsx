import { useEffect, useState } from 'react'
import { ChevronLeft, Plus, Trash2, Check, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Horse } from '../lib/types'
import { HORSE_COLORS } from '../lib/types'
import {
  type IntervenantType,
  INTERVENANT_LABELS,
  INTERVENANT_ORDER,
  OTHER_KEY,
  todayYmd,
  formatEuro,
  round2,
  sortByCanonicalOrder,
  equalSplit,
  splitTtcByShares,
} from '../lib/financeUtils'

const TVA_RATES = [0, 5.5, 10, 20] as const
type TvaRate = (typeof TVA_RATES)[number]
type VentilationMode = 'single' | 'multiple'
type AmountMode = 'ht' | 'ttc'

interface InvoiceLineDraft {
  localId: string
  label: string
  amountMode: AmountMode
  ht: string // saisi si amountMode === 'ht'
  ttc: string // saisi si amountMode === 'ttc'
  tvaRate: TvaRate
  horseShares: Record<string, number> // horseId | OTHER_KEY -> % (uniquement éléments inclus)
  autreLabel: string // nom libre quand OTHER_KEY est inclus (ex. "Scoubidou")
  validated: boolean // verrouillée via "Valider la ligne" — seules les lignes validées comptent dans le solde et sont soumises
  // Tant que la ligne n'est pas validée et n'a pas été touchée manuellement,
  // son montant TTC suit automatiquement le solde restant à ventiler.
  autoSynced: boolean
  // Verrouille le montant (HT/TTC/TVA) via "Valider le montant" — même comportement
  // que le bouton "Valider le montant" du total de la facture. Prérequis à "Valider la ligne".
  amountValidated: boolean
}

function makeBlankLine(horseShares: Record<string, number>, overrides: Partial<InvoiceLineDraft> = {}): InvoiceLineDraft {
  return {
    localId: crypto.randomUUID(),
    label: '',
    amountMode: 'ht',
    ht: '',
    ttc: '',
    tvaRate: 20,
    horseShares,
    autreLabel: '',
    validated: false,
    autoSynced: false,
    amountValidated: false,
    ...overrides,
  }
}

// TTC de la ligne — saisi directement, ou calculé depuis le HT + la TVA.
function lineTtc(line: Pick<InvoiceLineDraft, 'amountMode' | 'ht' | 'ttc' | 'tvaRate'>): number {
  if (line.amountMode === 'ttc') {
    const ttc = parseFloat(line.ttc)
    return isNaN(ttc) ? 0 : round2(ttc)
  }
  const ht = parseFloat(line.ht)
  if (isNaN(ht)) return 0
  return round2(ht * (1 + line.tvaRate / 100))
}

// HT affiché — saisi directement, ou calculé depuis le TTC + la TVA (vérification uniquement).
function lineHtDisplay(line: Pick<InvoiceLineDraft, 'amountMode' | 'ht' | 'ttc' | 'tvaRate'>): number | null {
  if (line.amountMode === 'ht') {
    const ht = parseFloat(line.ht)
    return isNaN(ht) ? null : ht
  }
  const ttc = parseFloat(line.ttc)
  if (isNaN(ttc)) return null
  return round2(ttc / (1 + line.tvaRate / 100))
}

function shareSum(shares: Record<string, number>): number {
  return round2(Object.values(shares).reduce((s, v) => s + (v || 0), 0))
}

function isSharesValid(shares: Record<string, number>): boolean {
  return Object.keys(shares).length > 0 && Math.round(shareSum(shares) * 100) === 10000
}

function isLineValid(line: InvoiceLineDraft): boolean {
  const amount = line.amountMode === 'ttc' ? parseFloat(line.ttc) : parseFloat(line.ht)
  const otherNamed = !(OTHER_KEY in line.horseShares) || line.autreLabel.trim() !== ''
  return (
    line.amountValidated &&
    line.label.trim() !== '' &&
    !isNaN(amount) &&
    amount > 0 &&
    isSharesValid(line.horseShares) &&
    otherNamed
  )
}

// ─── Ventilation par cheval — factorisé pour être réutilisé par chaque ligne ──
function LineVentilation({
  horses,
  ventilationMode,
  singleHorseName,
  horseShares,
  autreLabel,
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
  onToggleHorse: (horseId: string) => void
  onClearAll: () => void
  onShareChange: (horseId: string, value: number) => void
  onAutreLabelChange: (value: string) => void
}) {
  const includedIds = Object.keys(horseShares)
  const sum = shareSum(horseShares)
  const valid = isSharesValid(horseShares)

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

        {/* ── Autre (hors suivi chevaux, ex. facture erronée pour un autre animal) ── */}
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
                      value={horseShares[OTHER_KEY]}
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
                    value={horseShares[horseId]}
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
            Somme : {sum}% {valid ? '' : '— doit être exactement 100%'}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page Saisie de facture ──────────────────────────────────────────────────
interface SaisieFactureProps {
  onBack: () => void
}

export default function SaisieFacture({ onBack }: SaisieFactureProps) {
  const [horses, setHorses] = useState<Horse[]>([])

  const [invoiceDate, setInvoiceDate] = useState(todayYmd())
  const [intervenantType, setIntervenantType] = useState<IntervenantType | null>(null)
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<InvoiceLineDraft[]>([])

  const [ventilationMode, setVentilationMode] = useState<VentilationMode>('multiple')
  const [singleHorseId, setSingleHorseId] = useState<string | null>(null)

  // ── Montant total de la facture (référence papier) — gate la section Lignes ──
  const [factureTotalTtc, setFactureTotalTtc] = useState('')
  const [factureTotalValidated, setFactureTotalValidated] = useState(false)
  const factureTotalNum = parseFloat(factureTotalTtc)
  const hasFactureTotal = !isNaN(factureTotalNum) && factureTotalNum > 0

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  async function fetchHorses() {
    const { data, error: horsesErr } = await supabase.from('horses').select('*').eq('is_active', true)
    if (horsesErr) { console.error('Erreur chargement chevaux:', horsesErr); return }
    setHorses(sortByCanonicalOrder((data as Horse[]) ?? []))
  }

  useEffect(() => { fetchHorses() }, [])

  function currentDefaultShares(): Record<string, number> {
    if (ventilationMode === 'single' && singleHorseId) return { [singleHorseId]: 100 }
    if (ventilationMode === 'single') return {}
    return equalSplit(horses.map(h => h.id))
  }

  // ── "Valider le montant" : ouvre la section Lignes, crée la ligne 1 (TTC
  // préremplie avec le montant total) si elle n'existe pas encore ──
  function handleValidateTotal() {
    if (!hasFactureTotal) return
    setFactureTotalValidated(true)
    if (lines.length === 0) {
      setLines([
        makeBlankLine(currentDefaultShares(), {
          amountMode: 'ttc',
          ttc: String(factureTotalNum),
          autoSynced: true,
        }),
      ])
    }
  }

  // Toute nouvelle édition du montant total invalide la validation précédente
  // — il faut re-cliquer "Valider le montant" pour rouvrir/recalculer les lignes.
  function handleTotalChange(value: string) {
    setFactureTotalTtc(value)
    if (factureTotalValidated) setFactureTotalValidated(false)
  }

  // ── Ligne de solde automatique : tant que le montant total de la facture n'est
  // pas atteint par les lignes déjà validées, maintient une unique ligne en
  // attente à la fin, dont le montant TTC suit le reste à ventiler (tant que
  // l'utilisateur ne l'a pas modifiée à la main).
  useEffect(() => {
    if (!factureTotalValidated || !hasFactureTotal) return
    const fixedSum = round2(lines.filter(l => l.validated).reduce((sum, l) => sum + lineTtc(l), 0))
    const remainder = round2(factureTotalNum - fixedSum)
    const pending = lines.find(l => !l.validated)
    if (remainder > 0.004) {
      const remainderStr = String(remainder)
      if (pending) {
        if (pending.autoSynced && pending.ttc !== remainderStr) {
          setLines(prev => prev.map(l => (l.localId === pending.localId ? { ...l, ttc: remainderStr } : l)))
        }
      } else {
        setLines(prev => [
          ...prev,
          makeBlankLine(currentDefaultShares(), { amountMode: 'ttc', ttc: remainderStr, autoSynced: true }),
        ])
      }
    } else if (pending && pending.autoSynced) {
      setLines(prev => prev.filter(l => l.localId !== pending.localId))
    }
  }, [lines, factureTotalNum, hasFactureTotal, factureTotalValidated]) // eslint-disable-line react-hooks/exhaustive-deps

  function selectMode(mode: VentilationMode) {
    setVentilationMode(mode)
    if (mode === 'multiple') {
      setSingleHorseId(null)
      const shares = equalSplit(horses.map(h => h.id))
      setLines(prev => prev.map(l => ({ ...l, horseShares: shares })))
    } else {
      setLines(prev => prev.map(l => ({ ...l, horseShares: {} })))
    }
  }

  function selectSingleHorse(horseId: string) {
    setSingleHorseId(horseId)
    setLines(prev => prev.map(l => ({ ...l, horseShares: { [horseId]: 100 } })))
  }

  function addLine() {
    setLines(prev => [...prev, makeBlankLine(currentDefaultShares())])
  }

  function removeLine(localId: string) {
    setLines(prev => (prev.length > 1 ? prev.filter(l => l.localId !== localId) : prev))
  }

  // Modifier le montant (HT/TTC/TVA/mode) d'une ligne en attente lui retire le
  // suivi automatique et invalide le montant (comme pour le montant total de la
  // facture — il faut re-cliquer "Valider le montant"). Le libellé et la
  // ventilation restent librement modifiables sans effet de bord.
  function updateLine(localId: string, patch: Partial<InvoiceLineDraft>) {
    const touchesAmount = 'ht' in patch || 'ttc' in patch || 'amountMode' in patch || 'tvaRate' in patch
    setLines(prev =>
      prev.map(l =>
        l.localId === localId
          ? { ...l, ...patch, ...(touchesAmount ? { autoSynced: false, amountValidated: false } : {}) }
          : l
      )
    )
  }

  // "Valider le montant" (par ligne) — même comportement que le bouton du total
  // de la facture : verrouille HT/TTC/TVA, prérequis à "Valider la ligne".
  function validateLineAmount(localId: string) {
    setLines(prev => prev.map(l => (l.localId === localId ? { ...l, amountValidated: true } : l)))
  }

  // "Valider la ligne" — verrouille la ligne (si valide) ; l'effet ci-dessus
  // fera alors apparaître une nouvelle ligne en attente si un solde subsiste.
  function validateLine(localId: string) {
    setLines(prev => prev.map(l => (l.localId === localId ? { ...l, validated: true } : l)))
  }

  function toggleHorseForLine(localId: string, horseId: string) {
    setLines(prev =>
      prev.map(l => {
        if (l.localId !== localId) return l
        const included = Object.keys(l.horseShares)
        const nextIncluded = included.includes(horseId)
          ? included.filter(id => id !== horseId)
          : [...included, horseId]
        return { ...l, horseShares: equalSplit(nextIncluded) }
      })
    )
  }

  function clearLineHorses(localId: string) {
    updateLine(localId, { horseShares: {} })
  }

  function updateHorseShare(localId: string, horseId: string, value: number) {
    setLines(prev =>
      prev.map(l =>
        l.localId === localId
          ? { ...l, horseShares: { ...l.horseShares, [horseId]: isNaN(value) ? 0 : value } }
          : l
      )
    )
  }

  const validatedLines = lines.filter(l => l.validated)
  const fixedSum = round2(validatedLines.reduce((sum, l) => sum + lineTtc(l), 0))
  const overBudget = hasFactureTotal && round2(fixedSum - factureTotalNum) > 0.004
  const fullyAllocated = hasFactureTotal && !overBudget && round2(factureTotalNum - fixedSum) <= 0.004
  const noPendingLine = lines.every(l => l.validated)

  const modeValid = ventilationMode === 'multiple' || singleHorseId !== null
  const canSubmit =
    invoiceDate !== '' &&
    intervenantType !== null &&
    factureTotalValidated &&
    fullyAllocated &&
    noPendingLine &&
    validatedLines.length > 0 &&
    modeValid &&
    !saving

  function resetForm() {
    setInvoiceDate(todayYmd())
    setIntervenantType(null)
    setNote('')
    setVentilationMode('multiple')
    setSingleHorseId(null)
    setFactureTotalTtc('')
    setFactureTotalValidated(false)
    setLines([])
  }

  async function handleValidate() {
    if (!canSubmit || !intervenantType) return
    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const traceNotes: string[] = []
      const expenseRowsDraft = validatedLines.flatMap(line => {
        const perHorse = splitTtcByShares(lineTtc(line), line.horseShares)
        const otherAmount = perHorse[OTHER_KEY]
        if (otherAmount && otherAmount > 0) {
          traceNotes.push(
            `Ligne "${line.label.trim()}" : ${formatEuro(otherAmount)} hors suivi chevaux (${line.autreLabel.trim()})`
          )
        }
        return Object.entries(perHorse)
          .filter(([horseId, amount]) => horseId !== OTHER_KEY && amount > 0)
          .map(([horseId, amount]) => ({
            horse_id: horseId,
            expense_date: invoiceDate,
            intervenant_type: intervenantType,
            amount_ttc: amount,
            note: line.label.trim(),
          }))
      })

      const combinedNotes = [note.trim(), ...traceNotes].filter(Boolean).join(' | ') || null

      const { data: invoiceRow, error: invErr } = await supabase
        .from('invoices')
        .insert({
          invoice_date: invoiceDate,
          intervenant_type: intervenantType,
          total_ttc: factureTotalNum,
          status: 'validated',
          photo_url: null,
          notes: combinedNotes,
        })
        .select()
        .single()
      if (invErr) throw invErr

      const expenseRows = expenseRowsDraft.map(row => ({ ...row, invoice_id: invoiceRow.id }))

      const { error: expErr } = await supabase.from('expenses').insert(expenseRows)
      if (expErr) {
        // Pas de RPC serveur ici — rollback best-effort pour ne pas laisser
        // une facture orpheline sans ventilation en cas d'échec partiel.
        await supabase.from('invoices').delete().eq('id', invoiceRow.id)
        throw expErr
      }

      setSuccessMessage('Facture enregistrée et ventilée.')
      resetForm()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.")
    } finally {
      setSaving(false)
    }
  }

  const singleHorseName = ventilationMode === 'single' && singleHorseId
    ? horses.find(h => h.id === singleHorseId)?.name ?? null
    : null

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-5 pt-5 pb-3 flex items-center gap-3">
        <button type="button" onClick={onBack} className="cursor-pointer text-gray-400 hover:text-gray-600">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">Saisie de facture</h1>
          <p className="text-xs text-gray-500 mt-0.5">Saisie &amp; ventilation</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6 space-y-5">

        {/* ── En-tête facture ── */}
        <section className="space-y-3">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Date de la facture</p>
            <input
              type="date"
              value={invoiceDate}
              onChange={e => setInvoiceDate(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700"
            />
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Intervenant</p>
            <div className="flex flex-wrap gap-2">
              {INTERVENANT_ORDER.map(type => {
                const isSelected = intervenantType === type
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setIntervenantType(type)}
                    className="px-3 py-2 rounded-full text-xs font-bold cursor-pointer transition-all active:scale-[0.97] border-2"
                    style={
                      isSelected
                        ? { borderColor: '#bfe0c9', backgroundColor: '#f0fbf4', color: '#2f6b3f' }
                        : { borderColor: '#e5e7eb', backgroundColor: 'white', color: '#4b5563' }
                    }
                  >
                    {INTERVENANT_LABELS[type]}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Note (optionnel)</p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="Contexte, référence de la facture papier..."
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none text-gray-700"
            />
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Ventilation de la facture</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => selectMode('multiple')}
                className="py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all border-2"
                style={
                  ventilationMode === 'multiple'
                    ? { borderColor: '#bfe0c9', backgroundColor: '#f0fbf4', color: '#2f6b3f' }
                    : { borderColor: '#e5e7eb', backgroundColor: 'white', color: '#4b5563' }
                }
              >
                Plusieurs chevaux
              </button>
              <button
                type="button"
                onClick={() => selectMode('single')}
                className="py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all border-2"
                style={
                  ventilationMode === 'single'
                    ? { borderColor: '#bfe0c9', backgroundColor: '#f0fbf4', color: '#2f6b3f' }
                    : { borderColor: '#e5e7eb', backgroundColor: 'white', color: '#4b5563' }
                }
              >
                1 seul cheval
              </button>
            </div>

            {ventilationMode === 'single' && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {horses.map(horse => {
                  const isSelected = singleHorseId === horse.id
                  const color = horse.color_hex ?? HORSE_COLORS[horse.name] ?? '#2f6b3f'
                  return (
                    <button
                      key={horse.id}
                      type="button"
                      onClick={() => selectSingleHorse(horse.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold cursor-pointer transition-all active:scale-[0.97] border-2"
                      style={
                        isSelected
                          ? { backgroundColor: color, borderColor: color, color: 'white' }
                          : { backgroundColor: 'white', borderColor: '#e5e7eb', color: '#4b5563' }
                      }
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                      {horse.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Montant total de la facture (référence papier) ── */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Montant total de la facture TTC
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={factureTotalTtc}
                onChange={e => handleTotalChange(e.target.value)}
                placeholder="0.00"
                className="w-28 flex-shrink-0 text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700"
              />
              <button
                type="button"
                onClick={handleValidateTotal}
                disabled={!hasFactureTotal || factureTotalValidated}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm font-bold py-2.5 rounded-xl cursor-pointer transition-all disabled:cursor-not-allowed"
                style={
                  factureTotalValidated
                    ? { backgroundColor: '#f0fbf4', color: '#2f6b3f', border: '2px solid #bfe0c9' }
                    : hasFactureTotal
                    ? { backgroundColor: '#2f6b3f', color: 'white' }
                    : { backgroundColor: '#e5e7eb', color: '#9ca3af' }
                }
              >
                {factureTotalValidated ? <Check className="w-4 h-4" /> : null}
                {factureTotalValidated ? 'Montant validé' : 'Valider le montant'}
              </button>
            </div>
          </div>
        </section>

        {/* ── Lignes — n'apparaît qu'après validation du montant total ── */}
        {factureTotalValidated && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Lignes</p>
              {noPendingLine && (
                <button
                  type="button"
                  onClick={addLine}
                  className="flex items-center gap-1 text-xs font-bold underline underline-offset-2 cursor-pointer"
                  style={{ color: '#2f6b3f' }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter une ligne
                </button>
              )}
            </div>

            {lines.map((line, idx) => {
              const ttc = lineTtc(line)
              const htDisplay = lineHtDisplay(line)
              const lineValid = isLineValid(line)

              return (
                <div
                  key={line.localId}
                  className="bg-white rounded-xl shadow-xs p-4 space-y-3"
                  style={line.validated ? undefined : { border: '2px solid #bfe0c9' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-400">
                      Ligne {idx + 1}
                      {line.validated ? (
                        <span className="ml-1.5 font-normal normal-case inline-flex items-center gap-1" style={{ color: '#2f6b3f' }}>
                          <Check className="w-3 h-3" /> validée
                        </span>
                      ) : (
                        <span className="ml-1.5 font-normal normal-case" style={{ color: '#2f6b3f' }}>
                          · reste à ventiler
                        </span>
                      )}
                    </span>
                    {lines.length > 1 && !line.validated && (
                      <button
                        type="button"
                        onClick={() => removeLine(line.localId)}
                        className="text-gray-300 hover:text-red-500 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    value={line.label}
                    onChange={e => updateLine(line.localId, { label: e.target.value })}
                    placeholder="Libellé (ex. Consultation, ferrure...)"
                    disabled={line.validated}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700 disabled:bg-gray-50 disabled:text-gray-400"
                  />

                  {/* ── Montant HT (gauche) / TTC (droite) — le champ édité fixe le "amountMode" ── */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Montant HT</p>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={line.amountMode === 'ht' ? line.ht : (htDisplay !== null ? String(htDisplay) : '')}
                        onChange={e => updateLine(line.localId, { ht: e.target.value, amountMode: 'ht' })}
                        placeholder="0.00"
                        disabled={line.validated}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700 disabled:bg-gray-50 disabled:text-gray-400"
                      />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Montant TTC</p>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={line.amountMode === 'ttc' ? line.ttc : (ttc > 0 ? String(ttc) : '')}
                        onChange={e => updateLine(line.localId, { ttc: e.target.value, amountMode: 'ttc' })}
                        placeholder="0.00"
                        disabled={line.validated}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700 disabled:bg-gray-50 disabled:text-gray-400"
                      />
                    </div>
                  </div>

                  {/* ── TVA (gauche) / Valider le montant (droite) ── */}
                  <div className="flex items-end gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">TVA</p>
                      <div className="flex gap-1">
                        {TVA_RATES.map(rate => (
                          <button
                            key={rate}
                            type="button"
                            disabled={line.validated}
                            onClick={() => updateLine(line.localId, { tvaRate: rate })}
                            className="flex-1 text-[10px] font-bold py-2 rounded-lg border cursor-pointer transition-all disabled:cursor-not-allowed"
                            style={
                              line.tvaRate === rate
                                ? { borderColor: '#bfe0c9', backgroundColor: '#f0fbf4', color: '#2f6b3f' }
                                : { borderColor: '#e5e7eb', backgroundColor: 'white', color: '#9ca3af' }
                            }
                          >
                            {rate}%
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => validateLineAmount(line.localId)}
                      disabled={line.validated || line.amountValidated || ttc <= 0}
                      className="flex-shrink-0 flex items-center justify-center gap-1 text-[11px] font-bold px-2.5 py-2 rounded-lg cursor-pointer transition-all disabled:cursor-not-allowed"
                      style={
                        line.amountValidated
                          ? { backgroundColor: '#f0fbf4', color: '#2f6b3f', border: '2px solid #bfe0c9' }
                          : ttc > 0
                          ? { backgroundColor: '#2f6b3f', color: 'white' }
                          : { backgroundColor: '#e5e7eb', color: '#9ca3af' }
                      }
                    >
                      {line.amountValidated ? <Check className="w-3.5 h-3.5" /> : null}
                      {line.amountValidated ? 'Montant validé' : 'Valider le montant'}
                    </button>
                  </div>

                  <LineVentilation
                    horses={horses}
                    ventilationMode={ventilationMode}
                    singleHorseName={singleHorseName}
                    horseShares={line.horseShares}
                    autreLabel={line.autreLabel}
                    onToggleHorse={horseId => toggleHorseForLine(line.localId, horseId)}
                    onClearAll={() => clearLineHorses(line.localId)}
                    onShareChange={(horseId, value) => updateHorseShare(line.localId, horseId, value)}
                    onAutreLabelChange={value => updateLine(line.localId, { autreLabel: value })}
                  />

                  {!line.validated && (
                    <button
                      type="button"
                      onClick={() => validateLine(line.localId)}
                      disabled={!lineValid}
                      className="w-full font-bold text-sm py-2.5 rounded-xl transition-all disabled:cursor-not-allowed"
                      style={
                        lineValid
                          ? { backgroundColor: '#2f6b3f', color: 'white', cursor: 'pointer' }
                          : { backgroundColor: '#e5e7eb', color: '#9ca3af' }
                      }
                    >
                      Valider la ligne
                    </button>
                  )}
                </div>
              )
            })}
          </section>
        )}

        {/* ── Total de vérification ── */}
        <section className="bg-white rounded-2xl shadow-xs p-5 text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
            Montant total de la facture
          </p>
          <p className="text-3xl font-black" style={{ color: overBudget ? '#dc2626' : '#2f6b3f' }}>
            {hasFactureTotal ? formatEuro(factureTotalNum) : '—'}
          </p>
          {hasFactureTotal && (
            <p className="text-xs font-semibold mt-1" style={{ color: overBudget ? '#dc2626' : '#9ca3af' }}>
              Ventilé (validé) : {formatEuro(fixedSum)}
              {overBudget && ` — dépasse le montant de la facture de ${formatEuro(round2(fixedSum - factureTotalNum))}`}
            </p>
          )}
        </section>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}
        {successMessage && (
          <p className="text-xs font-semibold bg-green-50 border border-green-200 rounded-lg px-3 py-2" style={{ color: '#2f6b3f' }}>
            {successMessage}
          </p>
        )}

        <button
          type="button"
          onClick={handleValidate}
          disabled={!canSubmit}
          className="w-full flex items-center justify-center gap-2 font-bold text-sm py-3.5 rounded-xl text-white shadow-sm active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-40"
          style={{ backgroundColor: '#2f6b3f' }}
        >
          {saving ? 'Enregistrement…' : 'Valider la facture'}
        </button>
      </div>
    </div>
  )
}
