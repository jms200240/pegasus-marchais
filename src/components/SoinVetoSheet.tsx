import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Horse } from '../lib/types'
import { CANONICAL_ORDER, HORSE_COLORS } from '../lib/types'
import { X, Stethoscope, Check } from 'lucide-react'

interface SoinVetoSheetProps {
  horses: Horse[]
  defaultVisitedAt: string // ISO
  defaultVeterinarian?: string | null
  onClose: () => void
  onSaved: () => void
}

function toDateInput(iso: string): string {
  return iso.slice(0, 10)
}

export default function SoinVetoSheet({
  horses,
  defaultVisitedAt,
  defaultVeterinarian,
  onClose,
  onSaved,
}: SoinVetoSheetProps) {
  const [visitedAt, setVisitedAt] = useState(() => {
    const d = new Date(defaultVisitedAt)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  })
  const [soin, setSoin] = useState('')
  const [selectedHorseIds, setSelectedHorseIds] = useState<Set<string>>(new Set())
  const [comment, setComment] = useState('')
  const [rappelActive, setRappelActive] = useState(false)
  const [reminderDate, setReminderDate] = useState('')
  const [reminderText, setReminderText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sortedHorses = [...horses].sort((a, b) => {
    const ia = CANONICAL_ORDER.indexOf(a.name as typeof CANONICAL_ORDER[number])
    const ib = CANONICAL_ORDER.indexOf(b.name as typeof CANONICAL_ORDER[number])
    if (ia === -1 && ib === -1) return a.name.localeCompare(b.name)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })

  const allSelected = horses.length > 0 && selectedHorseIds.size === horses.length

  function toggleHorse(id: string) {
    setSelectedHorseIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelectedHorseIds(allSelected ? new Set() : new Set(horses.map(h => h.id)))
  }

  async function handleSave() {
    if (!soin.trim()) {
      setError('Renseignez le soin.')
      return
    }
    if (selectedHorseIds.size === 0) {
      setError('Sélectionnez au moins un cheval.')
      return
    }
    if (rappelActive && (!reminderDate || !reminderText.trim())) {
      setError('Renseignez la date et le texte du rappel.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const visitedAtISO = new Date(visitedAt).toISOString()
      const noteSuffix = defaultVeterinarian ? ` (visite Vétérinaire — ${defaultVeterinarian})` : ' (visite Vétérinaire)'
      const note = soin.trim() + (comment.trim() ? ` — ${comment.trim()}` : '') + noteSuffix

      const rows = Array.from(selectedHorseIds).map(horseId => ({
        horse_id: horseId,
        type: 'veterinaire' as const,
        status: 'closed' as const,
        severity: 1,
        opened_at: visitedAtISO,
        closed_at: visitedAtISO,
        note,
        source: 'Famille',
      }))
      const { error: insertErr } = await supabase.from('health_events').insert(rows)
      if (insertErr) throw insertErr

      if (rappelActive) {
        const { error: reminderErr } = await supabase.from('soin_reminders').insert({
          visited_at: visitedAtISO,
          soin: soin.trim(),
          horse_ids: Array.from(selectedHorseIds),
          comment: comment.trim() || null,
          veterinarian: defaultVeterinarian ?? null,
          reminder_date: reminderDate,
          reminder_text: reminderText.trim(),
        })
        if (reminderErr) throw reminderErr
      }

      onSaved()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : JSON.stringify(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex justify-center bg-black/5">
      <div className="w-full max-w-[390px] bg-[#F6F2EC] flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0 border-b border-gray-200/60 bg-white/70 backdrop-blur-sm">
          <h2 className="text-base font-black text-gray-900">Soin véto</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* ── Contenu scrollable ── */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-32 pt-4 space-y-5">

          {/* ── Horodatage ── */}
          <section>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Horodatage
            </p>
            <input
              type="datetime-local"
              value={visitedAt}
              onChange={e => setVisitedAt(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700"
            />
          </section>

          {/* ── Soin ── */}
          <section>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Soin
            </p>
            <input
              type="text"
              value={soin}
              onChange={e => setSoin(e.target.value)}
              placeholder="Ex. Prise de sang, injection…"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700"
            />
          </section>

          {/* ── Chevaux ── */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Chevaux
              </p>
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs font-bold underline underline-offset-2 cursor-pointer"
                style={{ color: '#2f6b3f' }}
              >
                {allSelected ? 'Aucun' : 'Tous'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {sortedHorses.map(horse => {
                const isSelected = selectedHorseIds.has(horse.id)
                const color = horse.color_hex ?? HORSE_COLORS[horse.name] ?? '#2f6b3f'
                return (
                  <button
                    key={horse.id}
                    type="button"
                    onClick={() => toggleHorse(horse.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold cursor-pointer transition-all active:scale-[0.97] border-2"
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
          </section>

          {/* ── Commentaire ── */}
          <section>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Commentaire
            </p>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={3}
              placeholder="Observations, remarques…"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none text-gray-700"
            />
          </section>

          {/* ── Rappel ── */}
          <section>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={rappelActive}
                onChange={e => setRappelActive(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 accent-[#2f6b3f] cursor-pointer"
              />
              <span className="text-sm font-bold text-gray-800">Rappel</span>
            </label>

            {rappelActive && (
              <div className="mt-3 bg-white rounded-xl shadow-xs p-3 space-y-3">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Date du rappel
                  </p>
                  <input
                    type="date"
                    value={reminderDate}
                    min={toDateInput(new Date().toISOString())}
                    onChange={e => setReminderDate(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Texte du rappel
                  </p>
                  <input
                    type="text"
                    value={reminderText}
                    onChange={e => setReminderText(e.target.value)}
                    placeholder="Ex. Prévoir un vermifuge"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-700"
                  />
                </div>
                <p className="text-[10px] text-gray-400">
                  Le rappel s'affichera dans la page Soins 7 jours avant la date indiquée.
                </p>
              </div>
            )}
          </section>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* ── Bouton Enregistrer (fixe en bas, au-dessus du BottomNav) ── */}
        <div
          className="flex-shrink-0 px-4 pt-3 bg-[#F6F2EC] border-t border-gray-200/60"
          style={{ paddingBottom: 'calc(1rem + 64px + env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 font-bold text-sm py-3 rounded-xl text-white shadow-sm active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: '#2f6b3f' }}
          >
            <Stethoscope className="w-4 h-4" />
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
