import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Horse, Invoice, Expense } from '../lib/types'
import { HORSE_COLORS } from '../lib/types'
import {
  type IntervenantType,
  INTERVENANT_LABELS,
  INTERVENANT_ORDER,
  INTERVENANT_COLORS,
  formatEuro,
  formatDateOnlyFr,
  round2,
  sortByCanonicalOrder,
  yearBoundsYmd,
} from '../lib/financeUtils'
import InvoiceDetailSheet from '../components/InvoiceDetailSheet'

interface SuiviCoutsProps {
  onBack: () => void
}

type DrillTarget =
  | { kind: 'horse'; horseId: string }
  | { kind: 'prestataire'; intervenant: IntervenantType }

// ─── Bar chart horizontal réutilisable ────────────────────────────────────
interface BarRowProps {
  label: string
  amount: number
  pct: number // 0-100, relatif au max du groupe affiché
  color: string
  onClick?: () => void
}

function BarRow({ label, amount, pct, color, onClick }: BarRowProps) {
  const visualPct = Math.max(pct, 22)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`w-full flex items-center gap-2 text-left ${onClick ? 'cursor-pointer active:scale-[0.99] transition-transform' : 'cursor-default'}`}
    >
      <div className="flex-1 h-9 bg-gray-100 rounded-lg overflow-hidden">
        <div
          className="h-full rounded-lg flex items-center px-3 transition-all"
          style={{ width: `${visualPct}%`, backgroundColor: color }}
        >
          <span className="text-xs font-bold text-white truncate">{label}</span>
        </div>
      </div>
      <span className="text-sm font-bold text-gray-700 flex-shrink-0 w-[72px] text-right">
        {formatEuro(amount)}
      </span>
    </button>
  )
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

