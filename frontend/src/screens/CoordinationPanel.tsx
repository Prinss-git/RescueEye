import { useState, useEffect, useRef, useCallback } from 'react'
import { PersonStanding, Waves, Flame, Construction, TriangleAlert } from 'lucide-react'
import { subscribeToMessages, isConfigured as firebaseConfigured } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'

// ── Types ─────────────────────────────────────────────────────────────────────
type IncidentStatus = 'OPEN' | 'ASSIGNED' | 'RESOLVED'
type IncidentType   = 'VICTIM_DETECTED' | 'FLOOD' | 'FIRE' | 'STRUCTURAL' | 'UNKNOWN'
type Severity       = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
type TeamStatus     = 'STANDBY' | 'DISPATCHED' | 'ON_SITE' | 'COMPLETE'
type MsgType        = 'SITUATION_REPORT' | 'RESOURCE_REQUEST' | 'UPDATE' | 'ALERT'

interface Incident {
  id:           string
  type:         IncidentType
  severity:     Severity
  status:       IncidentStatus
  lat:          number
  lng:          number
  description:  string
  reportedBy:   string
  assignedTeam: string | null
  isDrill:      boolean
  createdAt:    string
}

interface Team {
  id:         string
  name:       string
  status:     TeamStatus
  members:    string[]
  assignedTo: string | null
  agencyId:   string | null
}

