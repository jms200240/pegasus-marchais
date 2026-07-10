import { useEffect, useState } from 'react'
import { FileText, TrendingUp, Wallet, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Invoice, GroomVisit } from '../lib/types'
import { formatEuro, round2, yearBoundsYmd, groupUnsettledGroomVisits } from '../lib/financeUtils'
import SaisieFacture from './SaisieFacture'
import SuiviCouts from './SuiviCouts'
import GroomSettlement from './GroomSettlement'

type FinancesView = 'menu' | 'saisie' | 'suivi' | 'groom'

export default function Finances() {
  const [view, setView] = useState<FinancesView>('menu')
  const [totalYear, setTotalYear] = useState(0)
  const [loadingTotal, setLoadingTotal] = useState(true)
  const [unsettledGroomCount, setUnsettledGroomCount] = useState(0)

  useEffect(() => {
    // Ré-exécuté à chaque retour au menu (y compris après Saisie de facture),
    // pour ne jamais afficher un total resté figé depuis le montage initial.
    if (view !== 'menu') return
    async function fetchTotal() {
      const { first, last } = yearBoundsYmd()
      const { data } = await supabase
        .from('invoices')
        .select('total_ttc')
        .eq('status', 'validated')
        .gte('invoice_date', first)
        .lte('invoice_date', last)
      setTotalYear(round2(((data as Pick<Invoice, 'total_ttc'>[]) ?? []).reduce((s, i) => s + i.total_ttc, 0)))
      setLoadingTotal(false)
    }
    async function fetchGroomAlert() {
      const [{ data: visitsData }, { data: paidMonthsData }] = await Promise.all([
        supabase.from('groom_visits').select('*').eq('is_paid', false),
        supabase.from('groom_visits').select('paid_month').eq('is_paid', true),
      ])
      const usedPeriods = new Set(
        ((paidMonthsData as Pick<GroomVisit, 'paid_month'>[]) ?? []).map(v => v.paid_month).filter((v): v is string => !!v)
      )
      const months = groupUnsettledGroomVisits((visitsData as GroomVisit[]) ?? [], usedPeriods)
      setUnsettledGroomCount(months.length)
    }
    fetchTotal()
    fetchGroomAlert()
  }, [view])

  if (view === 'saisie') return <SaisieFacture onBack={() => setView('menu')} />
  if (view === 'suivi') return <SuiviCouts onBack={() => setView('menu')} />
  if (view === 'groom') return <GroomSettlement onBack={() => setView('menu')} />

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-5 pt-5 pb-3">
        <h1 className="text-2xl font-bold text-gray-900 leading-tight">Finances</h1>
        <p className="text-xs text-gray-500 mt-0.5">Factures &amp; suivi des coûts</p>
      </div>

      <div className="flex-1 px-4 pb-6 space-y-3">
        {!loadingTotal && (
          <section className="bg-white rounded-2xl shadow-xs p-5 text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Total TTC payé — {yearBoundsYmd().label}
            </p>
            <p className="text-3xl font-black" style={{ color: '#2f6b3f' }}>{formatEuro(totalYear)}</p>
          </section>
        )}

        <button
          type="button"
          onClick={() => setView('groom')}
          className="w-full bg-white rounded-2xl shadow-xs p-5 flex items-center gap-4 text-left cursor-pointer hover:bg-gray-50/70 transition-colors"
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: '#fdecea', color: '#C0392B' }}
          >
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800 flex items-center gap-2">
              Paiement Groom
              {unsettledGroomCount > 0 && (
                <span className="flex-shrink-0 flex items-center gap-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  <AlertCircle className="w-2.5 h-2.5" />
                  {unsettledGroomCount}
                </span>
              )}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Jours travaillés, règlement mensuel</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setView('suivi')}
          className="w-full bg-white rounded-2xl shadow-xs p-5 flex items-center gap-4 text-left cursor-pointer hover:bg-gray-50/70 transition-colors"
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: '#eef2ff', color: '#4A5FA0' }}
          >
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800">Suivi des coûts</p>
            <p className="text-xs text-gray-400 mt-0.5">Totaux, ventilation par cheval, historique</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setView('saisie')}
          className="w-full bg-white rounded-2xl shadow-xs p-5 flex items-center gap-4 text-left cursor-pointer hover:bg-gray-50/70 transition-colors"
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: '#f0fbf4', color: '#2f6b3f' }}
          >
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800">Saisie de facture</p>
            <p className="text-xs text-gray-400 mt-0.5">Enregistrer une facture et sa ventilation</p>
          </div>
        </button>
      </div>
    </div>
  )
}
