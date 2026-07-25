import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Users, MapPin, Radio } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const NAVY = '#0b2a4a'

interface CurrentMission {
  id: string
  status: string
  incidentType: string | null
  incidentSeverity: string | null
}

interface Responder {
  uid: string
  displayName: string
  email: string
  active: boolean
  locationUpdatedAt: string | null
  lastLat: number | null
  lastLng: number | null
  currentMission: CurrentMission | null
}

const MISSION_STYLE: Record<string, string> = {
  ASSIGNED:  'text-amber-700 bg-amber-50 border-amber-200',
  ACCEPTED:  'text-cyan-700 bg-cyan-50 border-cyan-200',
  EN_ROUTE:  'text-amber-700 bg-amber-50 border-amber-200',
  ON_SITE:   'text-emerald-700 bg-emerald-50 border-emerald-200',
  TREATING:  'text-orange-700 bg-orange-50 border-orange-200',
}

function checkIn(iso: string | null): { label: string; dot: string; fresh: boolean } {
  if (!iso) return { label: 'Never checked in', dot: 'bg-slate-300', fresh: false }
  const min = (Date.now() - new Date(iso).getTime()) / 60_000
  const label = min < 1 ? 'Just now' : `${Math.round(min)} min ago`
  if (min <= 5)  return { label, dot: 'bg-emerald-500', fresh: true }
  if (min <= 30) return { label, dot: 'bg-amber-500', fresh: false }
  return { label, dot: 'bg-slate-300', fresh: false }
}

function StatTile({ label, count }: { label: string; count: number }) {
  return (
    <div className="panel p-4 flex-1">
      <span className="text-xs text-slate-400">{label}</span>
      <p className="text-3xl font-extrabold mt-1 tabular-nums" style={{ color: NAVY }}>{count}</p>
    </div>
  )
}

export default function Responders() {
  const { token } = useAuth()
  const [responders, setResponders] = useState<Responder[]>([])
  const [loading, setLoading] = useState(true)

  const authHeaders = useCallback((): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/server/command/responders', { headers: authHeaders() })
      if (res.ok) setResponders(await res.json())
    } finally { setLoading(false) }
  }, [authHeaders])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 5000)
    return () => clearInterval(t)
  }, [refresh])

  const onMission = useMemo(() => responders.filter((r) => r.currentMission).length, [responders])
  const available = useMemo(() => responders.filter((r) => r.active && !r.currentMission && checkIn(r.locationUpdatedAt).fresh).length, [responders])

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm" style={{ background: NAVY }}>
          <Users size={20} className="text-white" />
        </span>
        <div>
          <h1 className="text-lg font-bold text-slate-800">Responders</h1>
          <p className="text-sm text-slate-400">Live availability and deployment status of your field responders</p>
        </div>
      </motion.div>

      <div className="flex gap-3">
        <StatTile label="Total Responders" count={responders.length} />
        <StatTile label="Available Now" count={available} />
        <StatTile label="On Mission" count={onMission} />
      </div>

      <div className="panel overflow-hidden">
        <div className="panel-header">Roster ({responders.length})</div>
        <div className="p-3 grid grid-cols-2 gap-3">
          {loading && <p className="text-sm text-slate-400 text-center py-8 col-span-2">Loading…</p>}
          {!loading && responders.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8 col-span-2">— no field responders in your agency —</p>
          )}
          {responders.map((r, i) => {
            const c = checkIn(r.locationUpdatedAt)
            return (
              <motion.div key={r.uid}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: i * 0.04 }}
                className="p-4 rounded-lg border border-slate-200 bg-surface-alt">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800 truncate">{r.displayName}</span>
                      {!r.active && <span className="badge border-red-200 text-alert">Deactivated</span>}
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{r.email}</p>
                  </div>
                  {r.currentMission ? (
                    <span className={`badge ${MISSION_STYLE[r.currentMission.status] ?? 'border-slate-200 text-slate-500'}`}>
                      {r.currentMission.status.replace('_', ' ')}
                    </span>
                  ) : c.fresh && r.active ? (
                    <span className="badge border-emerald-200 text-emerald-700 bg-emerald-50">Available</span>
                  ) : (
                    <span className="badge border-slate-200 text-slate-400">Idle</span>
                  )}
                </div>

                <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${c.dot}`} /> {c.label}
                  </span>
                  {r.lastLat != null && r.lastLng != null && (
                    <span className="inline-flex items-center gap-1"><MapPin size={11} />{r.lastLat.toFixed(3)}, {r.lastLng.toFixed(3)}</span>
                  )}
                </div>

                {r.currentMission && (
                  <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-500">
                    <Radio size={12} className="text-slate-400" />
                    Responding to <span className="font-medium text-slate-700">{r.currentMission.incidentType?.replace('_', ' ').toLowerCase() ?? 'incident'}</span>
                    {r.currentMission.incidentSeverity && <span className="text-slate-400">· {r.currentMission.incidentSeverity}</span>}
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
