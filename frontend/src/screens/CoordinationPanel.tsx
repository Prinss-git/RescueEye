import { useState, useEffect, useRef, useCallback } from 'react'
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
  CRITICAL: 'text-red-400 border-red-500/50 bg-red-500/10',
  HIGH:     'text-orange-400 border-orange-500/50 bg-orange-500/10',
  MEDIUM:   'text-yellow-300 border-yellow-500/50 bg-yellow-500/10',
  LOW:      'text-white/50 border-white/20 bg-white/5',
}

const INC_STATUS_STYLE: Record<IncidentStatus, string> = {
  OPEN:     'text-alert border-alert/40 bg-alert/10',
  ASSIGNED: 'text-yellow-300 border-yellow-500/40 bg-yellow-500/10',
  RESOLVED: 'text-cyan/60 border-cyan/20 bg-cyan/5',
}

const TEAM_STATUS_STYLE: Record<TeamStatus, string> = {
  STANDBY:    'text-white/50 border-white/20 bg-white/5',
  DISPATCHED: 'text-yellow-300 border-yellow-400/40 bg-yellow-500/10',
  ON_SITE:    'text-green-300 border-green-400/40 bg-green-500/10',
  COMPLETE:   'text-cyan/70 border-cyan/20 bg-cyan/5',
}

const MSG_TYPE_COLOR: Record<MsgType, string> = {
  ALERT:             'text-red-400',
  RESOURCE_REQUEST:  'text-yellow-300',
  SITUATION_REPORT:  'text-cyan',
  UPDATE:            'text-white/60',
}

