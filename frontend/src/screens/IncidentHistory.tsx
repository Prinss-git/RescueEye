import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  History, Search, MapPin, Radio, ShieldCheck,
  PersonStanding, Waves, Flame, Construction, TriangleAlert,
} from 'lucide-react'

const NAVY = '#0b2a4a'

type IncType = 'VICTIM_DETECTED' | 'FLOOD' | 'FIRE' | 'STRUCTURAL' | 'UNKNOWN'

interface Incident {
  id: string
  type: IncType
  severity: string
  status: string
  lat: number
  lng: number
  description: string
  droneCallsign: string | null
  verified: boolean
  verifiedAt: string | null
  createdAt: string
  resolvedAt: string | null
}

const TYPE_ICON: Record<IncType, typeof PersonStanding> = {
  VICTIM_DETECTED: PersonStanding, FLOOD: Waves, FIRE: Flame, STRUCTURAL: Construction, UNKNOWN: TriangleAlert,
}
const TYPE_LABEL: Record<IncType, string> = {
  VICTIM_DETECTED: 'Victim', FLOOD: 'Flood', FIRE: 'Fire', STRUCTURAL: 'Structural', UNKNOWN: 'Unknown',
}
const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: 'text-red-700 border-red-200 bg-red-50',
  HIGH:     'text-orange-700 border-orange-200 bg-orange-50',
  MEDIUM:   'text-amber-700 border-amber-200 bg-amber-50',
  LOW:      'text-slate-500 border-slate-200 bg-slate-50',
}

const TYPE_FILTERS: { key: IncType | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'VICTIM_DETECTED', label: 'Victim' },
  { key: 'FLOOD', label: 'Flood' },
  { key: 'FIRE', label: 'Fire' },
  { key: 'STRUCTURAL', label: 'Structural' },
]

export default function IncidentHistory() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<IncType | 'ALL'>('ALL')

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/server/incidents?status=RESOLVED')
      if (res.ok) setIncidents(await res.json())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 8000)
    return () => clearInterval(t)
  }, [refresh])

  const filtered = useMemo(() => {
    let list = incidents
    if (typeFilter !== 'ALL') list = list.filter((i) => i.type === typeFilter)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((i) =>
      i.id.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q) ||
      (i.droneCallsign ?? '').toLowerCase().includes(q))
    return list
  }, [incidents, typeFilter, search])

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm" style={{ background: NAVY }}>
          <History size={20} className="text-white" />
        </span>
        <div>
          <h1 className="text-lg font-bold text-slate-800">Incident History</h1>
          <p className="text-sm text-slate-400">Resolved incidents for after-action review</p>
        </div>
      </motion.div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1.5">
          {TYPE_FILTERS.map((t) => (
            <button key={t.key} onClick={() => setTypeFilter(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                typeFilter === t.key ? 'text-white' : 'text-slate-500 border border-slate-200 hover:bg-slate-50'
              }`}
              style={typeFilter === t.key ? { background: NAVY } : undefined}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input-field text-sm py-2 pl-9" placeholder="Search resolved incidents…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="panel-header">Resolved ({filtered.length})</div>
        <div className="divide-y divide-slate-100">
          {loading && <p className="text-sm text-slate-400 text-center py-10">Loading…</p>}
          {!loading && filtered.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-10">— no resolved incidents —</p>
          )}
          {filtered.map((inc, i) => {
            const Icon = TYPE_ICON[inc.type]
            return (
              <motion.div key={inc.id}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: Math.min(i * 0.02, 0.3) }}
                className="flex items-center gap-4 px-4 py-3 hover:bg-surface-alt transition-colors">
                <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${NAVY}0f`, color: NAVY }}>
                  <Icon size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{TYPE_LABEL[inc.type]}</span>
                    <span className={`badge ${SEVERITY_STYLE[inc.severity]}`}>{inc.severity}</span>
                    {inc.verified && (
                      <span className="badge border-emerald-200 text-emerald-700 bg-emerald-50 gap-1"><ShieldCheck size={10} />Verified</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    {inc.droneCallsign && <span className="inline-flex items-center gap-1"><Radio size={11} />{inc.droneCallsign}</span>}
                    <span className="inline-flex items-center gap-1"><MapPin size={11} />{inc.lat.toFixed(4)}, {inc.lng.toFixed(4)}</span>
                    <span className="font-mono text-slate-400/80">{inc.id}</span>
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-medium text-slate-600">Resolved</p>
                  <p className="text-xs text-slate-400">{inc.resolvedAt ? new Date(inc.resolvedAt).toLocaleString() : '—'}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
