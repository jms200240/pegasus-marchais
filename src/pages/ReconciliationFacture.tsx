import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, Loader2, Check, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Horse } from '../lib/types'
import { HORSE_COLORS } from '../lib/types'
import {
  type IntervenantType,
  INTERVENANT_LABELS,
  formatEuro,
  round2,
  sortByCanonicalOrder,
} from '../lib/financeUtils'

/* ----------------------------------------------------------------------------
   Réconciliation OCR — Pegasus
   Lit invoices_staging (status='staging' côté invoices, ocr_status='done' côté
   staging), affecte chaque ligne à un ou plusieurs chevaux, écrit dans
   expenses, puis passe la facture en status='validated'.

   Taux de TVA : calculé dynamiquement par facture (total_ttc / total_ht des
   lignes), pas supposé — évite l'hypothèse fragile d'un taux fixe.
---------------------------------------------------------------------------- */

type LineType = 'soin' | 'deplacement' | 'frais_administratif'

type ExtractedLine = {
  acte_number: string
  acte_date: string
  designation: string
  montant_ht: number
  cheval_nom_court: string | null
  match_confidence: 'high' | 'low' | 'none'
  is_travel_line: boolean
  line_type: LineType
}

type StagingInvoice = {
  staging_id: string
  invoice_id: string
  invoice_number: string | null
  invoice_date: string
  intervenant_type: IntervenantType
  total_ttc: number
  totalHt: number
  tvaMultiplier: number // total_ttc / total_ht des lignes — dérivé, jamais supposé
  lines: ExtractedLine[]
}

// État local d'édition d'une ligne pendant la réconciliation
type LineEdit = {
  excluded: boolean
  horseId: string | null // pour line_type = "soin"
  sharerIds: string[] // pour line_type = "deplacement"
}

interface ReconciliationFactureProps {
  onBack: () => void
}

