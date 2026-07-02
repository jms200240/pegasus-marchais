import { useEffect, useState } from 'react'
import { Plus, Trash2, Check, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Horse, Invoice } from '../lib/types'
import { CANONICAL_ORDER, HORSE_COLORS } from '../lib/types'

// ─── Domaine intervenant — aligné sur HealthEvent.type pour rester cohérent ──
type IntervenantType = 'veterinaire' | 'marechal' | 'dentiste' | 'osteo' | 'groom'

const INTERVENANT_LABELS: Record<IntervenantType, string> = {
  veterinaire: 'Vétérinaire',
  marechal: 'Maréchal-ferrant',
  dentiste: 'Dentiste',
  osteo: 'Ostéopathe',
  groom: 'Groom',
}

const INTERVENANT_ORDER: IntervenantType[] = ['veterinaire', 'marechal', 'dentiste', 'osteo', 'groom']

const TVA_RATES = [0, 5.5, 10, 20] as const
type TvaRate = (typeof TVA_RATES)[number]

// Clé de ventilation spéciale : part d'une ligne hors suivi chevaux (ex. un
// animal non suivi par l'app facturé par erreur sur la même facture). Compte
// dans le total de vérification, mais ne génère jamais de ligne `expenses`.
const OTHER_KEY = '__autre__'

interface InvoiceLineDraft {
  localId: string
  label: string
  ht: string
  tvaRate: TvaRate
  horseShares: Record<string, number> // horseId | OTHER_KEY -> % (uniquement éléments inclus)
  autreLabel: string // nom libre quand OTHER_KEY est inclus (ex. "Scoubidou")
}

