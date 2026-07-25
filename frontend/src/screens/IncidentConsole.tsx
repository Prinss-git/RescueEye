import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Siren, ShieldCheck, MapPin, Clock, X, CheckCircle2, Radio, Play, Square,
  PersonStanding, Waves, Flame, Construction, TriangleAlert,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const NAVY = '#0b2a4a'

interface Incident {
  id: string
  type: 'VICTIM_DETECTED' | 'FLOOD' | 'FIRE' | 'STRUCTURAL' | 'UNKNOWN'
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED'
  lat: number
  lng: number
  description: string
  droneCallsign: string | null
  verified: boolean
  isDrill: boolean
  createdAt: string
}

interface Mission {
  id: string
  incidentId: string
  status: string
  responderNames: string[]
  createdAt: string
}

const TYPE_ICON: Record<Incident['type'], typeof PersonStanding> = {
  VICTIM_DETECTED: PersonStanding,
  FLOOD:           Waves,
  FIRE:            Flame,
  STRUCTURAL:      Construction,
  UNKNOWN:         TriangleAlert,
}
const TYPE_LABEL: Record<Incident['type'], string> = {
  VICTIM_DETECTED: 'Victim', FLOOD: 'Flood', FIRE: 'Fire', STRUCTURAL: 'Structural', UNKNOWN: 'Unknown',
}
const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: 'text-red-700 border-red-200 bg-red-50',
  HIGH:     'text-orange-700 border-orange-200 bg-orange-50',
  MEDIUM:   'text-amber-700 border-amber-200 bg-amber-50',
  LOW:      'text-slate-500 border-slate-200 bg-slate-50',
}
const MISSION_STYLE: Record<string, string> = {
  ASSIGNED:  'text-amber-700 bg-amber-50 border-amber-200',
  ACCEPTED:  'text-cyan-700 bg-cyan-50 border-cyan-200',
  EN_ROUTE:  'text-amber-700 bg-amber-50 border-amber-200',
  ON_SITE:   'text-emerald-700 bg-emerald-50 border-emerald-200',
  TREATING:  'text-orange-700 bg-orange-50 border-orange-200',
  COMPLETED: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  DECLINED:  'text-slate-600 bg-slate-100 border-slate-200',
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return new Date(iso).toLocaleTimeString('en-PH', { hour12: false })
}