export default function ReconciliationFacture({ onBack }: ReconciliationFactureProps) {
  const [horses, setHorses] = useState<Horse[]>([])
  const [pending, setPending] = useState<StagingInvoice[]>([])
  const [selected, setSelected] = useState<StagingInvoice | null>(null)
  const [edits, setEdits] = useState<Record<number, LineEdit>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      setLoading(true)
      setError(null)

      const { data: horsesData, error: hErr } = await supabase
        .from('horses')
        .select('*')
        .eq('is_active', true)
      if (hErr) { setError(hErr.message); setLoading(false); return }
      setHorses(sortByCanonicalOrder((horsesData as Horse[]) ?? []))

      const { data: stagingData, error: sErr } = await supabase
        .from('invoices_staging')
        .select('id, invoice_id, lines_json, invoices(invoice_date, intervenant_type, total_ttc, status, invoice_number)')
        .eq('ocr_status', 'done')
      if (sErr) { setError(sErr.message); setLoading(false); return }

      const list: StagingInvoice[] = (stagingData || [])
        .filter((row: any) => row.invoices?.status === 'staging')
        .map((row: any) => {
          const lines = (row.lines_json as ExtractedLine[]) ?? []
          const totalHt = round2(lines.reduce((s, l) => s + l.montant_ht, 0))
          const totalTtc = Number(row.invoices.total_ttc)
          return {
            staging_id: row.id,
            invoice_id: row.invoice_id,
            invoice_number: row.invoices.invoice_number,
            invoice_date: row.invoices.invoice_date,
            intervenant_type: row.invoices.intervenant_type,
            total_ttc: totalTtc,
            totalHt,
            tvaMultiplier: totalHt > 0 ? totalTtc / totalHt : 1,
            lines,
          }
        })
      setPending(list)
      setLoading(false)
    })()
  }, [])

  // --- Quand on ouvre une facture : initialise l'état d'édition des lignes ---
  const openInvoice = (inv: StagingInvoice) => {
    setSelected(inv)
    setSuccessMessage(null)
    setError(null)

    const soinMatches = inv.lines
      .filter(l => l.line_type === 'soin' && l.match_confidence === 'high' && l.cheval_nom_court)
      .map(l => horses.find(h => h.name.toLowerCase() === l.cheval_nom_court!.toLowerCase())?.id)
      .filter((id): id is string => Boolean(id))
    const defaultSharers = Array.from(new Set(soinMatches))

    const init: Record<number, LineEdit> = {}
    inv.lines.forEach((l, idx) => {
      if (l.line_type === 'frais_administratif') {
        init[idx] = { excluded: true, horseId: null, sharerIds: [] }
      } else if (l.line_type === 'deplacement') {
        init[idx] = { excluded: false, horseId: null, sharerIds: defaultSharers }
      } else {
        const matched = l.match_confidence === 'high' && l.cheval_nom_court
          ? horses.find(h => h.name.toLowerCase() === l.cheval_nom_court!.toLowerCase())?.id ?? null
          : null
        init[idx] = { excluded: false, horseId: matched, sharerIds: [] }
      }
    })
    setEdits(init)
  }

  const setEdit = (idx: number, patch: Partial<LineEdit>) =>
    setEdits(e => ({ ...e, [idx]: { ...e[idx], ...patch } }))

  // --- Calcul des coûts par cheval (TTC, au taux dérivé de la facture) + contrôle ---
  const { costsByHorse, allocatedHt, excludedHt, allResolved, reconciles } = useMemo(() => {
    const m: Record<string, number> = {}
    horses.forEach(h => { m[h.id] = 0 })
    if (!selected) return { costsByHorse: m, allocatedHt: 0, excludedHt: 0, allResolved: false, reconciles: false }

    let allocated = 0
    let excluded = 0
    let resolved = true

    selected.lines.forEach((l, idx) => {
      const e = edits[idx]
      if (!e) { resolved = false; return }
      if (e.excluded) { excluded += l.montant_ht; return }
      if (l.line_type === 'soin') {
        if (!e.horseId) { resolved = false; return }
        m[e.horseId] = round2((m[e.horseId] || 0) + l.montant_ht * selected.tvaMultiplier)
        allocated += l.montant_ht
      } else if (l.line_type === 'deplacement') {
        if (!e.sharerIds.length) { resolved = false; return }
        const partHt = l.montant_ht / e.sharerIds.length
        e.sharerIds.forEach(hid => {
          m[hid] = round2((m[hid] || 0) + partHt * selected.tvaMultiplier)
        })
        allocated += l.montant_ht
      }
    })

    return {
      costsByHorse: m,
      allocatedHt: round2(allocated),
      excludedHt: round2(excluded),
      allResolved: resolved,
      reconciles: Math.abs(round2(allocated + excluded) - selected.totalHt) < 0.02,
    }
  }, [selected, edits, horses])

  // --- Validation : écrit dans expenses, passe la facture en 'validated' ---
  const handleValidate = async () => {
    if (!selected) return
    setSaving(true)
    setError(null)

    const rows: {
      horse_id: string
      expense_date: string
      intervenant_type: IntervenantType
      act_type: string
      amount_ttc: number
      invoice_id: string
      note: string | null
    }[] = []

    selected.lines.forEach((l, idx) => {
      const e = edits[idx]
      if (!e || e.excluded) return
      if (l.line_type === 'soin' && e.horseId) {
        rows.push({
          horse_id: e.horseId,
          expense_date: l.acte_date,
          intervenant_type: selected.intervenant_type,
          act_type: l.designation,
          amount_ttc: round2(l.montant_ht * selected.tvaMultiplier),
          invoice_id: selected.invoice_id,
          note: null,
        })
      } else if (l.line_type === 'deplacement' && e.sharerIds.length) {
        const partTtc = round2((l.montant_ht * selected.tvaMultiplier) / e.sharerIds.length)
        e.sharerIds.forEach(hid => {
          rows.push({
            horse_id: hid,
            expense_date: l.acte_date,
            intervenant_type: selected.intervenant_type,
            act_type: l.designation,
            amount_ttc: partTtc,
            invoice_id: selected.invoice_id,
            note: `Part de ${formatEuro(partTtc)} sur déplacement partagé (${e.sharerIds.length} chevaux)`,
          })
        })
      }
    })

    const { error: insErr } = await supabase.from('expenses').insert(rows)
    if (insErr) { setError(insErr.message); setSaving(false); return }

    const { error: updErr } = await supabase
      .from('invoices')
      .update({ status: 'validated' })
      .eq('id', selected.invoice_id)
    if (updErr) { setError(updErr.message); setSaving(false); return }

    setPending(p => p.filter(inv => inv.invoice_id !== selected.invoice_id))
    setSelected(null)
    setSuccessMessage('Facture réconciliée et enregistrée.')
    setSaving(false)
  }

  // ── Liste des factures en attente ──
  if (!selected) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="px-5 pt-5 pb-3 flex items-center gap-3">
          <button type="button" onClick={onBack} className="cursor-pointer text-gray-400 hover:text-gray-600">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">Réconciliation OCR</h1>
            <p className="text-xs text-gray-500 mt-0.5">Factures scannées en attente de ventilation</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6 space-y-3">
          {successMessage && (
            <p className="text-xs font-semibold bg-green-50 border border-green-200 rounded-lg px-3 py-2" style={{ color: '#2f6b3f' }}>
              {successMessage}
            </p>
          )}
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : pending.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-xs p-5 text-center text-sm text-gray-400">
              Aucune facture en attente de réconciliation.
            </div>
          ) : (
            pending.map(inv => (
              <button
                key={inv.staging_id}
                type="button"
                onClick={() => openInvoice(inv)}
                className="w-full bg-white rounded-2xl shadow-xs p-4 text-left cursor-pointer hover:bg-gray-50/70 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-800">{INTERVENANT_LABELS[inv.intervenant_type]}</p>
                  <p className="text-sm font-black" style={{ color: '#2f6b3f' }}>{formatEuro(inv.total_ttc)}</p>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {inv.invoice_date} · {inv.lines.length} ligne{inv.lines.length > 1 ? 's' : ''}
                  {inv.invoice_number ? ` · n° ${inv.invoice_number}` : ''}
                </p>
              </button>
            ))
          )}
        </div>
      </div>
    )
  }

  // ── Écran de réconciliation d'une facture ──
  return (
    <div className="flex-1 flex flex-col">
      <div className="px-5 pt-5 pb-3 flex items-center gap-3">
        <button type="button" onClick={() => setSelected(null)} className="cursor-pointer text-gray-400 hover:text-gray-600">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">Réconcilier la facture</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {INTERVENANT_LABELS[selected.intervenant_type]} · {selected.invoice_date} · {formatEuro(selected.totalHt)} HT
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6 space-y-3">
        {selected.lines.map((l, idx) => {
          const e = edits[idx]
          return (
            <div key={idx} className={`bg-white rounded-2xl shadow-xs p-4 space-y-2 ${e?.excluded ? 'opacity-50' : ''}`}>
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <p className={`text-sm font-bold text-gray-800 truncate ${e?.excluded ? 'line-through' : ''}`}>
                    {l.designation}
                  </p>
                  <p className="text-xs text-gray-400">{l.acte_date}</p>
                </div>
                <p className="text-sm font-black text-gray-700 flex-shrink-0">{formatEuro(l.montant_ht)} HT</p>
              </div>

              {l.line_type === 'frais_administratif' && (
                <p className="text-[11px] text-gray-400">Frais administratif — exclu automatiquement</p>
              )}

              {l.line_type === 'soin' && !e?.excluded && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    Affecter à
                    {l.match_confidence !== 'high' && (
                      <span className="inline-flex items-center gap-1 text-amber-600 normal-case font-semibold">
                        <AlertTriangle className="w-3 h-3" /> à vérifier
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {horses.map(h => {
                      const isSelected = e?.horseId === h.id
                      const color = h.color_hex ?? HORSE_COLORS[h.name] ?? '#2f6b3f'
                      return (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => setEdit(idx, { horseId: h.id })}
                          className="px-2.5 py-1.5 rounded-full text-[11px] font-bold cursor-pointer transition-all active:scale-[0.97] border-2"
                          style={
                            isSelected
                              ? { backgroundColor: color, borderColor: color, color: 'white' }
                              : { backgroundColor: 'white', borderColor: '#e5e7eb', color: '#4b5563' }
                          }
                        >
                          {h.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {l.line_type === 'deplacement' && !e?.excluded && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Répartir sur les chevaux vus ce jour-là
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {horses.map(h => {
                      const on = e?.sharerIds.includes(h.id) ?? false
                      const color = h.color_hex ?? HORSE_COLORS[h.name] ?? '#2f6b3f'
                      return (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => setEdit(idx, {
                            sharerIds: on ? e!.sharerIds.filter(x => x !== h.id) : [...(e?.sharerIds || []), h.id],
                          })}
                          className="px-2.5 py-1.5 rounded-full text-[11px] font-bold cursor-pointer transition-all active:scale-[0.97] border-2"
                          style={
                            on
                              ? { backgroundColor: color, borderColor: color, color: 'white' }
                              : { backgroundColor: 'white', borderColor: '#e5e7eb', color: '#4b5563' }
                          }
                        >
                          {h.name}
                        </button>
                      )
                    })}
                  </div>
                  {e && e.sharerIds.length > 0 && (
                    <p className="text-[11px] text-gray-400 mt-1.5">
                      {formatEuro(round2((l.montant_ht * selected.tvaMultiplier) / e.sharerIds.length))} TTC / cheval · {e.sharerIds.length} concerné{e.sharerIds.length > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* ── Coût par cheval + contrôle de réconciliation ── */}
        <section className="bg-white rounded-2xl shadow-xs p-5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Coût par cheval (TTC)</p>
          {horses.filter(h => costsByHorse[h.id] > 0).map(h => (
            <div key={h.id} className="flex justify-between text-sm py-1">
              <span className="text-gray-600">{h.name}</span>
              <span className="font-bold text-gray-800">{formatEuro(costsByHorse[h.id])}</span>
            </div>
          ))}
          <hr className="my-2 border-gray-100" />
          <div className="flex justify-between text-xs text-gray-500">
            <span>Affecté aux chevaux (HT)</span><span>{formatEuro(allocatedHt)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>Exclu (frais admin.)</span><span>{formatEuro(excludedHt)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-gray-800 mt-1">
            <span>Total facture (HT)</span><span>{formatEuro(selected.totalHt)}</span>
          </div>
          <p className="text-xs font-semibold mt-2" style={{ color: reconciles ? '#2f6b3f' : '#dc2626' }}>
            {reconciles ? '✓ Réconcilié au centime' : '⚠ Écart de réconciliation'}
          </p>
        </section>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="button"
          disabled={!allResolved || !reconciles || saving}
          onClick={handleValidate}
          className="w-full flex items-center justify-center gap-2 font-bold text-sm py-3.5 rounded-xl text-white shadow-sm active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-40"
          style={{ backgroundColor: '#2f6b3f' }}
        >
          {saving ? 'Enregistrement…' : (
            <>
              <Check className="w-4 h-4" /> Valider et enregistrer
            </>
          )}
        </button>
      </div>
    </div>
  )
}
