import { AnimatePresence, motion } from 'framer-motion'

export interface Detection {
  id:              string
  class:           string
  confidence:      number
  bbox:            [number, number, number, number]
  timestamp:       string
  feed?:           string
  annotated_frame?: string
}

interface DetectionLogProps {
  detections:   Detection[]
  latestFrame?: string | null
  onClear?:     () => void
}

const CLASS_COLORS: Record<string, string> = {
  person:             'text-alert',
  life_sign:          'text-yellow-300',
  fire_damage:        'text-orange-400',
  flood_damage:       'text-cyan',
  structural_damage:  'text-yellow-400',
}

export default function DetectionLog({ detections, latestFrame, onClear }: DetectionLogProps) {
  const reversed = [...detections].reverse()

  return (
    <div className="panel flex flex-col min-h-0 overflow-hidden">
      <div className="panel-header flex items-center justify-between">
        <span>Detection Log</span>
        <div className="flex items-center gap-2 normal-case font-normal">
          <span className="text-white/40 text-xs">
            {detections.length} event{detections.length !== 1 ? 's' : ''}
          </span>
          {onClear && detections.length > 0 && (
            <button
              onClick={onClear}
              className="text-xs font-mono text-white/30 hover:text-cyan/70 transition-colors"
            >
              CLEAR
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {latestFrame && (
          <img
            src={latestFrame}
            alt="latest detection"
            className="w-full rounded object-contain border border-cyan/20 mb-1"
            style={{ maxHeight: '70px' }}
          />
        )}
        {detections.length === 0 ? (
          <p className="text-white/30 text-xs font-mono text-center mt-8">
            — awaiting detections —
          </p>
        ) : (
          <AnimatePresence initial={false}>
            {reversed.map((d) => {
              const color = CLASS_COLORS[d.class] ?? 'text-cyan'
              const confidence = Math.round(d.confidence * 100)
              return (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="bg-panel-light border border-white/5 rounded p-2 flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-mono font-bold text-xs uppercase ${color}`}>
                      {d.class}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {d.feed && (
                        <span className="font-mono text-[9px] text-cyan/50 bg-cyan/10 px-1 rounded">
                          {d.feed}
                        </span>
                      )}
                      <span className="font-mono text-xs text-white/50">{d.timestamp}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white/10 rounded-full h-1">
                      <div
                        className="h-1 rounded-full bg-cyan transition-all duration-500"
                        style={{ width: `${confidence}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs text-white/60">{confidence}%</span>
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
