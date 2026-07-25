import { useState, useEffect, useCallback, useMemo, FormEvent } from 'react'
import { Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

interface AgencyProfile {
  id: string
  name: string
  registrationStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  subscriptionStatus: 'ACTIVE' | 'SUSPENDED' | string
}

interface AgencyUser {
  uid: string
  email: string
  displayName: string
  role: string
  active: boolean
  createdAt: string
  lastLogin: string | null
  lastLat: number | null
  lastLng: number | null
  locationUpdatedAt: string | null
}

interface MissionRow {
  id: string
  teamName: string | null
  incidentType: string | null
  incidentSeverity: string | null
  status: string
  createdAt: string
  completedAt: string | null
}

const SUB_STATUS_STYLE: Record<string, string> = {
  ACTIVE:    'text-green-700 border-green-200 bg-green-50',
  SUSPENDED: 'text-alert border-red-200 bg-red-50',
}

const ROLE_LABELS: Record<string, string> = {
  command_staff:    'Command Staff',
  field_responder:  'Field Responder',
}

const COMMAND_STAFF_ROLES = ['command_staff']
const FIELD_RESPONDER_ROLES = ['field_responder']

const TERMINAL_MISSION_STATUSES = ['COMPLETED', 'DECLINED']

type RoleFilter = 'ALL' | 'command_staff' | 'field_responder'
type MissionFilter = 'ACTIVE' | 'COMPLETED'

// Since dispatch is nearest-responder-by-location, every Field Responder's
// app already pings its location every 30s for auto-dispatch — this just
// surfaces that data instead of leaving it invisible.
function checkInStatus(iso: string | null): { label: string; dot: string } {
  if (!iso) return { label: 'Never checked in', dot: 'bg-slate-300' }
  const minutesAgo = (Date.now() - new Date(iso).getTime()) / 60_000
  const label = minutesAgo < 1 ? 'Just now' : `${Math.round(minutesAgo)} min ago`
  if (minutesAgo <= 5)  return { label, dot: 'bg-green-500' }
  if (minutesAgo <= 30) return { label, dot: 'bg-amber-500' }
  return { label, dot: 'bg-slate-300' }
}

// ── Agency profile bar ───────────────────────────────────────────────────────

function AgencyProfilePanel({ agency, onRename }: {
  agency: AgencyProfile
  onRename: (name: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName]       = useState(agency.name)
  const [busy, setBusy]       = useState(false)

  async function save() {
    if (!name.trim() || name.trim() === agency.name) { setEditing(false); return }
    setBusy(true)
    try { await onRename(name.trim()) } finally { setBusy(false); setEditing(false) }
  }

  return (
    <div className="panel p-4 flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center gap-2">
            <input className="input-field text-sm py-1" value={name}
              onChange={(e) => setName(e.target.value)} disabled={busy} autoFocus />
            <button onClick={save} className="btn-primary text-xs flex-shrink-0" disabled={busy}>Save</button>
            <button onClick={() => { setEditing(false); setName(agency.name) }} className="btn-ghost text-xs flex-shrink-0" disabled={busy}>Cancel</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-slate-800 truncate cursor-pointer hover:underline"
              onClick={() => setEditing(true)} title="Click to rename">
              {agency.name}
            </span>
            <span className={`badge ${SUB_STATUS_STYLE[agency.subscriptionStatus] ?? ''}`}>
              {agency.subscriptionStatus}
            </span>
            {agency.registrationStatus !== 'APPROVED' && (
              <span className="badge border-slate-200 text-slate-500">{agency.registrationStatus}</span>
            )}
          </div>
        )}
        {agency.subscriptionStatus !== 'ACTIVE' && (
          <p className="text-xs text-alert mt-1">
            Your subscription is {agency.subscriptionStatus.toLowerCase()}. Contact RescueEye support to restore access.
          </p>
        )}
      </div>
    </div>
  )
}

// ── Stat strip ───────────────────────────────────────────────────────────────

function StatTile({ label, count }: { label: string; count: number }) {
  return (
    <div className="panel p-4 flex-1">
      <span className="text-xs text-slate-400">{label}</span>
      <p className="text-2xl font-semibold text-slate-800 mt-1">{count}</p>
    </div>
  )
}

// ── User list (left column) ─────────────────────────────────────────────────