export default function SuiviCouts({ onBack }: SuiviCoutsProps) {
  const [horses, setHorses] = useState<Horse[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
  const [drill, setDrill] = useState<DrillTarget | null>(null)

  async function fetchData() {
    setLoading(true)
    const { first, last } = yearBoundsYmd()
    const [{ data: horsesData }, { data: invoicesData }, { data: expensesData }] = await Promise.all([
      supabase.from('horses').select('*'),
      supabase
        .from('invoices')
        .select('*')
        .eq('status', 'validated')
        .gte('invoice_date', first)
        .lte('invoice_date', last)
        .order('invoice_date', { ascending: false }),
      supabase.from('expenses').select('*').gte('expense_date', first).lte('expense_date', last),
    ])
    setHorses(sortByCanonicalOrder((horsesData as Horse[]) ?? []))
    setInvoices((invoicesData as Invoice[]) ?? [])
    setExpenses((expensesData as Expense[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const { label: yearLabel } = yearBoundsYmd()
  const totalYear = round2(invoices.reduce((s, i) => s + i.total_ttc, 0))

  const perHorse = horses
    .map(horse => ({
      horse,
      total: round2(expenses.filter(e => e.horse_id === horse.id).reduce((s, e) => s + e.amount_ttc, 0)),
    }))
    .filter(x => x.total > 0)
    .sort((a, b) => b.total - a.total)
  const maxHorseTotal = perHorse[0]?.total ?? 0

  const perPrestataire = INTERVENANT_ORDER
    .map(type => ({
      type,
      total: round2(expenses.filter(e => e.intervenant_type === type).reduce((s, e) => s + e.amount_ttc, 0)),
    }))
    .filter(x => x.total > 0)
    .sort((a, b) => b.total - a.total)
  const maxPrestataireTotal = perPrestataire[0]?.total ?? 0

  // ── Écran détail : un cheval, ventilé par prestataire ──────────────────
  if (drill?.kind === 'horse') {
    const horse = horses.find(h => h.id === drill.horseId) ?? null
    const rows = INTERVENANT_ORDER
      .map(type => ({
        type,
        total: round2(
          expenses
            .filter(e => e.horse_id === drill.horseId && e.intervenant_type === type)
            .reduce((s, e) => s + e.amount_ttc, 0)
        ),
      }))
      .filter(r => r.total > 0)
      .sort((a, b) => b.total - a.total)
    const max = rows[0]?.total ?? 0
    const subtotal = round2(rows.reduce((s, r) => s + r.total, 0))

    return (
      <div className="flex-1 flex flex-col">
        <div className="px-5 pt-5 pb-3 flex items-center gap-3">
          <button type="button" onClick={() => setDrill(null)} className="cursor-pointer text-gray-400 hover:text-gray-600">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{horse?.name ?? '—'}</h1>
            <p className="text-xs text-gray-500 mt-0.5">Détail par prestataire — {yearLabel}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6 space-y-5">
          <section className="bg-white rounded-2xl shadow-xs p-5 text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Total TTC — {horse?.name ?? '—'}
            </p>
            <p className="text-3xl font-black" style={{ color: '#2f6b3f' }}>{formatEuro(subtotal)}</p>
          </section>
          {rows.length === 0 ? (
            <div className="bg-white rounded-xl p-5 text-center shadow-xs">
              <p className="text-sm font-semibold text-gray-700">Aucune dépense enregistrée</p>
            </div>
          ) : (
            <section className="space-y-2.5">
              {rows.map(r => (
                <BarRow
                  key={r.type}
                  label={INTERVENANT_LABELS[r.type]}
                  amount={r.total}
                  pct={max > 0 ? (r.total / max) * 100 : 0}
                  color={INTERVENANT_COLORS[r.type]}
                />
              ))}
            </section>
          )}
        </div>
      </div>
    )
  }

  // ── Écran détail : un prestataire, ventilé par cheval ───────────────────
  if (drill?.kind === 'prestataire') {
    const rows = horses
      .map(horse => ({
        horse,
        total: round2(
          expenses
            .filter(e => e.intervenant_type === drill.intervenant && e.horse_id === horse.id)
            .reduce((s, e) => s + e.amount_ttc, 0)
        ),
      }))
      .filter(r => r.total > 0)
      .sort((a, b) => b.total - a.total)
    const max = rows[0]?.total ?? 0
    const subtotal = round2(rows.reduce((s, r) => s + r.total, 0))

    return (
      <div className="flex-1 flex flex-col">
        <div className="px-5 pt-5 pb-3 flex items-center gap-3">
          <button type="button" onClick={() => setDrill(null)} className="cursor-pointer text-gray-400 hover:text-gray-600">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{INTERVENANT_LABELS[drill.intervenant]}</h1>
            <p className="text-xs text-gray-500 mt-0.5">Détail par cheval — {yearLabel}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6 space-y-5">
          <section className="bg-white rounded-2xl shadow-xs p-5 text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Total TTC — {INTERVENANT_LABELS[drill.intervenant]}
            </p>
            <p className="text-3xl font-black" style={{ color: '#2f6b3f' }}>{formatEuro(subtotal)}</p>
          </section>
          {rows.length === 0 ? (
            <div className="bg-white rounded-xl p-5 text-center shadow-xs">
              <p className="text-sm font-semibold text-gray-700">Aucune dépense enregistrée</p>
            </div>
          ) : (
            <section className="space-y-2.5">
              {rows.map(r => {
                const color = r.horse.color_hex ?? HORSE_COLORS[r.horse.name] ?? '#2f6b3f'
                return (
                  <BarRow
                    key={r.horse.id}
                    label={r.horse.name}
                    amount={r.total}
                    pct={max > 0 ? (r.total / max) * 100 : 0}
                    color={color}
                  />
                )
              })}
            </section>
          )}
        </div>
      </div>
    )
  }

  // ── Écran principal ──────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col">
      <div className="px-5 pt-5 pb-3 flex items-center gap-3">
        <button type="button" onClick={onBack} className="cursor-pointer text-gray-400 hover:text-gray-600">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">Suivi des coûts</h1>
          <p className="text-xs text-gray-500 mt-0.5">{yearLabel}</p>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6 space-y-5">

          {/* ── Total de l'année ── */}
          <section className="bg-white rounded-2xl shadow-xs p-5 text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Total TTC payé — {yearLabel}
            </p>
            <p className="text-3xl font-black" style={{ color: '#2f6b3f' }}>{formatEuro(totalYear)}</p>
          </section>

          {/* ── Ventilation par cheval ── */}
          <section>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Ventilation par cheval</p>
            {perHorse.length === 0 ? (
              <div className="bg-white rounded-xl p-5 text-center shadow-xs">
                <p className="text-sm font-semibold text-gray-700">Aucune dépense enregistrée</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {perHorse.map(({ horse, total }) => {
                  const color = horse.color_hex ?? HORSE_COLORS[horse.name] ?? '#2f6b3f'
                  return (
                    <BarRow
                      key={horse.id}
                      label={horse.name}
                      amount={total}
                      pct={maxHorseTotal > 0 ? (total / maxHorseTotal) * 100 : 0}
                      color={color}
                      onClick={() => setDrill({ kind: 'horse', horseId: horse.id })}
                    />
                  )
                })}
              </div>
            )}
          </section>

          {/* ── Ventilation par prestataire ── */}
          <section>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Ventilation par prestataire</p>
            {perPrestataire.length === 0 ? (
              <div className="bg-white rounded-xl p-5 text-center shadow-xs">
                <p className="text-sm font-semibold text-gray-700">Aucune dépense enregistrée</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {perPrestataire.map(({ type, total }) => (
                  <BarRow
                    key={type}
                    label={INTERVENANT_LABELS[type]}
                    amount={total}
                    pct={maxPrestataireTotal > 0 ? (total / maxPrestataireTotal) * 100 : 0}
                    color={INTERVENANT_COLORS[type]}
                    onClick={() => setDrill({ kind: 'prestataire', intervenant: type })}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ── Liste des factures ── */}
          <section>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Factures — {yearLabel}</p>
            {invoices.length === 0 ? (
              <div className="bg-white rounded-xl p-5 text-center shadow-xs">
                <p className="text-sm font-semibold text-gray-700">Aucune facture</p>
              </div>
            ) : (
              <div className="space-y-2">
                {invoices.map(inv => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => setSelectedInvoiceId(inv.id)}
                    className="w-full bg-white rounded-xl px-4 py-3 shadow-xs flex items-center justify-between text-left cursor-pointer hover:bg-gray-50/70 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {INTERVENANT_LABELS[inv.intervenant_type as IntervenantType] ?? inv.intervenant_type ?? '—'}
                      </p>
                      <p className="text-[11px] text-gray-400">{formatDateOnlyFr(inv.invoice_date)}</p>
                    </div>
                    <span className="text-sm font-bold text-gray-700 flex-shrink-0">{formatEuro(inv.total_ttc)}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {selectedInvoiceId && (
        <InvoiceDetailSheet
          invoiceId={selectedInvoiceId}
          horses={horses}
          onClose={() => setSelectedInvoiceId(null)}
          onSaved={() => {
            setSelectedInvoiceId(null)
            fetchData()
          }}
        />
      )}
    </div>
  )
}
