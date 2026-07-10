import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronDown, X, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Horse, GroomVisit, Invoice } from '../lib/types'
import {
  sortByCanonicalOrder,
  equalSplit,
  splitTtcByShares,
  formatEuro,
  round2,
  todayYmd,
  ymKey,
  monthLabelFr,
  weekdayDateFr,
  groupUnsettledGroomVisits,
  type UnsettledGroomPeriod,
} from '../lib/financeUtils'
import { LineVentilation, isSharesValid } from '../components/LineVentilation'

export default function GroomSettlement({ onBack }: { onBack: () => void }) {
  const [horses, setHorses] = useState<Horse[]>([])
  const [unsettled, setUnsettled] = useState<UnsettledGroomPeriod[]>([])
  const [settledInvoices, setSettledInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({})

  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [horseShares, setHorseShares] = useState<Record<string, Record<string, number>>>({})
  const [autreLabel, setAutreLabel] = useState<Record<string, string>>({})

  const [pendingConfirmYm, setPendingConfirmYm] = useState<string | null>(null)
  const [ventilatingYm, setVentilatingYm] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function fetchData() {
    setLoading(true)
    try {
      const [
        { data: horsesData, error: horsesErr },
        { data: visitsData, error: visitsErr },
        { data: invoicesData, error: invoicesErr },
        { data: paidMonthsData, error: paidMonthsErr },
      ] = await Promise.all([
        supabase.from('horses').select('*').eq('is_active', true),
        supabase.from('groom_visits').select('*').eq('is_paid', false),
        supabase.from('invoices').select('*').eq('intervenant_type', 'groom').order('invoice_date', { ascending: false }),
        supabase.from('groom_visits').select('paid_month').eq('is_paid', true),
      ])
      if (horsesErr) throw horsesErr
      if (visitsErr) throw visitsErr
      if (invoicesErr) throw invoicesErr
      if (paidMonthsErr) throw paidMonthsErr

      const activeHorses = sortByCanonicalOrder((horsesData as Horse[]) ?? [])
      setHorses(activeHorses)
      setSettledInvoices((invoicesData as Invoice[]) ?? [])

      const usedPeriods = new Set(
        ((paidMonthsData as Pick<GroomVisit, 'paid_month'>[]) ?? [])
          .map(v => v.paid_month)
          .filter((v): v is string => !!v)
      )
      const months = groupUnsettledGroomVisits((visitsData as GroomVisit[]) ?? [], usedPeriods)

      setUnsettled(months)
      setAmounts(prev => {
        const next = { ...prev }
        months.forEach(m => { if (next[m.ym] === undefined) next[m.ym] = String(m.proposedAmount) })
        return next
      })
      setHorseShares(prev => {
        const next = { ...prev }
        months.forEach(m => { if (!next[m.ym]) next[m.ym] = equalSplit(activeHorses.map(h => h.id)) })
        return next
      })
      setAutreLabel(prev => {
        const next = { ...prev }
        months.forEach(m => { if (next[m.ym] === undefined) next[m.ym] = '' })
        return next
      })
    } catch (err) {
      console.error('Erreur chargement règlement groom:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  function openVentilation(ym: string) {
    const isFinished = ym < ymKey(todayYmd())
    if (!isFinished) {
      setPendingConfirmYm(ym)
      return
    }
    setVentilatingYm(ym)
  }

  function toggleHorse(ym: string, horseId: string) {
    setHorseShares(prev => {
      const included = Object.keys(prev[ym] ?? {})
      const nextIncluded = included.includes(horseId) ? included.filter(id => id !== horseId) : [...included, horseId]
      return { ...prev, [ym]: equalSplit(nextIncluded) }
    })
  }

  function clearHorses(ym: string) {
    setHorseShares(prev => ({ ...prev, [ym]: {} }))
  }

  function updateShare(ym: string, horseId: string, value: number) {
    setHorseShares(prev => ({ ...prev, [ym]: { ...prev[ym], [horseId]: isNaN(value) ? 0 : value } }))
  }

  async function handleMarkPaid(month: UnsettledGroomPeriod) {
    const amount = round2(parseFloat(amounts[month.ym] ?? '0') || 0)
    const shares = horseShares[month.ym] ?? {}
    if (amount <= 0 || !isSharesValid(shares, amount) || saving) return

    setSaving(month.ym)
    setError(null)
    try {
      const notes = `Groom — ${monthLabelFr(month.ym)} (${month.days} jour${month.days > 1 ? 's' : ''})`

      // 1. On marque les visites soldées en premier — si l'étape facture échoue,
      // on les repasse en non soldé pour permettre un nouvel essai sans créer
      // de facture en double.
      const { error: visitsErr } = await supabase
        .from('groom_visits')
        .update({ is_paid: true, paid_at: new Date().toISOString(), paid_month: month.ym })
        .in('id', month.visitIds)
      if (visitsErr) throw visitsErr

      try {
        const perHorse = splitTtcByShares(amount, shares)

        const { data: invoiceRow, error: invErr } = await supabase
          .from('invoices')
          .insert({
            invoice_date: `${month.ym}-01`,
            intervenant_type: 'groom',
            total_ttc: amount,
            status: 'validated',
            photo_url: null,
            notes,
          })
          .select()
          .single()
        if (invErr) throw invErr

        const expenseRows = Object.entries(perHorse)
          .filter(([horseId, v]) => horseId !== '__autre__' && v > 0)
          .map(([horseId, v]) => ({
            horse_id: horseId,
            expense_date: `${month.ym}-01`,
            intervenant_type: 'groom',
            amount_ttc: v,
            note: notes,
            invoice_id: invoiceRow.id,
          }))

        const { error: expErr } = await supabase.from('expenses').insert(expenseRows)
        if (expErr) {
          await supabase.from('invoices').delete().eq('id', invoiceRow.id)
          throw expErr
        }
      } catch (innerErr) {
        await supabase
          .from('groom_visits')
          .update({ is_paid: false, paid_at: null, paid_month: '' })
          .in('id', month.visitIds)
        throw innerErr
      }

      setVentilatingYm(null)
      await fetchData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.")
    } finally {
      setSaving(null)
    }
  }

  const ventilatingMonth = unsettled.find(m => m.ym === ventilatingYm) ?? null

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-5 pt-5 pb-3 flex items-center gap-3">
        <button type="button" onClick={onBack} className="cursor-pointer text-gray-400 hover:text-gray-600">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">Paiement Groom</h1>
          <p className="text-xs text-gray-500 mt-0.5">Jours travaillés, règlement mensuel</p>
        </div>
      </div>

      <div className="flex-1 px-4 pb-6 space-y-3 overflow-y-auto no-scrollbar">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-10">Chargement...</p>
        ) : unsettled.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xs p-5 text-center">
            <p className="text-sm font-semibold text-gray-700">Aucune visite enregistrée</p>
            <p className="text-xs text-gray-400 mt-0.5">Le compteur du mois apparaîtra dès la 1ère visite.</p>
          </div>
        ) : (
          unsettled.map(month => {
            const daysOpen = expandedDays[month.ym] ?? false
            const isPending = pendingConfirmYm === month.ym
            return (
              <section key={month.ym} className="bg-white rounded-2xl shadow-xs p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-800">{monthLabelFr(month.ym)}</p>
                    <p className="text-xs text-gray-400">{month.days} jour{month.days > 1 ? 's' : ''} travaillé{month.days > 1 ? 's' : ''}</p>
                  </div>
                </div>

                <label className="block">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Montant TTC</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amounts[month.ym] ?? ''}
                    onChange={e => setAmounts(prev => ({ ...prev, [month.ym]: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold"
                  />
                </label>

                <div className="rounded-xl border border-gray-100 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedDays(prev => ({ ...prev, [month.ym]: !daysOpen }))}
                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 cursor-pointer"
                  >
                    <span className="text-[11px] font-bold text-gray-500">Jours du mois</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${daysOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {daysOpen && (
                    <div className="divide-y divide-gray-50">
                      {month.visitDates.map(d => (
                        <p key={d} className="px-3 py-1.5 text-xs text-gray-600">{weekdayDateFr(d)}</p>
                      ))}
                    </div>
                  )}
                </div>

                {isPending && (
                  <div className="rounded-xl bg-amber-50 border border-amber-300 p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs font-semibold text-amber-700">
                        Le mois n'est pas terminé, souhaitez-vous cependant solder le mois ?
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPendingConfirmYm(null)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-bold text-gray-500 bg-white border border-gray-200 cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={() => { setVentilatingYm(month.ym); setPendingConfirmYm(null) }}
                        className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white bg-amber-600 cursor-pointer"
                      >
                        Oui, continuer
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => openVentilation(month.ym)}
                  className="w-full py-2.5 rounded-xl font-bold text-sm text-white cursor-pointer"
                  style={{ backgroundColor: '#2f6b3f' }}
                >
                  À ventiler
                </button>
              </section>
            )
          })
        )}

        {settledInvoices.length > 0 && (
          <section className="bg-white rounded-2xl shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={() => setHistoryOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 cursor-pointer"
            >
              <span className="text-xs font-bold text-gray-600">Historique des règlements ({settledInvoices.length})</span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
            </button>
            {historyOpen && (
              <div className="divide-y divide-gray-100">
                {settledInvoices.map(inv => (
                  <div key={inv.id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-700">{monthLabelFr(ymKey(inv.invoice_date))}</p>
                      <p className="text-xs font-bold text-gray-800">{formatEuro(inv.total_ttc)}</p>
                    </div>
                    {inv.notes && <p className="text-[10px] text-gray-400 mt-0.5">{inv.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* ── Popup ventilation ── */}
      {ventilatingMonth && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40" onClick={() => setVentilatingYm(null)}>
          <div
            className="w-full max-w-[390px] bg-white rounded-t-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto no-scrollbar"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-800">Ventilation — {monthLabelFr(ventilatingMonth.ym)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatEuro(round2(parseFloat(amounts[ventilatingMonth.ym] ?? '0') || 0))}</p>
              </div>
              <button type="button" onClick={() => setVentilatingYm(null)} className="cursor-pointer text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <LineVentilation
              horses={horses}
              ventilationMode="multiple"
              singleHorseName={null}
              horseShares={horseShares[ventilatingMonth.ym] ?? {}}
              autreLabel={autreLabel[ventilatingMonth.ym] ?? ''}
              ttc={round2(parseFloat(amounts[ventilatingMonth.ym] ?? '0') || 0)}
              onToggleHorse={horseId => toggleHorse(ventilatingMonth.ym, horseId)}
              onClearAll={() => clearHorses(ventilatingMonth.ym)}
              onShareChange={(horseId, value) => updateShare(ventilatingMonth.ym, horseId, value)}
              onAutreLabelChange={value => setAutreLabel(prev => ({ ...prev, [ventilatingMonth.ym]: value }))}
            />

            {error && <p className="text-xs text-red-600 text-center">{error}</p>}

            <button
              type="button"
              onClick={() => handleMarkPaid(ventilatingMonth)}
              disabled={saving === ventilatingMonth.ym || !isSharesValid(horseShares[ventilatingMonth.ym] ?? {}, round2(parseFloat(amounts[ventilatingMonth.ym] ?? '0') || 0))}
              className="w-full py-2.5 rounded-xl font-bold text-sm text-white cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: '#2f6b3f' }}
            >
              {saving === ventilatingMonth.ym ? 'Enregistrement...' : 'Solder ce mois'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