function UserListRow({ user, selected, onClick }: {
  user: AgencyUser; selected: boolean; onClick: () => void
}) {
  const isResponder = FIELD_RESPONDER_ROLES.includes(user.role)
  const check = isResponder ? checkInStatus(user.locationUpdatedAt) : null

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-md border transition-colors ${
        selected ? 'border-accent bg-accent-tint' : 'border-slate-200 bg-surface-alt hover:border-slate-300'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-800 truncate">{user.displayName}</span>
        {check && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${check.dot}`} />}
      </div>
      <p className="text-xs text-slate-400 truncate mt-0.5">{user.email}</p>
      <div className="flex items-center gap-1.5 mt-1">
        <span className="badge border-accent/30 text-accent">{ROLE_LABELS[user.role] ?? user.role}</span>
        {!user.active && <span className="badge border-red-200 text-alert">Deactivated</span>}
      </div>
    </button>
  )
}

// ── User detail (right column) ──────────────────────────────────────────────

function UserDetailPanel({ user, onToggleActive, onEdit, onResetPassword }: {
  user: AgencyUser
  onToggleActive: (u: AgencyUser) => Promise<void>
  onEdit: (uid: string, name: string, email: string) => Promise<void>
  onResetPassword: (uid: string, password: string) => Promise<void>
}) {
  const [name, setName]   = useState(user.displayName)
  const [email, setEmail] = useState(user.email)
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy]   = useState(false)

  useEffect(() => { setName(user.displayName); setEmail(user.email); setNewPassword('') }, [user.uid])

  const isResponder = FIELD_RESPONDER_ROLES.includes(user.role)
  const check = isResponder ? checkInStatus(user.locationUpdatedAt) : null

  async function saveEdit() {
    if (!name.trim() || !email.trim()) return
    setBusy(true)
    try { await onEdit(user.uid, name.trim(), email.trim()) } finally { setBusy(false) }
  }

  async function submitReset() {
    if (!newPassword) return
    setBusy(true)
    try { await onResetPassword(user.uid, newPassword) } finally { setBusy(false); setNewPassword('') }
  }

  async function toggle() {
    setBusy(true)
    try { await onToggleActive(user) } finally { setBusy(false) }
  }

  return (
    <div className="panel flex-1 overflow-y-auto p-5 space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-slate-800">{user.displayName}</h2>
          <span className="badge border-accent/30 text-accent">{ROLE_LABELS[user.role] ?? user.role}</span>
          {!user.active && <span className="badge border-red-200 text-alert">Deactivated</span>}
        </div>
        <p className="text-xs text-slate-400 mt-1">{user.email}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {user.lastLogin ? `Last login ${new Date(user.lastLogin).toLocaleString()}` : 'Never logged in'}
        </p>
      </div>

      {check && (
        <div className="pt-2 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-600 mb-1">Location Check-in</p>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${check.dot}`} />
            <span className="text-sm text-slate-600">{check.label}</span>
          </div>
        </div>
      )}

      <div className="pt-2 border-t border-slate-100 space-y-2">
        <p className="text-xs font-medium text-slate-600">Edit Name / Email</p>
        <div className="flex gap-2">
          <input className="input-field text-sm py-1.5" placeholder="Name" value={name}
            onChange={(e) => setName(e.target.value)} disabled={busy} />
          <input className="input-field text-sm py-1.5" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} disabled={busy} />
          <button onClick={saveEdit} className="btn-primary text-xs flex-shrink-0" disabled={busy}>Save</button>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 space-y-2">
        <p className="text-xs font-medium text-slate-600">Reset Password</p>
        <div className="flex gap-2">
          <input className="input-field text-sm py-1.5" type="password" placeholder="New password"
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={busy} />
          <button onClick={submitReset} className="btn-primary text-xs flex-shrink-0" disabled={busy || !newPassword}>
            Set
          </button>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100">
        <button onClick={toggle} className="btn-ghost text-sm" disabled={busy}>
          {user.active ? 'Deactivate User' : 'Reactivate User'}
        </button>
      </div>
    </div>
  )
}

// ── Add user (right column, create mode) ────────────────────────────────────

