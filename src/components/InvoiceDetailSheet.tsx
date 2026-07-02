import { useEffect, useState } from 'react'
import { X, Plus, Trash2, Loader2, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Horse, Invoice, Expense } from '../lib/types'
import { HORSE_COLORS } from '../lib/types'
import {
  type IntervenantType,
  INTERVENANT_LABELS,
  INTERVENANT_ORDER,
  formatEuro,
  formatDateOnlyFr,
  round2,
} from '../lib/financeUtils'

interface EditableRow {
  localId: string
  dbId: string | null // null = nouvelle ligne pas encore en base
  horseId: string
  amountTtc: string
  note: string
}

interface InvoiceDetailSheetProps {
  invoiceId: string
  horses: Horse[]
  onClose: () => void
  onSaved: () => void
}

export default function InvoiceDetailSheet({ invoiceId, horses, onClose, onSaved }: InvoiceDetailSheetProps) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mode, setMode] = useState<'view' | 'edit'>('view')

  const [invoiceDate, setInvoiceDate] = useState('')
  const [intervenantType, setIntervenantType] = useState<IntervenantType | null>(null)
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<EditableRow[]>([])
  const [deletedIds, setDeletedIds] = useState<string[]>([])

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function loadInvoice() {
    setLoading(true)
    setLoadError(null)
    const [{ data: invoiceData, error: invErr }, { data: expensesData, error: expErr }] = await Promise.all([
      supabase.from('invoices').select('*').eq('id', invoiceId).single(),
      supabase.from('expenses').select('*').eq('invoice_id', invoiceId).order('created_at', { ascending: true }),
    ])
    if (invErr || expErr) {
      setLoadError(invErr?.message ?? expErr?.message ?? 'Erreur de chargement.')
      setLoading(false)
      return
    }
    const invoice = invoiceData as Invoice
    setInvoiceDate(invoice.invoice_date)
    setIntervenantType((invoice.intervenant_type as IntervenantType) ?? null)
    setNotes(invoice.notes ?? '')
    setDeletedIds([])
    setRows(
      ((expensesData as Expense[]) ?? []).map(e => ({
        localId: crypto.randomUUID(),
        dbId: e.id,
        horseId: e.horse_id ?? '',
        amountTtc: String(e.amount_ttc),
        note: e.note ?? '',
      }))
    )
    setLoading(false)
  }

  useEffect(() => {
    loadInvoice()
  }, [invoiceId]) // eslint-disable-line react-hooks/exhaustive-deps

  function cancelEdit() {
    setSaveError(null)
    setMode('view')
    loadInvoice()
  }

  function updateRow(localId: string, patch: Partial<EditableRow>) {
    setRows(prev => prev.map(r => (r.localId === localId ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRows(prev => [
      ...prev,
      { localId: crypto.randomUUID(), dbId: null, horseId: horses[0]?.id ?? '', amountTtc: '', note: '' },
    ])
  }

  function removeRow(localId: string) {
    setRows(prev => {
      const row = prev.find(r => r.localId === localId)
      if (row?.dbId) setDeletedIds(ids => [...ids, row.dbId as string])
      return prev.filter(r => r.localId !== localId)
    })
  }

  const totalTtc = round2(
    rows.reduce((sum, r) => {
      const amount = parseFloat(r.amountTtc)
      return sum + (isNaN(amount) ? 0 : amount)
    }, 0)
  )

  const rowsValid = rows.length > 0 && rows.every(r => {
    const amount = parseFloat(r.amountTtc)
    return r.horseId !== '' && !isNaN(amount) && amount > 0 && r.note.trim() !== ''
  })
  const canSave = invoiceDate !== '' && intervenantType !== null && rowsValid && !saving

  async function handleSave() {
    if (!canSave || !intervenantType) return
    setSaving(true)
    setSaveError(null)
    try {
      const { error: invErr } = await supabase
        .from('invoices')
        .update({
          invoice_date: invoiceDate,
          intervenant_type: intervenantType,
          notes: notes.trim() || null,
          total_ttc: totalTtc,
        })
        .eq('id', invoiceId)
      if (invErr) throw invErr

      if (deletedIds.length > 0) {
        const { error: delErr } = await supabase.from('expenses').delete().in('id', deletedIds)
        if (delErr) throw delErr
      }

      const existingRows = rows.filter(r => r.dbId !== null)
      for (const row of existingRows) {
        const { error: updErr } = await supabase
          .from('expenses')
          .update({
            horse_id: row.horseId,
            expense_date: invoiceDate,
            intervenant_type: intervenantType,
            amount_ttc: round2(parseFloat(row.amountTtc)),
            note: row.note.trim(),
          })
          .eq('id', row.dbId as string)
        if (updErr) throw updErr
      }

      const newRows = rows.filter(r => r.dbId === null)
      if (newRows.length > 0) {
        const { error: insErr } = await supabase.from('expenses').insert(
          newRows.map(row => ({
            horse_id: row.horseId,
            expense_date: invoiceDate,
            intervenant_type: intervenantType,
            amount_ttc: round2(parseFloat(row.amountTtc)),
            invoice_id: invoiceId,
            note: row.note.trim(),
          }))
        )
        if (insErr) throw insErr
      }

      onSaved()
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex justify-center bg-black/5">
      <div className="w-full max-w-[390px] bg-[#F6F2EC] flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0 border-b border-gray-200/60 bg-white/70 backdrop-blur-sm">
          <h2 className="text-base font-black text-gray-900">Facture</h2>
          <div className="flex items-center gap-2">
            {!loading && !loadError && mode === 'view' && (
              <button
                type="button"
                onClick={() => setMode('edit')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all border-2"
                style={{ borderColor: '#bfe0c9', backgroundColor: '#f0fbf4', color: '#2f6b3f' }}
              >
                <Pencil className="w-3.5 h-3.5" />
                Modifier
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : loadError ? (
          <div className="flex-1 flex items-center justify-center px-5">
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{loadError}</p>
          </div>
        ) : (
          <>
            {/* ── Contenu scrollable ── */}
            <div
              className="flex-1 overflow-y-auto no-scrollbar px-4 pt-4 space-y-5"
              style={{ paddingBottom: 'calc(1rem + 64px + env(safe-area-inset-bottom))' }}
            >
              {mode === 'view' ? (
                <>
                  <section className="space-y-3">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Date de la facture</p>
                      <p className="text-sm font-semibold text-gray-800">{formatDateOnlyFr(invoiceDate)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Intervenant</p>
                      <p className="text-sm font-semibold text-gray-800">
                        {intervenantType ? INTERVENANT_LABELS[intervenantType] : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Note</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{notes || '—'}</p>
                    </div>
                  </section>

                  <section className="space-y-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Dépenses par cheval</p>
                    {rows.map(row => {
                      const horse = horses.find(h => h.id === row.horseId)
                      const color = horse ? (horse.color_hex ?? HORSE_COLORS[horse.name] ?? '#2f6b3f') : '#9ca3af'
                      const amount = parseFloat(row.amountTtc)
                      return (
                        <div key={row.localId} className="bg-white rounded-xl shadow-xs px-4 py-3 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-bold truncate" style={{ color }}>{horse?.name ?? '—'}</p>
                            <p className="text-xs text-gray-500 truncate">{row.note || '—'}</p>
                          </div>
                          <span className="text-sm font-bold text-gray-700 flex-shrink-0">
                            {formatEuro(isNaN(amount) ? 0 : amount)}
                          </span>
                        </div>
                      )
                    })}
                  </section>

                  <section className="bg-white rounded-2xl shadow-xs p-5 text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total TTC</p>
                    <p className="text-3xl font-black" style={{ color: '#2f6b3f' }}>{formatEuro(totalTtc)}</p>
                  </section>
                </>
              ) : (
                <>
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
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Note</p>
                      <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={2}
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none text-gray-700"
                      />
                    </div>
                  </section>

                  <section className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Dépenses par cheval</p>
                      <button
                        type="button"
                        onClick={addRow}
                        className="flex items-center gap-1 text-xs font-bold underline underline-offset-2 cursor-pointer"
                        style={{ color: '#2f6b3f' }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Ajouter
                      </button>
                    </div>

                    {rows.map(row => {
                      const horse = horses.find(h => h.id === row.horseId)
                      const color = horse ? (horse.color_hex ?? HORSE_COLORS[horse.name] ?? '#2f6b3f') : '#9ca3af'
                      return (
                        <div key={row.localId} className="bg-white rounded-xl shadow-xs p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <select
                              value={row.horseId}
                              onChange={e => updateRow(row.localId, { horseId: e.target.value })}
                              className="flex-1 text-xs font-bold border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                              style={{ color }}
                            >
                              <option value="" disabled>Choisir un cheval</option>
                              {horses.map(h => (
                                <option key={h.id} value={h.id}>{h.name}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => removeRow(row.localId)}
                              className="text-gray-300 hover:text-red-500 cursor-pointer transition-colors flex-shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <input
                            type="text"
                            value={row.note}
                            onChange={e => updateRow(row.localId, { note: e.target.value })}
                            placeholder="Libellé"
                            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700"
                          />
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-400">TTC</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              value={row.amountTtc}
                              onChange={e => updateRow(row.localId, { amountTtc: e.target.value })}
                              className="flex-1 text-xs text-right border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700"
                            />
                            <span className="text-xs text-gray-400">€</span>
                          </div>
                        </div>
                      )
                    })}
                  </section>

                  <section className="bg-white rounded-2xl shadow-xs p-5 text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total TTC</p>
                    <p className="text-3xl font-black" style={{ color: '#2f6b3f' }}>{formatEuro(totalTtc)}</p>
                  </section>

                  {saveError && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={saving}
                      className="flex-1 py-3.5 rounded-xl text-sm font-bold text-gray-500 bg-gray-100 cursor-pointer disabled:opacity-40"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={!canSave}
                      className="flex-[2] flex items-center justify-center gap-2 font-bold text-sm py-3.5 rounded-xl text-white shadow-sm active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-40"
                      style={{ backgroundColor: '#2f6b3f' }}
                    >
                      {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
