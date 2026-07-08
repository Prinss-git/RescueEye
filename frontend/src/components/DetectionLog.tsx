import { AnimatePresence, motion } from 'framer-motion'
import { Search } from 'lucide-react'

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
  person:            '#dc2626',
  life_sign:         '#ca8a04',
  fire_damage:       '#ea580c',
  flood_damage:      '#0e7490',
  structural_damage: '#d97706',
}

const CLASS_LABEL: Record<string, string> = {
  person:            'Casualty',
  life_sign:         'Casualty · Thermal',
  fire_damage:       'Fire Damage',
  flood_damage:      'Flood Damage',
  structural_damage: 'Structural Damage',
}

function confidenceLabel(c: number) {
  if (c >= 0.90) return { text: 'High', color: '#dc2626' }
  if (c >= 0.70) return { text: 'Med',  color: '#d97706' }
  return            { text: 'Low',  color: '#94a3b8' }
}

export default function DetectionLog({ detections, latestFrame, onClear }: DetectionLogProps) {
  const reversed = [...detections].reverse()

  return (
    <div className="panel flex flex-col min-h-0 overflow-hidden h-full">

      {/* Header */}
      <div className="panel-header flex items-center justify-between">
        <span>Casualty Log</span>
        <div className="flex items-center gap-2 normal-case font-normal">
          <span className="badge"
            style={detections.length > 0
              ? { background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' }
              : { color: '#94a3b8', borderColor: 'transparent' }}>
            {detections.length} Casualt{detections.length !== 1 ? 'ies' : 'y'}
          </span>
          {onClear && detections.length > 0 && (
            <button onClick={onClear}
              className="text-xs text-slate-400 hover:text-accent transition-colors">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Latest frame thumbnail */}
      {latestFrame && (
        <div className="flex-shrink-0 px-2 pt-2">
          <img src={latestFrame} alt="latest detection"
            className="w-full rounded object-contain border border-slate-200"
            style={{ maxHeight: '72px' }} />
        </div>
      )}

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {detections.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 border border-slate-200">
              <Search size={14} className="text-slate-300" />
            </div>
            <p className="text-xs text-slate-400">
              Scanning for casualties
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {reversed.map((d) => {
              const accent   = CLASS_ACCENT[d.class] ?? '#94a3b8'
              const label    = CLASS_LABEL[d.class]  ?? d.class
              const conf     = Math.round(d.confidence * 100)
              const severity = confidenceLabel(d.confidence)
              return (
                <motion.div key={d.id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="rounded-md overflow-hidden bg-slate-50 border border-slate-200"
                  style={{ borderLeft: `3px solid ${accent}` }}>
                  <div className="px-2 py-2 flex flex-col gap-1.5">
                    {/* Top row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium" style={{ color: accent }}>
                          {label}
                        </span>
                        <span className="text-[10px] font-medium px-1 py-0.5 rounded"
                          style={{ background: `${severity.color}18`, color: severity.color, border: `1px solid ${severity.color}33` }}>
                          {severity.text}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-slate-400">
                        {d.timestamp}
                      </span>
                    </div>

                    {/* Confidence bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-full overflow-hidden bg-slate-200" style={{ height: '3px' }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${conf}%`, background: accent }} />
                      </div>
                      <span className="text-[11px] font-mono font-semibold tabular-nums" style={{ color: accent }}>{conf}%</span>
                    </div>

                    {/* Bottom row */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-400">
                        {d.bbox[0]},{d.bbox[1]} · {d.bbox[2]}×{d.bbox[3]}px
                      </span>
                      {d.feed && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-tint text-accent border border-accent/20">
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
