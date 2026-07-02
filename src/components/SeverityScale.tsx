// Dégradé vert → rouge (1 = légère, 5 = urgente), cohérent avec la charte :
// vert et rouge repris de HORSE_COLORS (Hakéa / Échalote), ambre/orange en
// teintes intermédiaires assorties.
export const SEVERITY_COLORS = ['#27AE60', '#82C341', '#F2A93C', '#E8720C', '#C0392B']
export const SEVERITY_LABELS = ['', 'Légère', 'Modérée', 'Notable', 'Sérieuse', 'Urgente']

interface SeverityScaleProps {
  value: number
  onChange?: (value: number) => void
  size?: 'xs' | 'md'
  showLabel?: boolean
}

export default function SeverityScale({ value, onChange, size = 'md', showLabel = false }: SeverityScaleProps) {
  const clamped = Math.min(5, Math.max(1, Math.round(value)))
  const markerLeft = `${((clamped - 0.5) / 5) * 100}%`
  const barHeight = size === 'xs' ? 6 : 26
  const triangle = size === 'xs' ? 3 : 6
  const gap = size === 'xs' ? 1 : 3

  return (
    <div className={size === 'xs' ? 'inline-flex flex-col' : 'flex flex-col gap-1.5 w-full'}>
      <div className={`relative ${size === 'xs' ? 'w-10' : 'w-full'}`} style={{ paddingBottom: triangle + gap }}>
        <div className="flex rounded-full overflow-hidden" style={{ height: barHeight }}>
          {SEVERITY_COLORS.map((color, i) => {
            const level = i + 1
            return onChange ? (
              <button
                key={level}
                type="button"
                onClick={() => onChange(level)}
                aria-label={SEVERITY_LABELS[level]}
                className="flex-1 cursor-pointer"
                style={{ backgroundColor: color }}
              />
            ) : (
              <div key={level} className="flex-1" style={{ backgroundColor: color }} />
            )
          })}
        </div>
        <div
          className="absolute"
          style={{
            left: markerLeft,
            top: barHeight + gap,
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: `${triangle}px solid transparent`,
            borderRight: `${triangle}px solid transparent`,
            borderBottom: `${triangle + 1}px solid ${SEVERITY_COLORS[clamped - 1]}`,
          }}
        />
      </div>
      {showLabel && (
        <p className="text-sm font-bold text-center" style={{ color: SEVERITY_COLORS[clamped - 1] }}>
          {SEVERITY_LABELS[clamped]}
        </p>
      )}
    </div>
  )
}
