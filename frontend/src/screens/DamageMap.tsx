import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Popup, CircleMarker, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

type DamageType = 'victim_detected' | 'flood_damage' | 'structural_damage' | 'fire_damage' | 'all'

interface Incident {
  id:         string
  lat:        number
  lng:        number
  type:       Exclude<DamageType, 'all'>
  label:      string
  timestamp:  string
  confidence: number
  source:     'static' | 'live'
}

interface LiveDetection {
  id:         string
  class:      string
  confidence: number
  bbox:       { x: number; y: number; w: number; h: number }
  timestamp:  string
  lat:        number
  lng:        number
}

const STATIC_INCIDENTS: Incident[] = [
  { id: 'INC-001', lat: 10.3157, lng: 123.8854, type: 'victim_detected',   label: 'Victim detected — rooftop',              timestamp: '10:42:17', confidence: 0.91, source: 'static' },
  { id: 'INC-002', lat: 10.3092, lng: 123.8912, type: 'flood_damage',      label: 'Flood damage — Barangay Banilad',         timestamp: '10:45:03', confidence: 0.82, source: 'static' },
  { id: 'INC-003', lat: 10.3210, lng: 123.8798, type: 'structural_damage', label: 'Structural collapse — 3-storey bldg',     timestamp: '10:47:55', confidence: 0.87, source: 'static' },
  { id: 'INC-004', lat: 10.3045, lng: 123.8870, type: 'flood_damage',      label: 'Flood damage — Talamban Road',            timestamp: '10:51:20', confidence: 0.78, source: 'static' },
  { id: 'INC-005', lat: 10.3280, lng: 123.8940, type: 'victim_detected',   label: 'Victim detected — debris field',          timestamp: '10:53:44', confidence: 0.89, source: 'static' },
]

const TYPE_COLOR: Record<Exclude<DamageType, 'all'>, string> = {
  victim_detected:   '#ff3b3b',
  flood_damage:      '#00d4ff',
  structural_damage: '#f97316',
  fire_damage:       '#ff7700',
}

const TYPE_LABEL: Record<DamageType, string> = {
  all:               'All Types',
  victim_detected:   'Victim Detected',
  flood_damage:      'Flood Damage',
  structural_damage: 'Structural Damage',
  fire_damage:       'Fire Damage',
}

const LEGEND_TYPES = ['victim_detected', 'flood_damage', 'fire_damage', 'structural_damage'] as Exclude<DamageType, 'all'>[]

function classToType(cls: string): Exclude<DamageType, 'all'> {
  if (cls === 'person')            return 'victim_detected'
  if (cls === 'flood_damage')      return 'flood_damage'
  if (cls === 'fire_damage')       return 'fire_damage'
  return 'structural_damage'
}

function MapResizer() {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 200)
    return () => clearTimeout(t)
  }, [map])
  return null
}

function RecenterButton() {
  const map = useMap()
  return (
    <button
      onClick={() => map.setView([10.3157, 123.8854], 14)}
      className="absolute top-3 right-3 z-[1000] font-mono text-xs px-3 py-1.5 rounded border border-cyan/40 bg-navy/90 text-cyan hover:bg-cyan/10 transition-colors"
    >
      ⌖ RECENTER
    </button>
  )
}

// Pulsing ring for victim markers (CSS keyframe injected once)
const PULSE_STYLE = `
@keyframes markerPulse {
  0%   { r: 10; opacity: 0.8; }
  70%  { r: 22; opacity: 0; }
  100% { r: 22; opacity: 0; }
}
.victim-pulse circle { animation: markerPulse 1.5s ease-out infinite; }
`

function injectPulseStyle() {
  if (document.getElementById('victim-pulse-style')) return
  const style = document.createElement('style')
  style.id = 'victim-pulse-style'
  style.textContent = PULSE_STYLE
  document.head.appendChild(style)
}