// ─── Utilitaires date (évite les décalages UTC des champs date-only) ────────
function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatDateOnlyFr(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function monthBoundsYmd(): { first: string; last: string; label: string } {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const label = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  return { first: fmt(first), last: fmt(last), label: label.charAt(0).toUpperCase() + label.slice(1) }
}

function formatEuro(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ─── Calcul métier ────────────────────────────────────────────────────────
function sortByCanonicalOrder(horses: Horse[]): Horse[] {
  return [...horses].sort((a, b) => {
    const ia = CANONICAL_ORDER.indexOf(a.name as typeof CANONICAL_ORDER[number])
    const ib = CANONICAL_ORDER.indexOf(b.name as typeof CANONICAL_ORDER[number])
    if (ia === -1 && ib === -1) return a.name.localeCompare(b.name)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}

// Répartition égale garantissant une somme exacte de 100 (le dernier cheval
// récupère le reliquat d'arrondi).
function equalSplit(horseIds: string[]): Record<string, number> {
  const n = horseIds.length
  if (n === 0) return {}
  const base = Math.floor((100 / n) * 100) / 100
  const shares: Record<string, number> = {}
  let assigned = 0
  horseIds.forEach((id, i) => {
    if (i === horseIds.length - 1) {
      shares[id] = round2(100 - assigned)
    } else {
      shares[id] = base
      assigned += base
    }
  })
  return shares
}

function makeBlankLine(horses: Horse[]): InvoiceLineDraft {
  return {
    localId: crypto.randomUUID(),
    label: '',
    ht: '',
    tvaRate: 20,
    horseShares: equalSplit(horses.map(h => h.id)),
    autreLabel: '',
  }
}

function lineTtc(line: InvoiceLineDraft): number {
  const ht = parseFloat(line.ht)
  if (isNaN(ht)) return 0
  return round2(ht * (1 + line.tvaRate / 100))
}

function lineShareSum(line: InvoiceLineDraft): number {
  return round2(Object.values(line.horseShares).reduce((s, v) => s + (v || 0), 0))
}

function isShareValid(line: InvoiceLineDraft): boolean {
  return Object.keys(line.horseShares).length > 0 && Math.round(lineShareSum(line) * 100) === 10000
}

// Ventile le TTC d'une ligne par cheval ; le dernier récupère le reliquat
// d'arrondi pour que la somme retombe exactement sur le TTC de la ligne.
function splitTtcByShares(ttc: number, shares: Record<string, number>): Record<string, number> {
  const ids = Object.keys(shares)
  const result: Record<string, number> = {}
  let assigned = 0
  ids.forEach((id, i) => {
    if (i === ids.length - 1) {
      result[id] = round2(ttc - assigned)
    } else {
      const amount = round2((ttc * shares[id]) / 100)
      result[id] = amount
      assigned += amount
    }
  })
  return result
}

function isLineValid(line: InvoiceLineDraft): boolean {
  const ht = parseFloat(line.ht)
  const otherNamed = !(OTHER_KEY in line.horseShares) || line.autreLabel.trim() !== ''
  return line.label.trim() !== '' && !isNaN(ht) && ht > 0 && isShareValid(line) && otherNamed
}

// ─── Page principale ─────────────────────────────────────────────────────────
export default function Finances() {
  const [horses, setHorses] = useState<Horse[]>([])

  const [invoiceDate, setInvoiceDate] = useState(todayYmd())
  const [intervenantType, setIntervenantType] = useState<IntervenantType | null>(null)
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<InvoiceLineDraft[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [monthlyInvoices, setMonthlyInvoices] = useState<Invoice[]>([])
  const [monthlyLoading, setMonthlyLoading] = useState(true)

  async function fetchHorses() {
    const { data, error: horsesErr } = await supabase.from('horses').select('*').eq('is_active', true)
    if (horsesErr) { console.error('Erreur chargement chevaux:', horsesErr); return }
    setHorses(sortByCanonicalOrder((data as Horse[]) ?? []))
  }

  async function fetchMonthlyInvoices() {
    setMonthlyLoading(true)
    const { first, last } = monthBoundsYmd()
    const { data, error: invErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('status', 'validated')
      .gte('invoice_date', first)
      .lte('invoice_date', last)
      .order('invoice_date', { ascending: false })
    if (invErr) console.error('Erreur chargement factures du mois:', invErr)
    setMonthlyInvoices((data as Invoice[]) ?? [])
    setMonthlyLoading(false)
  }

  useEffect(() => {
    fetchHorses()
    fetchMonthlyInvoices()
  }, [])

  useEffect(() => {
    if (horses.length > 0 && lines.length === 0) {
      setLines([makeBlankLine(horses)])
    }
  }, [horses]) // eslint-disable-line react-hooks/exhaustive-deps

  function addLine() {
    setLines(prev => [...prev, makeBlankLine(horses)])
  }

  function removeLine(localId: string) {
    setLines(prev => (prev.length > 1 ? prev.filter(l => l.localId !== localId) : prev))
  }

  function updateLine(localId: string, patch: Partial<InvoiceLineDraft>) {
    setLines(prev => prev.map(l => (l.localId === localId ? { ...l, ...patch } : l)))
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

  function updateHorseShare(localId: string, horseId: string, value: number) {
    setLines(prev =>
      prev.map(l =>
        l.localId === localId
          ? { ...l, horseShares: { ...l.horseShares, [horseId]: isNaN(value) ? 0 : value } }
          : l
      )
    )
  }

  const totalTtc = round2(lines.reduce((sum, l) => sum + lineTtc(l), 0))
  const linesValid = lines.length > 0 && lines.every(isLineValid)
  const canSubmit = invoiceDate !== '' && intervenantType !== null && linesValid && !saving

  function resetForm() {
    setInvoiceDate(todayYmd())
    setIntervenantType(null)
    setNote('')
    setLines([makeBlankLine(horses)])
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
          total_ttc: totalTtc,
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
      fetchMonthlyInvoices()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.")
    } finally {
      setSaving(false)
    }
  }

  const { label: monthLabel } = monthBoundsYmd()
  const monthlyTotal = round2(monthlyInvoices.reduce((s, i) => s + i.total_ttc, 0))

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-5 pt-5 pb-3">
        <h1 className="text-2xl font-bold text-gray-900 leading-tight">Finances</h1>
        <p className="text-xs text-gray-500 mt-0.5">Saisie &amp; ventilation des factures</p>
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
            const shareSum = lineShareSum(line)
            const shareValid = isShareValid(line)
            const includedIds = Object.keys(line.horseShares)

            return (
              <div key={line.localId} className="bg-white rounded-xl shadow-xs p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400">Ligne {idx + 1}</span>
                  {lines.length > 1 && (
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

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Montant HT</p>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={line.ht}
                      onChange={e => updateLine(line.localId, { ht: e.target.value })}
                      placeholder="0.00"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700"
                    />
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
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">TTC calculé</span>
                  <span className="text-sm font-black text-gray-800">{formatEuro(ttc)}</span>
                </div>

                {/* ── Ventilation par cheval ── */}
                <div>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Ventilation</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {horses.map(horse => {
                      const included = includedIds.includes(horse.id)
                      const color = horse.color_hex ?? HORSE_COLORS[horse.name] ?? '#2f6b3f'
                      return (
                        <button
                          key={horse.id}
                          type="button"
                          onClick={() => toggleHorseForLine(line.localId, horse.id)}
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
                      onClick={() => toggleHorseForLine(line.localId, OTHER_KEY)}
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
                                value={line.autreLabel}
                                onChange={e => updateLine(line.localId, { autreLabel: e.target.value })}
                                placeholder="Nom (ex. Scoubidou)"
                                className="flex-1 min-w-0 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700"
                              />
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="0.1"
                                  value={line.horseShares[OTHER_KEY]}
                                  onChange={e =>
                                    updateHorseShare(line.localId, OTHER_KEY, parseFloat(e.target.value))
                                  }
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
                                value={line.horseShares[horseId]}
                                onChange={e =>
                                  updateHorseShare(line.localId, horseId, parseFloat(e.target.value))
                                }
                                className="w-16 text-xs text-right border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700"
                              />
                              <span className="text-xs text-gray-400">%</span>
                            </div>
                          </div>
                        )
                      })}

                      <div
                        className="flex items-center gap-1.5 text-[11px] font-bold pt-1"
                        style={{ color: shareValid ? '#2f6b3f' : '#dc2626' }}
                      >
                        {shareValid ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                        Somme : {shareSum}% {shareValid ? '' : '— doit être exactement 100%'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </section>

        {/* ── Total de vérification ── */}
        <section className="bg-white rounded-2xl shadow-xs p-5 text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
            Total à comparer avec la facture papier
          </p>
          <p className="text-3xl font-black" style={{ color: '#2f6b3f' }}>{formatEuro(totalTtc)}</p>
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

        {/* ── Factures validées du mois ── */}
        <section className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Factures validées — {monthLabel}
            </p>
            <span className="text-sm font-black" style={{ color: '#2f6b3f' }}>{formatEuro(monthlyTotal)}</span>
          </div>

          {monthlyLoading ? (
            <div className="flex items-center justify-center py-6">
              <svg className="animate-spin h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : monthlyInvoices.length === 0 ? (
            <div className="bg-white rounded-xl p-5 text-center shadow-xs">
              <p className="text-sm font-semibold text-gray-700">Aucune facture ce mois-ci</p>
            </div>
          ) : (
            <div className="space-y-2">
              {monthlyInvoices.map(inv => (
                <div key={inv.id} className="bg-white rounded-xl px-4 py-3 shadow-xs flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {INTERVENANT_LABELS[inv.intervenant_type as IntervenantType] ?? inv.intervenant_type ?? '—'}
                    </p>
                    <p className="text-[11px] text-gray-400">{formatDateOnlyFr(inv.invoice_date)}</p>
                  </div>
                  <span className="text-sm font-bold text-gray-700 flex-shrink-0">{formatEuro(inv.total_ttc)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