const INC_TYPE_ICON: Record<IncidentType, string> = {
  VICTIM_DETECTED: '🧍',
  FLOOD:           '🌊',
  FIRE:            '🔥',
  STRUCTURAL:      '🏗',
  UNKNOWN:         '⚠',
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
        body: JSON.stringify({ incidentId }),
      })
      setShowAssignModal(null)
      fetchTeams()
      fetchIncidents()
    } catch {}
  }

  // ── Drill toggle (incident_commander only) ──────────────────────────────────
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

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex gap-4 p-4 overflow-hidden">

      {/* ── LEFT: Incidents ─────────────────────────────────────────────────── */}
      <div className="w-80 flex flex-col panel overflow-hidden">
        <div className="panel-header flex items-center justify-between">
          <span>INCIDENTS ({incidents.filter(i => i.status !== 'RESOLVED').length})</span>
          {user?.role === 'incident_commander' && (
            <button
              onClick={toggleDrill}
              className={`text-xs font-mono px-2 py-0.5 rounded border transition-all ${
                drillActive
                  ? 'bg-orange-500/20 text-orange-300 border-orange-500/50 animate-pulse'
                  : 'bg-white/5 text-white/40 border-white/20 hover:text-white/70'
              }`}
            >
              {drillActive ? '● DRILL ACTIVE' : 'START DRILL'}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {incidents.length === 0 && (
            <p className="font-mono text-xs text-white/30 text-center mt-8">— no incidents —</p>
          )}
          {incidents.map(inc => (
            <div
              key={inc.id}
              onClick={() => setSelectedIncident(inc)}
              className={`p-2 rounded cursor-pointer border transition-all ${
                selectedIncident?.id === inc.id
                  ? 'border-cyan/50 bg-cyan/5'
                  : 'border-white/5 bg-panel-light hover:border-white/15'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="font-mono text-xs text-white/80 truncate">
                  {INC_TYPE_ICON[inc.type]} {inc.type.replace('_', ' ')}
                  {inc.isDrill && <span className="ml-1 text-orange-400/80">[SIM]</span>}
                </span>
                <span className={`text-xs font-mono px-1.5 py-0.5 rounded border whitespace-nowrap ${SEVERITY_STYLE[inc.severity]}`}>
                  {inc.severity}
                </span>
              </div>
              <p className="font-mono text-xs text-white/40 truncate">{inc.description}</p>
              <div className="flex items-center justify-between mt-1">
                <span className={`text-xs font-mono px-1 py-0.5 rounded border ${INC_STATUS_STYLE[inc.status]}`}>
                  {inc.status}
                </span>
                {inc.status !== 'RESOLVED' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); resolveIncident(inc.id) }}
                    className="text-xs font-mono text-white/30 hover:text-cyan/70 transition-colors"
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
        <div className="panel-header">TEAMS ({teams.length})</div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {teams.map(team => (
            <div key={team.id} className="p-3 rounded border border-white/5 bg-panel-light space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-xs font-bold text-white">{team.name}</p>
                  <p className="font-mono text-xs text-white/40">{team.members.join(', ')}</p>
                </div>
                <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${TEAM_STATUS_STYLE[team.status]}`}>
                  {team.status}
                </span>
              </div>
              {team.assignedTo && (
                <p className="font-mono text-xs text-cyan/60">→ {team.assignedTo}</p>
              )}
              <div className="flex gap-1">
                <button
                  onClick={() => setShowAssignModal(team)}
                  disabled={!selectedIncident}
                  className="flex-1 px-2 py-1 rounded text-xs font-mono bg-cyan/10 text-cyan/80 border border-cyan/20 hover:bg-cyan/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ASSIGN →
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
            <span className="font-mono text-xs text-cyan/60 normal-case font-normal">
              {selectedIncident.id} · {selectedIncident.type.replace('_', ' ')}
            </span>
          )}
        </div>

        {!selectedIncident && (
          <div className="flex-1 flex items-center justify-center">
            <p className="font-mono text-xs text-white/30">← Select an incident to view messages</p>
          </div>
        )}

        {selectedIncident && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <p className="font-mono text-xs text-white/30 text-center mt-8">— no messages —</p>
              )}
              {messages.map(msg => {
                const isMe = msg.senderId === user?.uid
                return (
                  <div key={msg.id} className={`flex flex-col gap-1 max-w-lg ${isMe ? 'ml-auto items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-cyan">{msg.senderName}</span>
                      {msg.senderOrg && <span className="font-mono text-xs text-white/30">[{msg.senderOrg}]</span>}
                      <span className={`font-mono text-xs ${MSG_TYPE_COLOR[msg.type]}`}>{msg.type}</span>
                      <span className="font-mono text-xs text-white/20">{fmtTime(msg.timestamp)}</span>
                    </div>
                    <div className={`px-3 py-2 rounded text-sm font-mono ${
                      isMe
                        ? 'bg-cyan/15 border border-cyan/30 text-white'
                        : 'bg-panel-light border border-white/10 text-white/80'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                )
              })}
              <div ref={msgEndRef} />
            </div>

            <div className="border-t border-cyan/20 p-3 flex flex-col gap-2">
              <div className="flex gap-1">
                {(['UPDATE', 'SITUATION_REPORT', 'RESOURCE_REQUEST', 'ALERT'] as MsgType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setMsgType(t)}
                    className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
                      msgType === t ? 'bg-cyan/20 text-cyan border border-cyan/40' : 'text-white/30 hover:text-white/60'
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
                <button onClick={sendMessage} className="btn-primary px-6">SEND</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Assign Modal ──────────────────────────────────────────────────────── */}
      {showAssignModal && selectedIncident && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="panel p-6 w-96 space-y-4">
            <p className="font-mono text-sm font-bold text-cyan">ASSIGN TEAM</p>
            <p className="font-mono text-xs text-white/60">
              Assign <span className="text-white">{showAssignModal.name}</span> to incident{' '}
              <span className="text-white">{selectedIncident.id}</span>?
            </p>
            <p className="font-mono text-xs text-white/40 truncate">{selectedIncident.description}</p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => assignTeam(showAssignModal.id, selectedIncident.id)}
                className="btn-primary flex-1"
              >
                CONFIRM
              </button>
              <button
                onClick={() => setShowAssignModal(null)}
                className="btn-ghost flex-1"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