export default function IncidentConsole() {
  const { token } = useAuth()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [missions, setMissions]   = useState<Mission[]>([])
  const [drillActive, setDrill]   = useState(false)
  const [notice, setNotice]       = useState<string | null>(null)
  const [busyId, setBusyId]       = useState<string | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const authHeaders = useCallback((): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token])

  const refresh = useCallback(async () => {
    try {
      const [iRes, mRes, dRes] = await Promise.all([
        fetch('/server/incidents'),
        fetch('/server/command/missions', { headers: authHeaders() }),
        fetch('/server/drill/active'),
      ])
      if (iRes.ok) setIncidents(await iRes.json())
      if (mRes.ok) setMissions(await mRes.json())
      if (dRes.ok) { const d = await dRes.json(); setDrill(!!d?.active) }
    } catch {}
  }, [authHeaders])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 5000)
    return () => clearInterval(t)
  }, [refresh])

  function flash(msg: string) {
    setNotice(msg)
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), 5000)
  }

  const queue  = useMemo(() => incidents.filter((i) => !i.verified && i.status === 'OPEN'), [incidents])
  const active = useMemo(() => incidents.filter((i) => i.verified && i.status !== 'RESOLVED'), [incidents])
  const missionForIncident = useCallback(
    (incidentId: string) => missions.find((m) => m.incidentId === incidentId && m.status !== 'COMPLETED' && m.status !== 'DECLINED')
      ?? missions.find((m) => m.incidentId === incidentId) ?? null,
    [missions],
  )

  async function verify(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/server/incidents/${id}/verify`, { method: 'PATCH', headers: authHeaders() })
      if (res.ok) {
        const data = await res.json()
        flash(data.dispatchedTo
          ? `Verified — dispatched to ${data.dispatchedTo.displayName} (${data.dispatchedTo.distanceKm} km away)`
          : 'Verified — no responder with a known location available to dispatch')
      }
      await refresh()
    } finally { setBusyId(null) }
  }

  async function close(id: string, label: string) {
    setBusyId(id)
    try {
      await fetch(`/server/incidents/${id}/resolve`, { method: 'PATCH', headers: authHeaders() })
      flash(label)
      await refresh()
    } finally { setBusyId(null) }
  }

  async function toggleDrill() {
    await fetch(drillActive ? '/server/drill/stop' : '/server/drill/start', { method: 'POST', headers: authHeaders(), body: JSON.stringify({}) })
    refresh()
  }

  return (
    <div className="h-full overflow-hidden flex flex-col p-6 gap-5">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm" style={{ background: NAVY }}>
            <Siren size={20} className="text-white" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Incident Console</h1>
            <p className="text-sm text-slate-400">Verify AI detections and monitor active responses</p>
          </div>
        </div>
        <button onClick={toggleDrill}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
            drillActive ? 'text-orange-700 border-orange-200 bg-orange-50' : 'text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}>
          {drillActive ? <><Square size={13} /> Stop Simulation</> : <><Play size={13} /> Start Simulation</>}
        </button>
      </motion.div>

      {/* Dispatch notice */}
      <AnimatePresence>
        {notice && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
            <Radio size={15} /> {notice}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Two columns */}
      <div className="flex-1 grid grid-cols-2 gap-5 min-h-0">
        {/* Verification queue */}
        <div className="panel flex flex-col overflow-hidden">
          <div className="panel-header flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Verification Queue ({queue.length})
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {queue.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ShieldCheck size={28} className="text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">All clear — no detections awaiting review</p>
              </div>
            )}
            <AnimatePresence initial={false}>
              {queue.map((inc) => {
                const Icon = TYPE_ICON[inc.type]
                return (
                  <motion.div key={inc.id}
                    layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    className="p-3 rounded-lg border border-slate-200 bg-surface-alt">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${NAVY}0f`, color: NAVY }}>
                          <Icon size={17} />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-800">{TYPE_LABEL[inc.type]}</span>
                            <span className={`badge ${SEVERITY_STYLE[inc.severity]}`}>{inc.severity}</span>
                            {inc.isDrill && <span className="badge border-orange-200 text-orange-600 bg-orange-50">SIM</span>}
                          </div>
                          <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                            {inc.droneCallsign && <span className="inline-flex items-center gap-1"><Radio size={11} />{inc.droneCallsign}</span>}
                            <span className="inline-flex items-center gap-1"><MapPin size={11} />{inc.lat.toFixed(4)}, {inc.lng.toFixed(4)}</span>
                            <span className="inline-flex items-center gap-1"><Clock size={11} />{timeAgo(inc.createdAt)}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => verify(inc.id)} disabled={busyId === inc.id}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:shadow-md disabled:opacity-40"
                        style={{ background: NAVY }}>
                        <CheckCircle2 size={15} /> Verify & Dispatch
                      </button>
                      <button onClick={() => close(inc.id, 'Detection dismissed as a false positive')} disabled={busyId === inc.id}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors">
                        <X size={15} /> Dismiss
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Active responses */}
        <div className="panel flex flex-col overflow-hidden">
          <div className="panel-header flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Active Responses ({active.length})
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {active.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Radio size={28} className="text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">No active responses in progress</p>
              </div>
            )}
            {active.map((inc) => {
              const Icon = TYPE_ICON[inc.type]
              const mission = missionForIncident(inc.id)
              const responder = mission?.responderNames?.[0]
              return (
                <div key={inc.id} className="p-3 rounded-lg border border-slate-200 bg-surface-alt">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${NAVY}0f`, color: NAVY }}>
                        <Icon size={17} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">{TYPE_LABEL[inc.type]}</span>
                          <span className={`badge ${SEVERITY_STYLE[inc.severity]}`}>{inc.severity}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                          <span className="inline-flex items-center gap-1"><MapPin size={11} />{inc.lat.toFixed(4)}, {inc.lng.toFixed(4)}</span>
                          <span className="inline-flex items-center gap-1"><Clock size={11} />{timeAgo(inc.createdAt)}</span>
                        </p>
                      </div>
                    </div>
                    <button onClick={() => close(inc.id, 'Incident resolved')} disabled={busyId === inc.id}
                      className="text-xs font-medium text-slate-400 hover:text-emerald-600 flex-shrink-0">Resolve</button>
                  </div>
                  <div className="flex items-center justify-between mt-2.5 pl-11">
                    {mission ? (
                      <span className="text-xs text-slate-500">
                        {responder ? <><span className="font-medium text-slate-700">{responder}</span> responding</> : 'Awaiting responder'}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">No responder dispatched</span>
                    )}
                    {mission && <span className={`badge ${MISSION_STYLE[mission.status] ?? 'border-slate-200 text-slate-500'}`}>{mission.status.replace('_', ' ')}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
