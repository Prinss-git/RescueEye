import { useState, useEffect, useCallback, FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'

interface AgencyUser {
  uid: string
  email: string
  displayName: string
  role: string
  active: boolean
  createdAt: string
  lastLogin: string | null
}

interface Team {
  id: string
  name: string
  status: string
  members: string[]
  memberUserIds: string[]
  assignedTo: string | null
}

const ROLE_LABELS: Record<string, string> = {
  command_staff:    'Command Staff',
  field_responder:  'Field Responder',
}

const COMMAND_STAFF_ROLES = ['command_staff']
const FIELD_RESPONDER_ROLES = ['field_responder']

function RoleGroup({ title, roles, users, onToggleActive }: {
  title: string; roles: string[]; users: AgencyUser[]
  onToggleActive: (u: AgencyUser) => void
}) {
  const filtered = users.filter((u) => roles.includes(u.role))
  return (
    <div className="panel overflow-hidden">
      <div className="panel-header">{title} ({filtered.length})</div>
      <div className="p-3 space-y-2">
        {filtered.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">— none yet —</p>
        )}
        {filtered.map((u) => (
          <div key={u.uid} className="p-3 rounded-md border border-slate-200 bg-surface-alt flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800 truncate">{u.displayName}</span>
                <span className="badge border-accent/30 text-accent">
                  {ROLE_LABELS[u.role] ?? u.role}
                </span>
                {!u.active && (
                  <span className="badge border-red-200 text-alert">
                    Deactivated
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate">{u.email}</p>
            </div>
            <button onClick={() => onToggleActive(u)} className="btn-ghost text-xs flex-shrink-0">
              {u.active ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function TeamsPanel({ teams, users, onCreateTeam, onAddMember, onRemoveMember }: {
  teams: Team[]
  users: AgencyUser[]
  onCreateTeam: (name: string) => Promise<void>
  onAddMember: (teamId: string, userId: string) => void
  onRemoveMember: (teamId: string, userId: string) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pendingUser, setPendingUser] = useState<Record<string, string>>({})

  const responders = users.filter((u) => FIELD_RESPONDER_ROLES.includes(u.role) && u.active)

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    try {
      await onCreateTeam(name.trim())
      setName('')
      setShowForm(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="panel overflow-hidden">
      <div className="panel-header flex items-center justify-between">
        <span>Teams ({teams.length})</span>
        <button onClick={() => setShowForm((s) => !s)} className="text-accent text-xs font-medium normal-case">
          {showForm ? 'Cancel' : '+ Add Team'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="p-3 border-b border-slate-200 flex gap-2">
          <input className="input-field text-sm" placeholder="Team name (e.g. Foxtrot Team)"
            value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} />
          <button type="submit" className="btn-primary text-xs flex-shrink-0" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </form>
      )}

      <div className="p-3 space-y-3">
        {teams.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">— no teams yet —</p>
        )}
        {teams.map((team) => {
          const memberUsers = team.memberUserIds
            .map((uid) => responders.find((u) => u.uid === uid))
            .filter((u): u is AgencyUser => !!u)
          const available = responders.filter((u) => !team.memberUserIds.includes(u.uid))
          return (
            <div key={team.id} className="p-3 rounded-md border border-slate-200 bg-surface-alt space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">{team.name}</span>
                <span className="badge border-slate-200 text-slate-500">{team.status}</span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {memberUsers.length === 0 && (
                  <span className="text-xs text-slate-400">No members yet</span>
                )}
                {memberUsers.map((u) => (
                  <span key={u.uid} className="badge border-accent/30 text-accent gap-1.5">
                    {u.displayName} · {ROLE_LABELS[u.role]}
                    <button onClick={() => onRemoveMember(team.id, u.uid)} className="text-alert hover:text-red-700">×</button>
                  </span>
                ))}
              </div>

              {available.length > 0 && (
                <div className="flex gap-1.5">
                  <select className="input-field text-xs py-1"
                    value={pendingUser[team.id] || ''}
                    onChange={(e) => setPendingUser((p) => ({ ...p, [team.id]: e.target.value }))}>
                    <option value="">— add a responder —</option>
                    {available.map((u) => (
                      <option key={u.uid} value={u.uid}>{u.displayName} ({ROLE_LABELS[u.role]})</option>
                    ))}
                  </select>
                  <button
                    className="btn-ghost text-xs flex-shrink-0"
                    disabled={!pendingUser[team.id]}
                    onClick={() => {
                      const uid = pendingUser[team.id]
                      if (!uid) return
                      onAddMember(team.id, uid)
                      setPendingUser((p) => ({ ...p, [team.id]: '' }))
                    }}>
                    Add
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AgencyAdminDashboard() {
  const { token } = useAuth()
  const [users, setUsers]       = useState<AgencyUser[]>([])
  const [teams, setTeams]       = useState<Team[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole]         = useState('command_staff')
  const [error, setError]       = useState('')
  const [submitting, setSubmitting] = useState(false)

  const authHeaders = useCallback((): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token])

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/server/agency/users', { headers: authHeaders() })
      if (res.ok) setUsers(await res.json())
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  const fetchTeams = useCallback(async () => {
    const res = await fetch('/server/agency/teams', { headers: authHeaders() })
    if (res.ok) setTeams(await res.json())
  }, [authHeaders])

  useEffect(() => { fetchUsers(); fetchTeams() }, [fetchUsers, fetchTeams])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!name || !email || !password) {
      setError('All fields are required.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/server/agency/users', {
        method:  'POST',
        headers: authHeaders(),
        body:    JSON.stringify({ name, email, password, role }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to create user')
      }
      setName(''); setEmail(''); setPassword(''); setRole('command_staff')
      setShowForm(false)
      fetchUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActive(user: AgencyUser) {
    await fetch(`/server/agency/users/${user.uid}/active`, {
      method:  'PATCH',
      headers: authHeaders(),
      body:    JSON.stringify({ active: !user.active }),
    })
    fetchUsers()
  }

  async function createTeam(teamName: string) {
    await fetch('/server/agency/teams', {
      method:  'POST',
      headers: authHeaders(),
      body:    JSON.stringify({ name: teamName }),
    })
    fetchTeams()
  }

  async function addMember(teamId: string, userId: string) {
    await fetch(`/server/agency/teams/${teamId}/members`, {
      method:  'POST',
      headers: authHeaders(),
      body:    JSON.stringify({ userId }),
    })
    fetchTeams()
  }

  async function removeMember(teamId: string, userId: string) {
    await fetch(`/server/agency/teams/${teamId}/members/${userId}`, {
      method:  'DELETE',
      headers: authHeaders(),
    })
    fetchTeams()
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Agency Admin</h1>
          <p className="text-sm text-slate-400 mt-1">Manage Command Staff, Field Responder accounts, and teams</p>
        </div>
        <button className="btn-primary text-sm" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="panel p-5 space-y-4">
          <p className="text-sm font-semibold text-slate-700 mb-1">New User</p>
          <div className="grid grid-cols-2 gap-4">
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
          </div>

          {error && (
            <p className="text-alert text-xs border border-red-200 bg-red-50 rounded px-3 py-2">{error}</p>
          )}

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create User'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-6">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <RoleGroup title="Command Staff" roles={COMMAND_STAFF_ROLES} users={users} onToggleActive={toggleActive} />
            <RoleGroup title="Field Responders" roles={FIELD_RESPONDER_ROLES} users={users} onToggleActive={toggleActive} />
          </div>
          <TeamsPanel teams={teams} users={users} onCreateTeam={createTeam} onAddMember={addMember} onRemoveMember={removeMember} />
        </>
      )}
    </div>
  )
}