function AddUserPanel({ onCreate, onCancel }: {
  onCreate: (name: string, email: string, password: string, role: string) => Promise<boolean>
  onCancel: () => void
}) {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole]         = useState('command_staff')
  const [error, setError]       = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!name || !email || !password) {
      setError('All fields are required.')
      return
    }
    setSubmitting(true)
    try {
      const ok = await onCreate(name, email, password, role)
      if (!ok) setError('Failed to create user — email may already be in use.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="panel flex-1 overflow-y-auto p-5 space-y-4">
      <p className="text-sm font-semibold text-slate-700">New User</p>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
        <input className="input-field" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Maria Santos" disabled={submitting} />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
        <input className="input-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="maria@agency.ph" disabled={submitting} />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
        <input className="input-field" type="password" value={password}
          onChange={(e) => setPassword(e.target.value)} disabled={submitting} />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
        <select className="input-field" value={role} onChange={(e) => setRole(e.target.value)} disabled={submitting}>
          <optgroup label="Command Staff">
            {COMMAND_STAFF_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </optgroup>
          <optgroup label="Field Responders">
            {FIELD_RESPONDER_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </optgroup>
        </select>
      </div>

      {error && (
        <p className="text-alert text-xs border border-red-200 bg-red-50 rounded px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2">
        <button type="submit" className="btn-primary text-sm" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create User'}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost text-sm" disabled={submitting}>Cancel</button>
      </div>
    </form>
  )
}

// ── Mission history ──────────────────────────────────────────────────────────

function MissionHistoryPanel({ missions }: { missions: MissionRow[] }) {
  const [filter, setFilter] = useState<MissionFilter>('ACTIVE')
  const filtered = missions.filter((m) =>
    filter === 'ACTIVE' ? !TERMINAL_MISSION_STATUSES.includes(m.status) : TERMINAL_MISSION_STATUSES.includes(m.status)
  )

  return (
    <div className="panel overflow-hidden">
      <div className="panel-header flex items-center justify-between">
        <span>Mission History ({filtered.length})</span>
        <div className="flex gap-1 normal-case font-normal">
          {(['ACTIVE', 'COMPLETED'] as MissionFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                filter === f ? 'bg-accent/20 text-accent border border-accent/40' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {f === 'ACTIVE' ? 'Active' : 'Completed'}
            </button>
          ))}
        </div>
      </div>
      <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">— no missions —</p>
        )}
        {filtered.map((m) => (
          <div key={m.id} className="p-2.5 rounded-md border border-slate-200 bg-surface-alt flex items-center justify-between gap-4 text-xs">
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-slate-700">{m.teamName ?? '—'}</span>
              <span className="text-slate-400"> · {m.incidentType ?? '—'} ({m.incidentSeverity ?? '—'})</span>
            </div>
            <span className="badge border-slate-200 text-slate-500 flex-shrink-0">{m.status}</span>
            <span className="text-slate-400 flex-shrink-0">
              {m.completedAt ? new Date(m.completedAt).toLocaleString() : new Date(m.createdAt).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function AgencyAdminDashboard() {
  const { token } = useAuth()
  const [agency, setAgency]     = useState<AgencyProfile | null>(null)
  const [users, setUsers]       = useState<AgencyUser[]>([])
  const [missions, setMissions] = useState<MissionRow[]>([])
  const [loading, setLoading]   = useState(true)

  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL')
  const [search, setSearch]         = useState('')
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const [adding, setAdding]         = useState(false)

  const authHeaders = useCallback((): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token])

  const fetchAgency = useCallback(async () => {
    const res = await fetch('/server/agency/profile', { headers: authHeaders() })
    if (res.ok) setAgency(await res.json())
  }, [authHeaders])

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/server/agency/users', { headers: authHeaders() })
      if (res.ok) setUsers(await res.json())
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  const fetchMissions = useCallback(async () => {
    const res = await fetch('/server/agency/missions', { headers: authHeaders() })
    if (res.ok) setMissions(await res.json())
  }, [authHeaders])

  useEffect(() => { fetchAgency(); fetchUsers(); fetchMissions() }, [fetchAgency, fetchUsers, fetchMissions])

  const commandStaffCount   = useMemo(() => users.filter((u) => COMMAND_STAFF_ROLES.includes(u.role)).length, [users])
  const fieldResponderCount = useMemo(() => users.filter((u) => FIELD_RESPONDER_ROLES.includes(u.role)).length, [users])
  const activeMissionCount  = useMemo(() => missions.filter((m) => !TERMINAL_MISSION_STATUSES.includes(m.status)).length, [missions])

  const filteredUsers = useMemo(() => {
    let list = users
    if (roleFilter !== 'ALL') list = list.filter((u) => u.role === roleFilter)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((u) => u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    return list
  }, [users, roleFilter, search])

  useEffect(() => {
    if (adding) return
    if (!filteredUsers.some((u) => u.uid === selectedUid)) {
      setSelectedUid(filteredUsers[0]?.uid ?? null)
    }
  }, [filteredUsers, selectedUid, adding])

  const selectedUser = filteredUsers.find((u) => u.uid === selectedUid) ?? null

  async function renameAgency(newName: string) {
    await fetch('/server/agency/profile', {
      method:  'PATCH',
      headers: authHeaders(),
      body:    JSON.stringify({ name: newName }),
    })
    fetchAgency()
  }

  async function createUser(name: string, email: string, password: string, role: string): Promise<boolean> {
    const res = await fetch('/server/agency/users', {
      method:  'POST',
      headers: authHeaders(),
      body:    JSON.stringify({ name, email, password, role }),
    })
    if (!res.ok) return false
    setAdding(false)
    fetchUsers()
    return true
  }

  async function toggleActive(user: AgencyUser) {
    await fetch(`/server/agency/users/${user.uid}/active`, {
      method:  'PATCH',
      headers: authHeaders(),
      body:    JSON.stringify({ active: !user.active }),
    })
    fetchUsers()
  }

  async function editUser(uid: string, editName: string, editEmail: string) {
    await fetch(`/server/agency/users/${uid}`, {
      method:  'PATCH',
      headers: authHeaders(),
      body:    JSON.stringify({ name: editName, email: editEmail }),
    })
    fetchUsers()
  }

  async function resetUserPassword(uid: string, newPassword: string) {
    await fetch(`/server/agency/users/${uid}/password`, {
      method:  'PATCH',
      headers: authHeaders(),
      body:    JSON.stringify({ password: newPassword }),
    })
  }

  const ROLE_TABS: { key: RoleFilter; label: string }[] = [
    { key: 'ALL',              label: 'All' },
    { key: 'command_staff',    label: 'Command Staff' },
    { key: 'field_responder',  label: 'Field Responders' },
  ]

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Agency Admin</h1>
          <p className="text-sm text-slate-400 mt-1">Manage Command Staff and Field Responder accounts</p>
        </div>
        <button className="btn-primary text-sm" onClick={() => { setAdding(true); setSelectedUid(null) }}>
          + Add User
        </button>
      </div>

      {agency && <AgencyProfilePanel agency={agency} onRename={renameAgency} />}

      <div className="flex gap-3">
        <StatTile label="Total Users" count={users.length} />
        <StatTile label="Command Staff" count={commandStaffCount} />
        <StatTile label="Field Responders" count={fieldResponderCount} />
        <StatTile label="Active Missions" count={activeMissionCount} />
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {ROLE_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setRoleFilter(t.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              roleFilter === t.key ? 'border-accent text-accent' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-4" style={{ minHeight: 420 }}>
        {/* Left: roster */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input-field text-sm py-1.5 pl-8"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loading && <p className="text-sm text-slate-400 text-center py-6">Loading…</p>}
            {!loading && filteredUsers.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">
                {search ? '— no matches —' : '— no users yet —'}
              </p>
            )}
            {filteredUsers.map((u) => (
              <UserListRow key={u.uid} user={u} selected={!adding && u.uid === selectedUid}
                onClick={() => { setAdding(false); setSelectedUid(u.uid) }} />
            ))}
          </div>
        </div>

        {/* Right: detail / add */}
        {adding ? (
          <AddUserPanel onCreate={createUser} onCancel={() => setAdding(false)} />
        ) : selectedUser ? (
          <UserDetailPanel user={selectedUser} onToggleActive={toggleActive} onEdit={editUser} onResetPassword={resetUserPassword} />
        ) : (
          <div className="panel flex-1 flex items-center justify-center">
            <p className="text-sm text-slate-400">Select a user to view details</p>
          </div>
        )}
      </div>

      <MissionHistoryPanel missions={missions} />
    </div>
  )
}
