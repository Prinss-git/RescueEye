import { useState, useEffect, useCallback, FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'

interface Agency {
  id: string
  name: string
  subscriptionStatus: 'ACTIVE' | 'SUSPENDED' | string
  createdAt: string
  admin: { displayName: string; email: string } | null
  userCount: number
}

interface MissionRow {
  id: string
  agencyId: string | null
  agencyName: string | null
  teamName: string | null
  incidentType: string | null
  incidentSeverity: string | null
  status: string
  createdAt: string
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE:    'text-green-700 border-green-200 bg-green-50',
  SUSPENDED: 'text-alert border-red-200 bg-red-50',
}

function AgencyRow({ agency, dispatchedCount, onRename, onResetPassword, onDelete, onToggleStatus }: {
  agency: Agency
  dispatchedCount: number
  onRename: (id: string, name: string) => Promise<void>
  onResetPassword: (id: string, password: string) => Promise<void>
  onDelete: (id: string) => void
  onToggleStatus: (agency: Agency) => void
}) {
  const [editing, setEditing]   = useState(false)
  const [name, setName]         = useState(agency.name)
  const [resetting, setResetting] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy]         = useState(false)

  async function saveName() {
    if (!name.trim() || name.trim() === agency.name) { setEditing(false); return }
    setBusy(true)
    try { await onRename(agency.id, name.trim()) } finally { setBusy(false); setEditing(false) }
  }

  async function submitReset() {
    if (!newPassword) return
    setBusy(true)
    try { await onResetPassword(agency.id, newPassword) } finally {
      setBusy(false); setResetting(false); setNewPassword('')
    }
  }

  return (
    <div className="p-3 rounded-md border border-slate-200 bg-surface-alt space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {editing ? (
              <input className="input-field text-sm py-1" value={name}
                onChange={(e) => setName(e.target.value)} disabled={busy} autoFocus />
            ) : (
              <span className="text-sm font-semibold text-slate-800 truncate cursor-pointer hover:underline"
                onClick={() => setEditing(true)} title="Click to rename">
                {agency.name}
              </span>
            )}
            <span className={`badge ${STATUS_STYLE[agency.subscriptionStatus] ?? ''}`}>
              {agency.subscriptionStatus}
            </span>
          </div>
          <p className="text-xs text-slate-400 truncate">
            {agency.admin ? `${agency.admin.displayName} · ${agency.admin.email}` : 'No admin'}
            {' · '}{agency.userCount} user{agency.userCount === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {editing ? (
            <>
              <button onClick={saveName} className="btn-ghost text-xs" disabled={busy}>Save</button>
              <button onClick={() => { setEditing(false); setName(agency.name) }} className="btn-ghost text-xs" disabled={busy}>Cancel</button>
            </>
          ) : (
            <>
              <button onClick={() => setResetting((r) => !r)} className="btn-ghost text-xs">
                {resetting ? 'Cancel' : 'Reset Admin Password'}
              </button>
              <button onClick={() => onToggleStatus(agency)} className="btn-ghost text-xs">
                {agency.subscriptionStatus === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
              </button>
              <button
                onClick={() => onDelete(agency.id)}
                className="btn-ghost text-xs text-alert"
                disabled={dispatchedCount > 0}
                title={dispatchedCount > 0 ? 'Cannot delete — this agency has dispatched teams' : 'Delete agency'}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {resetting && (
        <div className="flex gap-2">
          <input className="input-field text-xs py-1" type="password" placeholder="New admin password"
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={busy} />
          <button onClick={submitReset} className="btn-primary text-xs flex-shrink-0" disabled={busy || !newPassword}>
            {busy ? 'Saving…' : 'Set Password'}
          </button>
        </div>
      )}
    </div>
  )
}

function MissionsPanel({ missions }: { missions: MissionRow[] }) {
  return (
    <div className="panel overflow-hidden">
      <div className="panel-header">All Missions ({missions.length})</div>
      <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
        {missions.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">— no missions yet —</p>
        )}
        {missions.map((m) => (
          <div key={m.id} className="p-2.5 rounded-md border border-slate-200 bg-surface-alt flex items-center justify-between gap-4 text-xs">
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-slate-700">{m.agencyName ?? '—'}</span>
              <span className="text-slate-400"> · {m.teamName ?? '—'}</span>
              <span className="text-slate-400"> · {m.incidentType ?? '—'} ({m.incidentSeverity ?? '—'})</span>
            </div>
            <span className="badge border-slate-200 text-slate-500 flex-shrink-0">{m.status}</span>
            <span className="text-slate-400 flex-shrink-0">{new Date(m.createdAt).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SystemAdminDashboard() {
  const { token } = useAuth()
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [missions, setMissions] = useState<MissionRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [agencyName, setAgencyName]     = useState('')
  const [subStatus, setSubStatus]       = useState<'ACTIVE' | 'SUSPENDED'>('ACTIVE')
  const [adminName, setAdminName]       = useState('')
  const [adminEmail, setAdminEmail]     = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [error, setError]               = useState('')
  const [submitting, setSubmitting]     = useState(false)

  const authHeaders = useCallback((): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token])

  const fetchAgencies = useCallback(async () => {
    try {
      const res = await fetch('/server/admin/agencies', { headers: authHeaders() })
      if (res.ok) setAgencies(await res.json())
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  const fetchMissions = useCallback(async () => {
    const res = await fetch('/server/admin/missions', { headers: authHeaders() })
    if (res.ok) setMissions(await res.json())
  }, [authHeaders])

  useEffect(() => { fetchAgencies(); fetchMissions() }, [fetchAgencies, fetchMissions])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!agencyName || !adminName || !adminEmail || !adminPassword) {
      setError('All fields are required.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/server/admin/agencies', {
        method:  'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          agencyName, subscriptionStatus: subStatus,
          adminName, adminEmail, adminPassword,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to create agency')
      }
      setAgencyName(''); setAdminName(''); setAdminEmail(''); setAdminPassword('')
      setSubStatus('ACTIVE'); setShowForm(false)
      fetchAgencies()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agency')
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleStatus(agency: Agency) {
    const next = agency.subscriptionStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
    await fetch(`/server/admin/agencies/${agency.id}/status`, {
      method:  'PATCH',
      headers: authHeaders(),
      body:    JSON.stringify({ status: next }),
    })
    fetchAgencies()
  }

  async function renameAgency(id: string, name: string) {
    await fetch(`/server/admin/agencies/${id}`, {
      method:  'PATCH',
      headers: authHeaders(),
      body:    JSON.stringify({ name }),
    })
    fetchAgencies()
  }

  async function resetAdminPassword(id: string, password: string) {
    await fetch(`/server/admin/agencies/${id}/admin-password`, {
      method:  'PATCH',
      headers: authHeaders(),
      body:    JSON.stringify({ password }),
    })
  }

  async function deleteAgency(id: string) {
    if (!window.confirm('Delete this agency and all of its users and teams? This cannot be undone.')) return
    const res = await fetch(`/server/admin/agencies/${id}`, {
      method:  'DELETE',
      headers: authHeaders(),
    })
    if (res.ok) fetchAgencies()
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">System Admin</h1>
          <p className="text-sm text-slate-400 mt-1">Manage subscribing agencies and their administrators</p>
        </div>
        <button className="btn-primary text-sm" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : '+ Add Agency'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="panel p-5 space-y-4">
          <p className="text-sm font-semibold text-slate-700 mb-1">New Agency</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Agency Name</label>
              <input className="input-field" value={agencyName} onChange={(e) => setAgencyName(e.target.value)}
                placeholder="CDRRMO Cebu" disabled={submitting} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Subscription</label>
              <select className="input-field" value={subStatus}
                onChange={(e) => setSubStatus(e.target.value as 'ACTIVE' | 'SUSPENDED')} disabled={submitting}>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Admin Name</label>
              <input className="input-field" value={adminName} onChange={(e) => setAdminName(e.target.value)}
                placeholder="Juan Dela Cruz" disabled={submitting} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Admin Email</label>
              <input className="input-field" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@agency.ph" disabled={submitting} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Admin Password</label>
              <input className="input-field" type="password" value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)} disabled={submitting} />
            </div>
          </div>

          {error && (
            <p className="text-alert text-xs border border-red-200 bg-red-50 rounded px-3 py-2">{error}</p>
          )}

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Agency + Admin'}
          </button>
        </form>
      )}

      <div className="panel overflow-hidden">
        <div className="panel-header">Agencies ({agencies.length})</div>
        <div className="p-3 space-y-2">
          {loading && <p className="text-sm text-slate-400 text-center py-6">Loading…</p>}
          {!loading && agencies.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">— no agencies yet —</p>
          )}
          {agencies.map((agency) => (
            <AgencyRow
              key={agency.id}
              agency={agency}
              dispatchedCount={missions.filter(
                (m) => m.agencyId === agency.id && !['COMPLETED', 'DECLINED'].includes(m.status)
              ).length}
              onRename={renameAgency}
              onResetPassword={resetAdminPassword}
              onDelete={deleteAgency}
              onToggleStatus={toggleStatus}
            />
          ))}
        </div>
      </div>

      <MissionsPanel missions={missions} />
    </div>
  )
}