export default function DamageMap() {
  const [filter, setFilter]         = useState<DamageType>('all')
  const [selected, setSelected]     = useState<Incident | null>(null)
  const [liveIncidents, setLive]    = useState<Incident[]>([])
  const [lastPoll, setLastPoll]     = useState<string>('—')
  const [pollError, setPollError]   = useState(false)
  const seenIds                     = useRef<Set<string>>(new Set())

  useEffect(() => { injectPulseStyle() }, [])

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch('/api/detections/recent?limit=20')
        if (!res.ok) throw new Error('non-ok')
        const data: { detections: LiveDetection[] } = await res.json()
        setPollError(false)
        setLastPoll(new Date().toLocaleTimeString('en-PH', { hour12: false }))

        const newItems: Incident[] = []
        for (const d of data.detections) {
          if (seenIds.current.has(d.id)) continue
          seenIds.current.add(d.id)
          newItems.push({
            id:         `LIVE-${d.id.slice(0, 8)}`,
            lat:        d.lat,
            lng:        d.lng,
            type:       classToType(d.class),
            label:      `${d.class} detected (live) — conf ${Math.round(d.confidence * 100)}%`,
            timestamp:  new Date(d.timestamp).toLocaleTimeString('en-PH', { hour12: false }),
            confidence: d.confidence,
            source:     'live',
          })
        }
        if (newItems.length > 0) setLive((prev) => [...prev, ...newItems].slice(-100))
      } catch {
        setPollError(true)
      }
    }
    poll()
    const t = setInterval(poll, 5000)
    return () => clearInterval(t)
  }, [])

  const allIncidents = [...STATIC_INCIDENTS, ...liveIncidents]
  const visible      = allIncidents.filter((i) => filter === 'all' || i.type === filter)

  // Count per type for legend badges
  const countByType = LEGEND_TYPES.reduce<Record<string, number>>((acc, t) => {
    acc[t] = allIncidents.filter((i) => i.type === t).length
    return acc
  }, {})

  return (
    <div className="h-full flex gap-4 p-4">

      {/* ── Map ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 panel overflow-hidden flex flex-col">
        <div className="panel-header flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>Damage Map — Cebu City AOI</span>
            <span className={`font-mono text-xs px-2 py-0.5 rounded border ${
              pollError
                ? 'text-alert border-alert/40 bg-alert/10'
                : 'text-green-400 border-green-400/30 bg-green-400/10'
            }`}>
              {pollError ? 'LIVE OFF' : 'LIVE ON'}
            </span>
            <span className="font-mono text-xs text-white/30 normal-case font-normal">
              last: {lastPoll}
            </span>
          </div>
          <div className="flex items-center gap-1 normal-case font-normal">
            {(['all', 'victim_detected', 'flood_damage', 'structural_damage', 'fire_damage'] as DamageType[]).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
                  filter === t
                    ? 'bg-cyan/20 text-cyan border border-cyan/40'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 relative">
          <MapContainer
            center={[10.3157, 123.8854]}
            zoom={14}
            style={{ height: '100%', width: '100%', background: '#0a0e1a' }}
          >
            <MapResizer />
            <RecenterButton />
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='<span style="color:#666">&copy; OpenStreetMap contributors</span>'
            />
            {visible.map((inc) => {
              const color  = TYPE_COLOR[inc.type]
              const isLive = inc.source === 'live'
              const isVictim = inc.type === 'victim_detected'
              return (
                <CircleMarker
                  key={inc.id}
                  center={[inc.lat, inc.lng]}
                  radius={isLive ? 10 : 13}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: isLive ? 0.55 : 0.72,
                    weight:      isLive ? 1 : 2,
                    dashArray:   isLive ? '4 2' : undefined,
                    className:   isVictim ? 'victim-pulse' : undefined,
                  }}
                  eventHandlers={{ click: () => setSelected(inc) }}
                >
                  <Popup>
                    <div style={{ fontFamily: 'monospace', fontSize: 11 }}>
                      <strong>{inc.id}</strong><br />
                      {inc.label}<br />
                      <span style={{ color: '#888' }}>{inc.timestamp}</span>
                      {isLive && <span style={{ color: '#00d4ff' }}> · LIVE</span>}
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}
          </MapContainer>
        </div>
      </div>

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <div className="w-72 flex flex-col gap-4">

        {/* Legend with counts */}
        <div className="panel p-4">
          <p className="panel-header -mx-4 -mt-4 mb-3 px-4 pt-2 pb-2 rounded-t-lg">Legend</p>
          <div className="space-y-2">
            {LEGEND_TYPES.map((t) => (
              <div key={t} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-3 h-3 rounded-full flex-shrink-0 ${t === 'victim_detected' ? 'animate-pulse' : ''}`}
                    style={{ background: TYPE_COLOR[t] }}
                  />
                  <span className="font-mono text-xs text-white/70">{TYPE_LABEL[t]}</span>
                </div>
                <span className={`font-mono text-xs font-bold ${
                  countByType[t] > 0 ? 'text-white' : 'text-white/20'
                }`}>
                  {countByType[t]}
                </span>
              </div>
            ))}
            <div className="border-t border-white/10 pt-2 mt-1 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full border border-dashed border-cyan flex-shrink-0" />
              <span className="font-mono text-xs text-white/40">Dashed = live detection</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="panel p-3 flex gap-3">
          {[
            { label: 'TOTAL', value: allIncidents.length, color: 'text-white' },
            { label: 'LIVE',  value: liveIncidents.length, color: 'text-cyan' },
            { label: 'SHOWN', value: visible.length, color: 'text-white/60' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex-1 text-center">
              <p className={`font-mono text-base font-bold ${color}`}>{value}</p>
              <p className="font-mono text-xs text-white/30">{label}</p>
            </div>
          ))}
        </div>

        {/* Incident list */}
        <div className="panel flex flex-col flex-1 min-h-0">
          <div className="panel-header">Incidents ({visible.length})</div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {visible.length === 0 && (
              <p className="font-mono text-xs text-white/30 text-center mt-8">
                — no active incidents detected —
              </p>
            )}
            {visible.map((inc) => (
              <button
                key={inc.id}
                onClick={() => setSelected(inc)}
                className={`w-full text-left p-2 rounded border transition-colors ${
                  selected?.id === inc.id
                    ? 'border-cyan/60 bg-cyan/10'
                    : 'border-white/5 bg-panel-light hover:border-cyan/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: TYPE_COLOR[inc.type] }} />
                  <span className="font-mono text-xs font-bold text-white">{inc.id}</span>
                  {inc.source === 'live' && (
                    <span className="font-mono text-xs text-cyan/60 border border-cyan/30 px-1 rounded">LIVE</span>
                  )}
                  <span className="ml-auto font-mono text-xs text-white/30">{inc.timestamp}</span>
                </div>
                <p className="font-mono text-xs text-white/60 pl-4 truncate">{inc.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Detail card */}
        {selected && (
          <div className="panel p-4 flex-shrink-0">
            <div className="flex justify-between items-start mb-3">
              <span className="font-mono text-xs font-bold text-cyan">{selected.id}</span>
              <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white font-mono text-xs">✕</button>
            </div>
            <p className="font-mono text-xs text-white/80 mb-2">{selected.label}</p>
            <div className="space-y-1">
              {[
                ['TYPE',   TYPE_LABEL[selected.type].toUpperCase(), TYPE_COLOR[selected.type]],
                ['CONF',   `${Math.round(selected.confidence * 100)}%`, '#ffffff'],
                ['COORDS', `${selected.lat.toFixed(4)}, ${selected.lng.toFixed(4)}`, '#ffffff99'],
                ['TIME',   selected.timestamp, '#ffffff'],
                ['SOURCE', selected.source.toUpperCase(), selected.source === 'live' ? '#00d4ff' : '#ffffff60'],
              ].map(([label, value, color]) => (
                <div key={label} className="flex justify-between">
                  <span className="font-mono text-xs text-white/40">{label}</span>
                  <span className="font-mono text-xs font-bold" style={{ color }}>{value}</span>
                </div>
              ))}
            </div>
            <a
              href="/coordination"
              className="btn-primary w-full text-xs mt-3 block text-center"
            >
              DISPATCH TEAM →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
