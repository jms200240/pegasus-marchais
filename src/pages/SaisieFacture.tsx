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
  // Ligne de solde auto-gérée (montant = reste à ventiler, recalculé en temps réel)
  // — perd ce statut dès que l'utilisateur modifie la ligne, ce qui fait alors
  // apparaître une nouvelle ligne de solde derrière elle si un écart subsiste.
  isAutoTail?: boolean
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
  return line.label.trim() !== '' && !isNaN(amount) && amount > 0 && isSharesValid(line.horseShares) && otherNamed
}

// ─── Ventilation par cheval — factorisé pour être réutilisé par la ligne de solde ──
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

  // ── Montant total de la facture (référence papier) ────────────────────────
  const [factureTotalTtc, setFactureTotalTtc] = useState('')
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

  useEffect(() => {
    if (horses.length > 0 && lines.length === 0) {
      const defaultShares = equalSplit(horses.map(h => h.id))
      setLines([makeBlankLine(defaultShares, { amountMode: 'ttc', isAutoTail: true })])
    }
  }, [horses]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ligne de solde automatique : tant que le montant total de la facture n'est
  // pas atteint par les lignes "fixées" (non auto-gérées), maintient une unique
  // ligne de solde à la fin, dont le montant TTC suit le reste à ventiler.
  useEffect(() => {
    if (!hasFactureTotal) return
    const fixedSum = round2(lines.filter(l => !l.isAutoTail).reduce((sum, l) => sum + lineTtc(l), 0))
    const remainder = round2(factureTotalNum - fixedSum)
    const tail = lines.find(l => l.isAutoTail)
    if (remainder > 0.004) {
      const remainderStr = String(remainder)
      if (tail) {
        if (tail.ttc !== remainderStr) {
          setLines(prev => prev.map(l => (l.isAutoTail ? { ...l, ttc: remainderStr } : l)))
        }
      } else {
        setLines(prev => [
          ...prev,
          makeBlankLine(currentDefaultShares(), { amountMode: 'ttc', ttc: remainderStr, isAutoTail: true }),
        ])
      }
    } else if (tail) {
      setLines(prev => prev.filter(l => !l.isAutoTail))
    }
  }, [lines, factureTotalNum, hasFactureTotal]) // eslint-disable-line react-hooks/exhaustive-deps

  function currentDefaultShares(): Record<string, number> {
    if (ventilationMode === 'single' && singleHorseId) return { [singleHorseId]: 100 }
    if (ventilationMode === 'single') return {}
    return equalSplit(horses.map(h => h.id))
  }

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

  // Modifier le montant (HT/TTC/TVA/mode) d'une ligne de solde auto lui retire
  // ce statut — elle devient fixe, et une nouvelle ligne de solde apparaîtra
  // derrière elle si un écart subsiste (cf. effet ci-dessus). Le libellé et la
  // ventilation restent librement modifiables sans casser le suivi automatique.
  function updateLine(localId: string, patch: Partial<InvoiceLineDraft>) {
    const touchesAmount = 'ht' in patch || 'ttc' in patch || 'amountMode' in patch || 'tvaRate' in patch
    setLines(prev =>
      prev.map(l => (l.localId === localId ? { ...l, ...patch, ...(touchesAmount ? { isAutoTail: false } : {}) } : l))
    )
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

  const allLinesTtc = round2(lines.reduce((sum, l) => sum + lineTtc(l), 0))
  const overBudget = hasFactureTotal && round2(allLinesTtc - factureTotalNum) > 0.004

  const linesValid = lines.length > 0 && lines.every(isLineValid)
  const modeValid = ventilationMode === 'multiple' || singleHorseId !== null
  const canSubmit =
    invoiceDate !== '' &&
    intervenantType !== null &&
    hasFactureTotal &&
    !overBudget &&
    linesValid &&
    modeValid &&
    !saving

  function resetForm() {
    setInvoiceDate(todayYmd())
    setIntervenantType(null)
    setNote('')
    setVentilationMode('multiple')
    setSingleHorseId(null)
    setFactureTotalTtc('')
    const defaultShares = equalSplit(horses.map(h => h.id))
    setLines([makeBlankLine(defaultShares, { amountMode: 'ttc', isAutoTail: true })])
  }

  async function handleValidate() {
    if (!canSubmit || !intervenantType) return
    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const traceNotes: string[] = []
      const expenseRowsDraft = lines.flatMap(line => {
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
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={factureTotalTtc}
              onChange={e => setFactureTotalTtc(e.target.value)}
              placeholder="0.00"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700"
            />
          </div>
        </section>

        {/* ── Lignes ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Lignes</p>
            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-1 text-xs font-bold underline underline-offset-2 cursor-pointer"
              style={{ color: '#2f6b3f' }}
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter une ligne
            </button>
          </div>

          {lines.map((line, idx) => {
            const ttc = lineTtc(line)
            const htDisplay = lineHtDisplay(line)

            return (
              <div
                key={line.localId}
                className="bg-white rounded-xl shadow-xs p-4 space-y-3"
                style={line.isAutoTail ? { border: '2px solid #bfe0c9' } : undefined}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400">
                    Ligne {idx + 1}
                    {line.isAutoTail && (
                      <span className="ml-1.5 font-normal normal-case" style={{ color: '#2f6b3f' }}>
                        · reste à ventiler
                      </span>
                    )}
                  </span>
                  {lines.length > 1 && !line.isAutoTail && (
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
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700"
                />

                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Saisie</p>
                  <div className="flex gap-1">
                    {(['ht', 'ttc'] as const).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => updateLine(line.localId, { amountMode: mode })}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full border cursor-pointer transition-all"
                        style={
                          line.amountMode === mode
                            ? { borderColor: '#bfe0c9', backgroundColor: '#f0fbf4', color: '#2f6b3f' }
                            : { borderColor: '#e5e7eb', backgroundColor: 'white', color: '#9ca3af' }
                        }
                      >
                        {mode.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                      {line.amountMode === 'ht' ? 'Montant HT' : 'HT (calculé)'}
                    </p>
                    {line.amountMode === 'ht' ? (
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={line.ht}
                        onChange={e => updateLine(line.localId, { ht: e.target.value })}
                        placeholder="0.00"
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700"
                      />
                    ) : (
                      <div className="w-full text-sm border border-gray-100 rounded-lg px-3 py-2 bg-gray-50 text-gray-400">
                        {htDisplay !== null ? formatEuro(htDisplay) : '—'}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">TVA</p>
                    <div className="flex gap-1">
                      {TVA_RATES.map(rate => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => updateLine(line.localId, { tvaRate: rate })}
                          className="flex-1 text-[10px] font-bold py-2 rounded-lg border cursor-pointer transition-all"
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
                </div>

                <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {line.amountMode === 'ttc' ? 'Montant TTC' : 'TTC calculé'}
                  </span>
                  {line.amountMode === 'ttc' ? (
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={line.ttc}
                      onChange={e => updateLine(line.localId, { ttc: e.target.value })}
                      placeholder="0.00"
                      className="w-24 text-sm text-right border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700"
                    />
                  ) : (
                    <span className="text-sm font-black text-gray-800">{formatEuro(ttc)}</span>
                  )}
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
              </div>
            )
          })}
        </section>

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
              Ventilé : {formatEuro(allLinesTtc)}
              {overBudget && ` — dépasse le montant de la facture de ${formatEuro(round2(allLinesTtc - factureTotalNum))}`}
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