interface Message {
  id:         string
  incidentId: string | null
  senderId:   string
  senderName: string
  senderOrg:  string
  content:    string
  type:       MsgType
  timestamp:  string
  isDrill:    boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────
const INCIDENT_POLL_MS = 10_000
const MSG_POLL_MS      = 2_000

const SEVERITY_STYLE: Record<Severity, string> = {
  CRITICAL: 'text-red-700 border-red-200 bg-red-50',
  HIGH:     'text-orange-700 border-orange-200 bg-orange-50',
  MEDIUM:   'text-amber-700 border-amber-200 bg-amber-50',
  LOW:      'text-slate-500 border-slate-200 bg-slate-50',
}

const INC_STATUS_STYLE: Record<IncidentStatus, string> = {
  OPEN:     'text-alert border-red-200 bg-red-50',
  ASSIGNED: 'text-amber-700 border-amber-200 bg-amber-50',
  RESOLVED: 'text-accent border-accent/20 bg-accent-tint',
}

const TEAM_STATUS_STYLE: Record<TeamStatus, string> = {
  STANDBY:    'text-slate-500 border-slate-200 bg-slate-50',
  DISPATCHED: 'text-amber-700 border-amber-200 bg-amber-50',
  ON_SITE:    'text-green-700 border-green-200 bg-green-50',
  COMPLETE:   'text-accent border-accent/20 bg-accent-tint',
}

const MSG_TYPE_COLOR: Record<MsgType, string> = {
  ALERT:             'text-red-600',
  RESOURCE_REQUEST:  'text-amber-600',
  SITUATION_REPORT:  'text-accent',
  UPDATE:            'text-slate-500',
}

const INC_TYPE_ICON: Record<IncidentType, typeof PersonStanding> = {
  VICTIM_DETECTED: PersonStanding,
  FLOOD:           Waves,
  FIRE:            Flame,
  STRUCTURAL:      Construction,
  UNKNOWN:         TriangleAlert,
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('en-PH', { hour12: false }) }
  catch { return iso }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CoordinationPanel() {
  const { user } = useAuth()

  const [incidents, setIncidents]           = useState<Incident[]>([])
  const [teams, setTeams]                   = useState<Team[]>([])
  const [messages, setMessages]             = useState<Message[]>([])
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [draft, setDraft]                   = useState('')
  const [msgType, setMsgType]               = useState<MsgType>('UPDATE')
  const [showAssignModal, setShowAssignModal] = useState<Team | null>(null)
  const [drillActive, setDrillActive]       = useState(false)
  const msgEndRef = useRef<HTMLDivElement>(null)

  // ── Fetch incidents (10s poll) ──────────────────────────────────────────────
  const fetchIncidents = useCallback(async () => {
    try {
      const res = await fetch('/server/incidents')
      if (!res.ok) return
      const data: Incident[] = await res.json()
      setIncidents(data)
    } catch {}
  }, [])

  // ── Fetch teams ─────────────────────────────────────────────────────────────
  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch('/server/teams')
      if (!res.ok) return
      const data: Team[] = await res.json()
      setTeams(data)
    } catch {}
  }, [])

  // ── Fetch messages (polling fallback) ──────────────────────────────────────
  const fetchMessages = useCallback(async () => {
    const qs = selectedIncident ? `?incidentId=${selectedIncident.id}` : ''
    try {
      const res = await fetch(`/server/messages${qs}`)
      if (!res.ok) return
      const data: Message[] = await res.json()
      setMessages(data)
    } catch {}
  }, [selectedIncident])

  // ── Check drill status ──────────────────────────────────────────────────────
  const fetchDrillStatus = useCallback(async () => {
    try {
      const res = await fetch('/server/drill/active')
      if (!res.ok) return
      const data = await res.json()
      setDrillActive(!!data?.active)
    } catch {}
  }, [])

  useEffect(() => {
    fetchIncidents()
    fetchTeams()
    fetchDrillStatus()
    const incTimer = setInterval(() => { fetchIncidents(); fetchTeams(); fetchDrillStatus() }, INCIDENT_POLL_MS)
    return () => clearInterval(incTimer)
  }, [fetchIncidents, fetchTeams, fetchDrillStatus])

  // ── Firebase onSnapshot (real-time) or polling fallback ────────────────────
  useEffect(() => {
    if (firebaseConfigured) {
      const unsub = subscribeToMessages(
        selectedIncident?.id ?? null,
        100,
        (docs) => setMessages(docs as Message[])
      )
      return unsub
    }
    // Polling fallback
    fetchMessages()
    const t = setInterval(fetchMessages, MSG_POLL_MS)
    return () => clearInterval(t)
  }, [selectedIncident, fetchMessages])

  // Auto-scroll messages
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send message ────────────────────────────────────────────────────────────
  async function sendMessage() {
    if (!draft.trim()) return
    try {
      await fetch('/server/messages', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incidentId: selectedIncident?.id ?? null,
          senderId:   user?.uid ?? 'unknown',
          senderName: user?.displayName ?? 'Unknown',
          senderOrg:  (user as { organization?: string })?.organization ?? '',
          content:    draft.trim(),
          type:       msgType,
        }),
      })
      setDraft('')
      fetchMessages()
    } catch {}
  }

  // ── Resolve incident ────────────────────────────────────────────────────────
  async function resolveIncident(incidentId: string) {
    try {
      await fetch(`/server/incidents/${incidentId}/resolve`, { method: 'PATCH' })
      fetchIncidents()
      if (selectedIncident?.id === incidentId) setSelectedIncident(null)
    } catch {}
  }

  // ── Assign team ─────────────────────────────────────────────────────────────
  async function assignTeam(teamId: string, incidentId: string) {
    try {
      await fetch(`/server/teams/${teamId}/assign`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidentId, assignedBy: user?.uid }),
      })
      setShowAssignModal(null)
      fetchTeams()
      fetchIncidents()
    } catch {}
  }

  // ── Drill toggle (command_staff only) ────────────────────────────────────────
  async function toggleDrill() {
    const endpoint = drillActive ? '/server/drill/stop' : '/server/drill/start'
    try {
      await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId: user?.uid }),
      })
      fetchDrillStatus()
      fetchIncidents()
    } catch {}
  }

  // Command Staff only dispatch their own agency's teams, plus the legacy
  // unscoped (agencyId: null) demo teams.
  const visibleTeams = teams.filter(t => !t.agencyId || t.agencyId === user?.agencyId)

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex gap-4 p-4 overflow-hidden">

      {/* ── LEFT: Incidents ─────────────────────────────────────────────────── */}
      <div className="w-80 flex flex-col panel overflow-hidden">
        <div className="panel-header flex items-center justify-between">
          <span>INCIDENTS ({incidents.filter(i => i.status !== 'RESOLVED').length})</span>
          {user?.role === 'command_staff' && (
            <button
              onClick={toggleDrill}
              className={`text-xs font-medium px-2 py-0.5 rounded-full border transition-all ${
                drillActive
                  ? 'bg-orange-50 text-orange-700 border-orange-200 animate-pulse'
                  : 'bg-slate-50 text-slate-500 border-slate-200 hover:text-slate-700'
              }`}
            >
              {drillActive ? '● Drill Active' : 'Start Drill'}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {incidents.length === 0 && (
            <p className="font-mono text-xs text-slate-900/30 text-center mt-8">— no incidents —</p>
          )}
          {incidents.map(inc => (
            <div
              key={inc.id}
              onClick={() => setSelectedIncident(inc)}
              className={`p-2 rounded cursor-pointer border transition-all ${
                selectedIncident?.id === inc.id
                  ? 'border-accent/50 bg-accent/5'
                  : 'border-slate-900/5 bg-surface-alt hover:border-slate-900/15'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-xs font-medium text-slate-700 truncate flex items-center gap-1.5">
                  {(() => { const Icon = INC_TYPE_ICON[inc.type]; return <Icon size={13} className="flex-shrink-0" /> })()}
                  {inc.type.replace('_', ' ')}
                  {inc.isDrill && <span className="ml-1 text-orange-600">[SIM]</span>}
                </span>
                <span className={`text-xs font-mono px-1.5 py-0.5 rounded border whitespace-nowrap ${SEVERITY_STYLE[inc.severity]}`}>
                  {inc.severity}
                </span>
              </div>
              <p className="font-mono text-xs text-slate-900/40 truncate">{inc.description}</p>
              <div className="flex items-center justify-between mt-1">
                <span className={`text-xs font-mono px-1 py-0.5 rounded border ${INC_STATUS_STYLE[inc.status]}`}>
                  {inc.status}
                </span>
                {inc.status !== 'RESOLVED' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); resolveIncident(inc.id) }}
                    className="text-xs font-mono text-slate-900/30 hover:text-accent/70 transition-colors"
                  >
                    RESOLVE
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CENTER: Teams ───────────────────────────────────────────────────── */}
      <div className="w-72 flex flex-col panel overflow-hidden">
        <div className="panel-header">TEAMS ({visibleTeams.length})</div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {visibleTeams.map(team => (
            <div key={team.id} className="p-3 rounded border border-slate-900/5 bg-surface-alt space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-xs font-bold text-slate-900">{team.name}</p>
                  <p className="font-mono text-xs text-slate-900/40">{team.members.join(', ')}</p>
                </div>
                <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${TEAM_STATUS_STYLE[team.status]}`}>
                  {team.status}
                </span>
              </div>
              {team.assignedTo && (
                <p className="font-mono text-xs text-accent/60">→ {team.assignedTo}</p>
              )}
              <div className="flex gap-1">
                <button
                  onClick={() => setShowAssignModal(team)}
                  disabled={!selectedIncident}
                  className="flex-1 px-2 py-1 rounded text-xs font-mono bg-accent/10 text-accent/80 border border-accent/20 hover:bg-accent/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Assign →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT: Messages ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col panel overflow-hidden">
        <div className="panel-header flex items-center justify-between">
          <span>MESSAGES</span>
          {selectedIncident && (
            <span className="font-mono text-xs text-accent/60 normal-case font-normal">
              {selectedIncident.id} · {selectedIncident.type.replace('_', ' ')}
            </span>
          )}
        </div>

        {!selectedIncident && (
          <div className="flex-1 flex items-center justify-center">
            <p className="font-mono text-xs text-slate-900/30">← Select an incident to view messages</p>
          </div>
        )}

        {selectedIncident && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <p className="font-mono text-xs text-slate-900/30 text-center mt-8">— no messages —</p>
              )}
              {messages.map(msg => {
                const isMe = msg.senderId === user?.uid
                return (
                  <div key={msg.id} className={`flex flex-col gap-1 max-w-lg ${isMe ? 'ml-auto items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-accent">{msg.senderName}</span>
                      {msg.senderOrg && <span className="font-mono text-xs text-slate-900/30">[{msg.senderOrg}]</span>}
                      <span className={`font-mono text-xs ${MSG_TYPE_COLOR[msg.type]}`}>{msg.type}</span>
                      <span className="font-mono text-xs text-slate-900/20">{fmtTime(msg.timestamp)}</span>
                    </div>
                    <div className={`px-3 py-2 rounded text-sm font-mono ${
                      isMe
                        ? 'bg-accent/15 border border-accent/30 text-slate-900'
                        : 'bg-surface-alt border border-slate-900/10 text-slate-900/80'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                )
              })}
              <div ref={msgEndRef} />
            </div>

            <div className="border-t border-accent/20 p-3 flex flex-col gap-2">
              <div className="flex gap-1">
                {(['UPDATE', 'SITUATION_REPORT', 'RESOURCE_REQUEST', 'ALERT'] as MsgType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setMsgType(t)}
                    className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
                      msgType === t ? 'bg-accent/20 text-accent border border-accent/40' : 'text-slate-900/30 hover:text-slate-900/60'
                    }`}
                  >
                    {t.replace('_', ' ')}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="input-field flex-1"
                  placeholder="Compose message..."
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                />
                <button onClick={sendMessage} className="btn-primary px-6">Send</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Assign Modal ──────────────────────────────────────────────────────── */}
      {showAssignModal && selectedIncident && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="panel p-6 w-96 space-y-4">
            <p className="text-sm font-semibold text-accent">Assign Team</p>
            <p className="font-mono text-xs text-slate-900/60">
              Assign <span className="text-slate-900">{showAssignModal.name}</span> to incident{' '}
              <span className="text-slate-900">{selectedIncident.id}</span>?
            </p>
            <p className="font-mono text-xs text-slate-900/40 truncate">{selectedIncident.description}</p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => assignTeam(showAssignModal.id, selectedIncident.id)}
                className="btn-primary flex-1"
              >
                Confirm
              </button>
              <button
                onClick={() => setShowAssignModal(null)}
                className="btn-ghost flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
