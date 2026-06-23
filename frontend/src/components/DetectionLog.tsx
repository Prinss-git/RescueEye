import { AnimatePresence, motion } from 'framer-motion'

export interface Detection {
  id:               string
  class:            string
  confidence:       number
  bbox:             [number, number, number, number]
  timestamp:        string
  feed?:            string
  annotated_frame?: string
}

interface DetectionLogProps {
  detections:   Detection[]
  latestFrame?: string | null
  onClear?:     () => void
}

const CLASS_ACCENT: Record<string, string> = {
  person:            '#ff3b3b',
  life_sign:         '#ffdc00',
  fire_damage:       '#ff7700',
  flood_damage:      '#00d4ff',
  structural_damage: '#f59e0b',
}

const CLASS_LABEL: Record<string, string> = {
  person:            'CASUALTY',
  life_sign:         'CASUALTY · THERMAL',
  fire_damage:       'FIRE DAMAGE',
  flood_damage:      'FLOOD DAMAGE',
  structural_damage: 'STRUCTURAL DMG',
}

function confidenceLabel(c: number) {
  if (c >= 0.90) return { text: 'HIGH', color: '#ff3b3b' }
  if (c >= 0.70) return { text: 'MED',  color: '#f59e0b' }
  return            { text: 'LOW',  color: 'rgba(255,255,255,0.3)' }
}

export default function DetectionLog({ detections, latestFrame, onClear }: DetectionLogProps) {
  const reversed = [...detections].reverse()

  return (
    <div className="flex flex-col min-h-0 overflow-hidden rounded-lg h-full"
      style={{ background: '#0d1220', border: '1px solid rgba(255,255,255,0.07)' }}>

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2"
        style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span className="font-mono text-[9px] font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
          CASUALTY LOG
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded font-bold"
            style={detections.length > 0
              ? { background: 'rgba(255,59,59,0.15)', color: '#ff3b3b', border: '1px solid rgba(255,59,59,0.25)' }
              : { color: 'rgba(255,255,255,0.2)' }}>
            {detections.length} CASUALT{detections.length !== 1 ? 'IES' : 'Y'}
          </span>
          {onClear && detections.length > 0 && (
            <button onClick={onClear}
              className="font-mono text-[9px] tracking-wider transition-colors"
              style={{ color: 'rgba(255,255,255,0.2)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#00d4ff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}>
              CLEAR
            </button>
          )}
        </div>
      </div>

      {/* Latest frame thumbnail */}
      {latestFrame && (
        <div className="flex-shrink-0 px-2 pt-2">
          <img src={latestFrame} alt="latest detection"
            className="w-full rounded object-contain"
            style={{ maxHeight: '72px', border: '1px solid rgba(0,212,255,0.15)' }} />
        </div>
      )}

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {detections.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
            <div className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="5" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"/>
                <path d="M8 5v3.5M8 10.5v.5" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="font-mono text-[10px] tracking-wider" style={{ color: 'rgba(255,255,255,0.18)' }}>
              SCANNING FOR CASUALTIES
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {reversed.map((d) => {
              const accent   = CLASS_ACCENT[d.class] ?? '#ffffff44'
              const label    = CLASS_LABEL[d.class]  ?? d.class.toUpperCase()
              const conf     = Math.round(d.confidence * 100)
              const severity = confidenceLabel(d.confidence)
              return (
                <motion.div key={d.id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="rounded overflow-hidden"
                  style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)',
                    borderLeft: `2px solid ${accent}` }}>
                  <div className="px-2 py-2 flex flex-col gap-1.5">
                    {/* Top row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] font-bold tracking-wider" style={{ color: accent }}>
                          {label}
                        </span>
                        <span className="font-mono text-[8px] font-bold px-1 py-0.5 rounded"
                          style={{ background: `${severity.color}18`, color: severity.color, border: `1px solid ${severity.color}33` }}>
                          {severity.text}
                        </span>
                      </div>
                      <span className="font-mono text-[9px] tabular-nums" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {d.timestamp}
                      </span>
                    </div>

                    {/* Confidence bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-full overflow-hidden" style={{ height: '2px', background: 'rgba(255,255,255,0.08)' }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${conf}%`, background: accent, boxShadow: `0 0 4px ${accent}88` }} />
                      </div>
                      <span className="font-mono text-[9px] font-bold tabular-nums" style={{ color: accent }}>{conf}%</span>
                    </div>

                    {/* Bottom row */}
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                        {d.bbox[0]},{d.bbox[1]} · {d.bbox[2]}×{d.bbox[3]}px
                      </span>
                      {d.feed && (
                        <span className="font-mono text-[8px] px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(0,212,255,0.07)', color: 'rgba(0,212,255,0.5)',
                            border: '1px solid rgba(0,212,255,0.12)' }}>
                          {d.feed}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
